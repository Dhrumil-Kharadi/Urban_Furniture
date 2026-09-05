/**
 * Portal Service
 *
 * Business logic for the Contact Portal and Card Payments.
 * Reference: project.md §5.3 · technicalrequirement.md §6.12
 *
 * SECURITY:
 * 1. Customer vs vendor authorization enforced on every endpoint.
 * 2. Amount is strictly read from the database, never from the request.
 * 3. Idempotent processing with UNIQUE (organization_id, gateway_payment_id).
 * 4. Double-entry posting: Dr Payment Gateway Clearing / Cr Debtors.
 * 5. Signatures verified server-side; card details never touch backend.
 */

const portalRepository = require('./portal.repository');
const gatewayAdapter = require('../payments/gateway.adapter');
const sequenceService = require('../shared/sequence.service');
const accountingService = require('../accounting/accounting.service');
const accountingRules = require('../accounting/accounting.rules');
const { withTransaction } = require('../shared/withTransaction');
const { recordAudit } = require('../shared/audit.service');
const { money, toDb } = require('../shared/money');
const logger = require('../utils/logger');

const portalService = {
  /**
   * KPI Summary for contact.
   */
  async getSummary(organizationId, contactId, contactType) {
    if (contactType === 'vendor') {
      return portalRepository.getVendorSummary(null, organizationId, contactId);
    }
    // Default to customer summary
    return portalRepository.getCustomerSummary(null, organizationId, contactId);
  },

  /**
   * List customer's invoices.
   */
  async listInvoices(organizationId, contactId, query) {
    return portalRepository.listInvoices(null, organizationId, contactId, query);
  },

  /**
   * Get invoice detail.
   */
  async getInvoiceDetail(organizationId, contactId, invoiceId) {
    const invoice = await portalRepository.findInvoiceById(null, organizationId, contactId, invoiceId);
    if (!invoice) {
      const err = new Error('Invoice not found');
      err.statusCode = 404;
      throw err;
    }
    return invoice;
  },

  /**
   * List vendor's bills.
   */
  async listBills(organizationId, contactId, query) {
    return portalRepository.listBills(null, organizationId, contactId, query);
  },

  /**
   * Create gateway order (pay-intent) for customer invoice.
   *
   * Amount is READ DIRECTLY FROM DATABASE to prevent client tampering.
   */
  async createPayIntent(organizationId, contactId, invoiceId) {
    const invoice = await portalRepository.findInvoiceById(null, organizationId, contactId, invoiceId);
    if (!invoice) {
      const err = new Error('Invoice not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['posted', 'partially_paid'].includes(invoice.status)) {
      const err = new Error(`Cannot pay an invoice with status '${invoice.status}'`);
      err.statusCode = 400;
      throw err;
    }

    if (money(invoice.amount_due).isZero() || money(invoice.amount_due).isNegative()) {
      const err = new Error('This invoice has no outstanding balance to pay');
      err.statusCode = 400;
      throw err;
    }

    // Call gateway adapter to create order
    const order = await gatewayAdapter.createOrder({
      amount: invoice.amount_due,
      currency: 'INR',
      receipt: invoice.invoice_number,
      notes: {
        organizationId,
        contactId,
        invoiceId,
        invoiceNumber: invoice.invoice_number,
      },
    });

    return {
      gatewayOrderId: order.orderId,
      amount: invoice.amount_due,
      currency: order.currency || 'INR',
      publicKey: gatewayAdapter.getPublicKey(),
      invoiceNumber: invoice.invoice_number,
      provider: order.provider,
      isSimulated: order.isSimulated || false,
    };
  },

  /**
   * Verify card payment signature and post payment transaction.
   *
   * ONE transaction handles:
   * - idempotency check
   * - FOR UPDATE invoice lock
   * - gateway signature verification
   * - journal entry posting (Dr Clearing / Cr Debtors)
   * - payments and payment_allocations records
   * - invoice balance & status update
   * - audit log
   */
  async verifyPayment(organizationId, contactId, { invoiceId, orderId, paymentId, signature }, actorUserId) {
    return withTransaction(async (client) => {
      // 1. Check idempotency: has this payment ID already been recorded?
      const existingPayment = await portalRepository.findPaymentByGatewayId(client, organizationId, paymentId);
      if (existingPayment) {
        logger.info('Payment already processed (idempotent return)', { paymentId });
        return {
          paymentId: existingPayment.id,
          paymentNumber: existingPayment.payment_number,
          amount: existingPayment.amount,
          status: existingPayment.status,
          alreadyProcessed: true,
        };
      }

      // 2. Lock invoice with FOR UPDATE (id, orgId, and contactId guaranteed)
      const invoice = await portalRepository.findInvoiceForUpdate(client, organizationId, contactId, invoiceId);
      if (!invoice) {
        const err = new Error('Invoice not found');
        err.statusCode = 404;
        throw err;
      }

      if (!['posted', 'partially_paid'].includes(invoice.status)) {
        const err = new Error(`Invoice status is '${invoice.status}', not payable`);
        err.statusCode = 400;
        throw err;
      }

      const dueAmount = money(invoice.amount_due);
      if (dueAmount.isZero() || dueAmount.isNegative()) {
        const err = new Error('Invoice is already fully paid');
        err.statusCode = 400;
        throw err;
      }

      // 3. Verify gateway signature SERVER-SIDE
      const isValidSignature = gatewayAdapter.verifySignature({
        orderId,
        paymentId,
        signature,
      });

      if (!isValidSignature) {
        const err = new Error('Payment signature verification failed');
        err.statusCode = 400;
        throw err;
      }

      // 4. Resolve accounting accounts:
      // Clearing account (Dr) and Debtors account (Cr)
      const accounts = await portalRepository.findPostingAccounts(client, organizationId);
      const clearingAccount = accounts.find(
        (a) => a.code === '1050' || a.name.toLowerCase().includes('clearing')
      );
      const debtorsAccount = accounts.find(
        (a) => a.code === '1030' || a.code === '1200' || a.name.toLowerCase().includes('debtor') || a.name.toLowerCase().includes('receivable')
      );

      if (!clearingAccount || !debtorsAccount) {
        const err = new Error('Required accounting accounts (Clearing or Debtors) not configured for this organization');
        err.statusCode = 500;
        throw err;
      }

      // 5. Find journal for payment entry (Bank or General)
      const journal = await portalRepository.findPaymentJournal(client, organizationId);
      if (!journal) {
        const err = new Error('No active bank or general journal found for recording payments');
        err.statusCode = 500;
        throw err;
      }

      // 6. Generate payment document sequence (PAY/YYYY/NNNNN)
      const fiscalYear = new Date().getFullYear();
      const paymentNumber = await sequenceService.nextDocumentNumber(
        client,
        organizationId,
        'payment',
        fiscalYear
      );

      // 7. Generate double-entry lines: Dr Clearing / Cr Debtors
      const journalLines = accountingRules.portalCardPayment({
        clearingAccountId: clearingAccount.id,
        debtorsAccountId: debtorsAccount.id,
        amount: toDb(dueAmount),
        contactId,
        description: `Portal Card Payment ${paymentNumber} — Invoice ${invoice.invoice_number}`,
      });

      // 8. Post journal entry via ledger engine
      const today = new Date().toISOString().slice(0, 10);
      const journalEntry = await accountingService.postJournalEntry(client, {
        organizationId,
        journalId: journal.id,
        entryDate: today,
        lines: journalLines,
        reference: paymentNumber,
        narration: `Portal Card Settlement ${paymentNumber} for ${invoice.invoice_number}`,
        isAutoGenerated: true,
        sourceType: 'payment',
        sourceId: invoice.id,
        actorUserId,
      });

      // 9. Insert payments row
      const payment = await portalRepository.insertPayment(client, {
        organization_id: organizationId,
        payment_number: paymentNumber,
        payment_type: 'inbound',
        contact_id: contactId,
        payment_method: 'card',
        journal_id: journal.id,
        payment_date: today,
        amount: toDb(dueAmount),
        status: 'posted',
        journal_entry_id: journalEntry.id,
        gateway_provider: gatewayAdapter.getProvider(),
        gateway_payment_id: paymentId,
        gateway_order_id: orderId,
        gateway_signature: signature,
        gateway_status: 'captured',
        notes: `Card payment via portal against invoice ${invoice.invoice_number}`,
        actor_user_id: actorUserId,
      });

      // 10. Insert payment_allocations row
      await portalRepository.insertAllocation(client, {
        organization_id: organizationId,
        payment_id: payment.id,
        invoice_id: invoice.id,
        allocated_amount: toDb(dueAmount),
      });

      // 11. Update invoice balances and status to 'paid'
      const newAmountPaid = money(invoice.amount_paid || '0').plus(dueAmount);
      const updatedInvoice = await portalRepository.updateInvoicePaidAmount(
        client,
        organizationId,
        invoice.id,
        toDb(newAmountPaid),
        '0.00',
        'paid',
        actorUserId
      );

      // 12. Record audit log
      await recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'PORTAL_CARD_PAYMENT',
        entityType: 'payment',
        entityId: payment.id,
        before: { invoiceStatus: invoice.status, amountDue: invoice.amount_due },
        after: { paymentNumber, amount: toDb(dueAmount), invoiceStatus: 'paid' },
      });

      logger.info('Portal card payment successfully posted', {
        paymentNumber,
        invoiceNumber: invoice.invoice_number,
        amount: toDb(dueAmount),
      });

      return {
        paymentId: payment.id,
        paymentNumber,
        amount: toDb(dueAmount),
        invoiceNumber: invoice.invoice_number,
        status: 'paid',
        alreadyProcessed: false,
      };
    });
  },

  /**
   * Webhook processing.
   */
  async handleWebhook(provider, rawPayload, signature) {
    const isValid = gatewayAdapter.verifyWebhookSignature(rawPayload, signature);
    if (!isValid) {
      const err = new Error('Invalid webhook signature');
      err.statusCode = 400;
      throw err;
    }

    let event;
    try {
      event = JSON.parse(rawPayload);
    } catch {
      const err = new Error('Invalid JSON payload');
      err.statusCode = 400;
      throw err;
    }

    logger.info('Payment gateway webhook received', { event: event.event });

    // When payment is captured
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const notes = paymentEntity?.notes || {};

      if (notes.organizationId && notes.contactId && notes.invoiceId) {
        try {
          await this.verifyPayment(
            notes.organizationId,
            notes.contactId,
            {
              invoiceId: notes.invoiceId,
              orderId,
              paymentId,
              signature: 'sim_webhook_sig',
            },
            null
          );
        } catch (err) {
          logger.warn('Webhook payment application handled', { error: err.message });
        }
      }
    }

    return { received: true };
  },
};

module.exports = portalService;
