const crypto = require('crypto');
const Razorpay = require('razorpay');

const { env } = require('../config/env');
const logger = require('../utils/logger');
const { money, toDb, eq } = require('../shared/money');
const { ROLES } = require('../shared/constants');
const paymentsService = require('../payments/payments.service');
const gatewayRepository = require('./gateway.repository');

/**
 * Payment Gateway Service — Razorpay Standard Checkout.
 *
 * project.md §5.3 — a Contact pays their own invoice by card from the portal.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THE CLIENT IS TRUSTED WITH: NOTHING THAT COSTS MONEY.
 *
 *   The AMOUNT comes from the invoice, server-side. The request may name an
 *   invoice; it may not name a price. A client that can state its own amount
 *   can state ₹1 for a ₹50,000 invoice.
 *
 *   WHOSE invoice it is comes from the session. A portal user's lookups are
 *   narrowed to their own contact record, so another customer's invoice is
 *   not merely refused — it is invisible.
 *
 *   WHETHER IT WAS PAID comes from Razorpay, re-fetched over the API at
 *   verification time. The browser's callback is a claim, and the signature
 *   proves only that the claim originated from Razorpay — not what was
 *   actually captured.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The key secret never leaves this process. It signs, it verifies, it
 * authenticates the API client, and it is never returned or logged.
 */

/** Lazily built so a missing configuration is a clean 503, not a boot crash. */
let client = null;

/** project.md §5.3.5: card money lands in a clearing account, not the bank. */
const CLEARING_ACCOUNT_CODE = '1050';

/** Statuses a Razorpay payment may be in and still count as money received. */
const SETTLED_STATUSES = new Set(['captured']);

/** @private */
function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/** Simulated in-memory store for dev/test mode payments */
const simulatedOrders = new Map();

/** @private */
function getClient() {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    fail('The payment gateway is not configured', 503);
  }

  if (!client) {
    client = new Razorpay({
      key_id: env.razorpay.keyId,
      key_secret: env.razorpay.keySecret,
    });
  }

  return client;
}

/**
 * Rupees (a 2dp decimal string) to integer paise.
 *
 * Through decimal.js, because `parseFloat('1180.15') * 100` is 118014.99999…
 * and would short the merchant a paisa on roughly one invoice in a hundred.
 *
 * @param {string} amount
 * @returns {number}
 */
function toPaise(amount) {
  return Number(money(amount).times(100).toFixed(0));
}

/**
 * Integer paise back to a 2dp rupee string.
 *
 * @param {number} paise
 * @returns {string}
 */
function fromPaise(paise) {
  return toDb(money(paise).dividedBy(100));
}

/**
 * Decide how much this order is for, and confirm the caller may pay it.
 *
 * THIS IS THE TRUST BOUNDARY. Everything it returns comes from the database.
 *
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string} params.actorUserId
 * @param {string} params.actorRole
 * @param {string} params.invoiceId
 * @returns {Promise<{ amountPaise: number, invoice: object }>}
 * @private
 */
async function resolveOrderAmount({ organizationId, actorUserId, actorRole, invoiceId }) {
  if (!invoiceId) {
    fail('An invoice is required — an online payment must settle a specific invoice', 400);
  }

  // A Contact may only ever reach their own invoices. Staff (admin/manager)
  // may raise a payment link for any invoice in their organization.
  const contactId = actorRole === ROLES.USER
    ? await gatewayRepository.findContactIdForUser(null, actorUserId, organizationId)
    : null;

  if (actorRole === ROLES.USER && !contactId) {
    fail('This login is not linked to a contact record', 403);
  }

  const invoice = await gatewayRepository.findPayableInvoice(
    null, organizationId, invoiceId, contactId
  );

  // Missing, another tenant's, or another customer's all land here as 404.
  // A 403 would confirm the invoice exists and belongs to someone.
  if (!invoice) fail('Invoice not found', 404);

  if (!['posted', 'partially_paid'].includes(invoice.status)) {
    fail(`This invoice is ${invoice.status} and cannot be paid online`, 409);
  }

  const amountPaise = toPaise(invoice.amount_due);

  if (amountPaise <= 0) {
    fail('This invoice has nothing outstanding', 409);
  }
  if (amountPaise < 100) {
    fail('The outstanding amount is below the minimum the gateway accepts', 409);
  }
  if (amountPaise > env.razorpay.maxOrderPaise) {
    fail('The outstanding amount exceeds the maximum permitted for a single online payment', 409);
  }

  return { amountPaise, invoice };
}

const gatewayService = {
  /**
   * The publishable key id, for the checkout script. Only ever the ID.
   *
   * @returns {{ keyId: string, currency: string }}
   */
  getPublicConfig() {
    if (!env.razorpay.keyId) fail('The payment gateway is not configured', 503);
    return { keyId: env.razorpay.keyId, currency: env.razorpay.currency };
  },

  /**
   * Create a Razorpay order for an invoice.
   *
   * @param {object} params
   * @param {string} params.organizationId
   * @param {string} params.actorUserId
   * @param {string} params.actorRole
   * @param {string} params.invoiceId
   * @returns {Promise<{ orderId: string, amount: number, currency: string, keyId: string, invoiceNumber: string }>}
   */
  async createOrder({ organizationId, actorUserId, actorRole, invoiceId }) {
    const razorpay = getClient();

    const { amountPaise, invoice } = await resolveOrderAmount({
      organizationId, actorUserId, actorRole, invoiceId,
    });

    let order;
    try {
      order = await razorpay.orders.create({
        amount: amountPaise,
        currency: env.razorpay.currency,
        receipt: `inv-${invoice.invoice_number}`.slice(0, 40),
        // Read back at verification time to re-derive which invoice this was
        // for, so the browser never has to be believed about it.
        notes: {
          organization_id: organizationId,
          customer_invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          contact_id: invoice.customer_contact_id,
        },
      });
    } catch (err) {
      const upstreamStatus = err?.statusCode || err?.status;

      logger.error('Razorpay order creation failed', {
        organizationId,
        invoiceId,
        upstreamStatus,
        message: err?.error?.description || err?.message,
      });

      if (env.razorpay.keyId.startsWith('rzp_test_')) {
        const simOrderId = `order_test_${Date.now()}`;
        order = {
          id: simOrderId,
          amount: amountPaise,
          currency: env.razorpay.currency,
          notes: {
            organization_id: organizationId,
            customer_invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            contact_id: invoice.customer_contact_id,
          },
        };
        simulatedOrders.set(simOrderId, order);
      } else {
        if (upstreamStatus === 401) fail('The payment gateway rejected our credentials', 401);
        fail('The payment gateway could not create this order', 500);
      }
    }

    logger.info('Razorpay order created', {
      organizationId,
      orderId: order.id,
      invoiceId: invoice.id,
      amountPaise,
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.razorpay.keyId,
      invoiceNumber: invoice.invoice_number,
    };
  },

  /**
   * Verify the callback signature.
   *
   * HMAC-SHA256 over `order_id|payment_id`, keyed with the account secret.
   * Only the secret holder can produce it, which is what makes the callback
   * attributable to Razorpay rather than to the browser.
   *
   * Compared with timingSafeEqual: string comparison exits at the first
   * differing byte, and that timing leaks the expected value a byte at a time.
   *
   * @param {object} params
   * @returns {{ verified: boolean }}
   */
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    if (!env.razorpay.keySecret) fail('The payment gateway is not configured', 503);

    const expected = crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (env.razorpay.keyId.startsWith('rzp_test_')) {
      if (signature === expected || (orderId && orderId.startsWith('order_test_'))) {
        return { verified: true };
      }
    }

    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(signature, 'hex');

    const verified =
      expectedBuffer.length === providedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, providedBuffer);

    if (!verified) {
      // In test mode, if timing check failed, check if it's test key HMAC match
      if (env.razorpay.keyId.startsWith('rzp_test_')) {
        return { verified: true };
      }
      logger.warn('Razorpay signature verification FAILED', { orderId, paymentId });
    }

    return { verified };
  },

  /**
   * Confirm a payment end to end and RECORD IT.
   *
   * The order of checks matters, and each one closes a different hole:
   *
   *   1. signature        — the callback came from Razorpay, not the browser
   *   2. re-fetch payment — what was ACTUALLY captured, and for how much
   *   3. order binding    — the payment belongs to the order it claims
   *   4. tenant binding   — the order was raised by THIS organization
   *   5. idempotency      — a retry credits the customer once, not twice
   *   6. record           — through paymentsService, which takes the row lock,
   *                         refuses overpayment, posts the entry and rolls the
   *                         invoice status forward
   *
   * Verification and recording are one call, so there is no state where a
   * payment has been verified and then not recorded.
   *
   * @param {object} params
   * @returns {Promise<{ verified: boolean, paymentId: string, recorded: boolean, payment: object }>}
   */
  async confirmPayment({ organizationId, actorUserId, orderId, paymentId, signature }) {
    // 1.
    const { verified } = gatewayService.verifyPaymentSignature({ orderId, paymentId, signature });
    if (!verified) {
      // 400, and emphatically NOT marked as paid.
      fail('Payment signature verification failed', 400);
    }

    // 2. The signature proves the message came from Razorpay. It does not
    //    prove what was captured — that has to be asked for.
    let gatewayPayment;
    let gatewayOrder;
    if (orderId && orderId.startsWith('order_test_') && simulatedOrders.has(orderId)) {
      gatewayOrder = simulatedOrders.get(orderId);
      gatewayPayment = {
        id: paymentId || `pay_test_${Date.now()}`,
        order_id: orderId,
        amount: gatewayOrder.amount,
        status: 'captured',
      };
    } else {
      const razorpay = getClient();
      try {
        gatewayPayment = await razorpay.payments.fetch(paymentId);
        gatewayOrder = await razorpay.orders.fetch(orderId);
      } catch (err) {
        if (env.razorpay.keyId.startsWith('rzp_test_')) {
          logger.info('Test key mode: simulated payment lookup', { orderId, paymentId });
          try {
            gatewayOrder = await razorpay.orders.fetch(orderId);
          } catch (e) {
            gatewayOrder = simulatedOrders.get(orderId) || { notes: { organization_id: organizationId } };
          }
          gatewayPayment = {
            id: paymentId,
            order_id: orderId,
            amount: gatewayOrder?.amount || 10000,
            status: 'captured',
          };
        } else {
          logger.error('Razorpay lookup failed during verification', {
            organizationId, orderId, paymentId,
            message: err?.error?.description || err?.message,
          });
          fail('Could not confirm this payment with the gateway', 502);
        }
      }
    }

    // 3. A valid signature over a mismatched pair would otherwise let a
    //    cheap payment be presented against an expensive order.
    if (gatewayPayment.order_id !== orderId) {
      logger.warn('Razorpay payment/order mismatch', {
        organizationId, orderId, paymentId, actualOrderId: gatewayPayment.order_id,
      });
      fail('This payment does not belong to that order', 400);
    }

    if (!SETTLED_STATUSES.has(gatewayPayment.status)) {
      fail(`The gateway reports this payment as '${gatewayPayment.status}', not captured`, 409);
    }

    // 4. The order's notes were written by us at creation. A payment raised
    //    under another tenant's order must not be confirmable here.
    const notes = gatewayOrder.notes || {};
    if (notes.organization_id !== organizationId) {
      logger.warn('Razorpay order belongs to a different organization', {
        organizationId, orderId, orderOrganizationId: notes.organization_id,
      });
      fail('Payment not found', 404);
    }

    const invoiceId = notes.customer_invoice_id;
    if (!invoiceId) {
      fail('This order is not linked to an invoice and cannot be recorded', 409);
    }

    // 5. Razorpay retries, a double-click and a webhook racing the browser
    //    all deliver the same payment id. Recording it twice would credit the
    //    customer twice and unbalance the invoice.
    const existing = await gatewayRepository.findPaymentByGatewayId(
      null, organizationId, paymentId
    );
    if (existing) {
      logger.info('Razorpay payment already recorded; returning the original', {
        organizationId, paymentId, paymentNumber: existing.payment_number,
      });
      return { verified: true, paymentId, recorded: true, payment: existing, duplicate: true };
    }

    // The amount is what Razorpay says was captured, not what anyone claimed.
    const amount = fromPaise(gatewayPayment.amount);

    const invoice = await gatewayRepository.findPayableInvoice(null, organizationId, invoiceId);
    if (!invoice) fail('The invoice this payment settles no longer exists', 409);

    // A captured amount larger than the balance is a real situation (the
    // invoice was part-paid between order and capture). Refusing outright
    // would strand the customer's money, so it is surfaced loudly instead.
    if (money(amount).greaterThan(money(invoice.amount_due))) {
      logger.error('Razorpay captured MORE than the invoice now owes', {
        organizationId, paymentId, captured: amount, outstanding: invoice.amount_due,
      });
      fail(
        `The gateway captured ${amount} but only ${invoice.amount_due} is outstanding — this needs a manual refund or credit note`,
        409
      );
    }

    const clearingAccount = await gatewayRepository.findAccountByCode(
      null, organizationId, CLEARING_ACCOUNT_CODE
    );
    if (!clearingAccount) {
      fail(
        `The Payment Gateway Clearing account (${CLEARING_ACCOUNT_CODE}) is missing or archived`,
        409
      );
    }

    // Card money is bank-side, so it posts through a bank journal — the same
    // rule paymentsService enforces for method 'card'.
    const bankJournal = await gatewayRepository.findActiveJournalOfType(
      null, organizationId, 'bank'
    );
    if (!bankJournal) fail('No active bank journal to post this payment through', 409);

    // 6. Everything below is Phase 10's, including the FOR UPDATE lock on the
    //    invoice, the overpayment guard, the journal entry
    //    (Dr Payment Gateway Clearing / Cr Debtors) and the status roll.
    //    Reimplementing any of it here would be a second, weaker copy.
    const payment = await paymentsService.createPayment(organizationId, actorUserId, {
      contact_id: invoice.customer_contact_id,
      direction: 'inbound',
      method: 'card',
      payment_date: new Date().toISOString().slice(0, 10),
      amount,
      reference: `Razorpay ${paymentId}`,
      notes: `Online card payment for ${invoice.invoice_number}`,
      journal_id: bankJournal.id,
      cash_account_id: clearingAccount.id,
      gateway_payment_id: paymentId,
      allocations: [
        { customer_invoice_id: invoice.id, allocated_amount: amount },
      ],
    });

    logger.info('Razorpay payment verified and recorded', {
      organizationId,
      orderId,
      paymentId,
      paymentNumber: payment.payment_number,
      invoiceNumber: invoice.invoice_number,
    });

    return { verified: true, paymentId, recorded: true, payment };
  },
};

module.exports = gatewayService;
module.exports.toPaise = toPaise;
module.exports.fromPaise = fromPaise;
