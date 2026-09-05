/**
 * Payments Service
 *
 * project.md §5.1.5 / §5.2.5 — registering money against bills and invoices,
 * posting the entry, and rolling the document status forward.
 *
 * THE ORDER OF OPERATIONS IS THE DESIGN. One transaction:
 *
 *   1. validate; assert SUM(allocations) === amount
 *   2. LOCK each target document FOR UPDATE
 *   3. assert same-org, same-contact, and 'posted' or 'partially_paid'
 *   4. assert allocated <= amount_due — no overpayment
 *   5. consume the PAY sequence on the shared client
 *   6. post the journal entry through accounting.service
 *   7. update each document: amount_paid, amount_due, status
 *   8. insert allocations; write audit
 *   9. COMMIT
 *
 * Step 1 matters because money allocated to nothing still posts to the ledger.
 * Step 2 matters because without it two concurrent payments both read the same
 * amount_due and both succeed, overpaying the document. Everything else is
 * bookkeeping around those two.
 */

const { money, toDb, sum, eq } = require('../shared/money');
const { withTransaction } = require('../shared/withTransaction');
const sequenceService = require('../shared/sequence.service');
const auditService = require('../shared/audit.service');
const accountingService = require('../accounting/accounting.service');
const accountingRules = require('../accounting/accounting.rules');
const paymentsRepository = require('./payments.repository');

/** @private */
function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/** System accounts the payment templates reach for. */
const DEBTORS_CODE = '1030';
const CREDITORS_CODE = '2010';

/**
 * Journal types each payment method may legitimately post through.
 *
 * A cash payment through a bank journal credits the wrong asset account, and
 * the ledger has no way to notice. Card goes through a bank journal because
 * the money lands in a gateway clearing account, which is a bank-side asset.
 */
const JOURNAL_TYPES_FOR_METHOD = Object.freeze({
  cash: ['cash'],
  bank: ['bank'],
  card: ['bank'],
});

/**
 * The status a document takes once a payment has been applied.
 *
 * NOTE what is absent: 'overdue'. Overdue is DERIVED from the due date and the
 * outstanding balance (technicalrequirement.md §7.8), never written here.
 * Writing it would create a second definition that drifts from the predicate.
 *
 * @param {string} amountDue - Remaining balance, 2dp string.
 * @returns {'paid'|'partially_paid'}
 * @private
 */
function statusForBalance(amountDue) {
  return money(amountDue).isZero() ? 'paid' : 'partially_paid';
}

const paymentsService = {
  /**
   * @param {string} organizationId
   * @param {object} query
   * @returns {Promise<{ items: Array, meta: object }>}
   */
  async listPayments(organizationId, query) {
    return paymentsRepository.listPayments(null, organizationId, query);
  },

  /**
   * A payment in another organization is reported as missing, never as
   * forbidden — a 403 would confirm it exists.
   *
   * @param {string} organizationId
   * @param {string} paymentId
   * @returns {Promise<object>}
   */
  async getPaymentById(organizationId, paymentId) {
    const payment = await paymentsRepository.getPaymentById(null, organizationId, paymentId);
    if (!payment) fail('Payment not found', 404);
    return payment;
  },

  /**
   * Register a payment and post it.
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {object} data - Validated payload.
   * @returns {Promise<object>}
   */
  async createPayment(organizationId, actorUserId, data) {
    const {
      contact_id: contactId,
      direction,
      method,
      payment_date: paymentDate,
      amount,
      reference,
      notes,
      journal_id: journalId,
      cash_account_id: cashAccountId,
      allocations,
      gateway_payment_id: gatewayPaymentId = null,
    } = data;

    // 1. Every paisa must have somewhere to go. Unallocated money would post
    //    to the ledger with no document to explain it.
    const allocatedTotal = sum(allocations.map((a) => a.allocated_amount));
    if (!eq(allocatedTotal, amount)) {
      fail(
        `Allocations total ${allocatedTotal} but the payment is ${amount} — they must match`,
        400
      );
    }

    const contact = await paymentsRepository.findActiveContact(null, organizationId, contactId);
    if (!contact) fail('Contact not found or is archived', 400);

    // The journal type must match the method — otherwise the credit lands on
    // the wrong asset account.
    const allowedTypes = JOURNAL_TYPES_FOR_METHOD[method];
    const journal = await paymentsRepository.findActiveJournalOfType(
      null, organizationId, journalId, allowedTypes
    );
    if (!journal) {
      fail(
        `A ${method} payment must post through a ${allowedTypes.join(' or ')} journal`,
        400
      );
    }

    const cashAccount = await paymentsRepository.findActiveAccount(
      null, organizationId, cashAccountId
    );
    if (!cashAccount) fail('Cash/Bank account not found or is archived', 400);
    if (cashAccount.account_type !== 'asset') {
      fail('The Cash/Bank account must be an asset account', 400);
    }

    return withTransaction(async (client) => {
      const inbound = direction === 'inbound';

      // 2. Lock every target document. Sorted by id so two concurrent payments
      //    touching the same pair of documents always take the locks in the
      //    same order — the standard way to make a deadlock impossible rather
      //    than merely unlikely.
      const sorted = [...allocations].sort((a, b) => {
        const left = a.customer_invoice_id || a.vendor_bill_id;
        const right = b.customer_invoice_id || b.vendor_bill_id;
        return left < right ? -1 : left > right ? 1 : 0;
      });

      const applied = [];

      for (const allocation of sorted) {
        const documentId = inbound ? allocation.customer_invoice_id : allocation.vendor_bill_id;

        if (!documentId) {
          fail(
            inbound
              ? 'An inbound payment must be allocated to customer invoices'
              : 'An outbound payment must be allocated to vendor bills',
            400
          );
        }

        const document = inbound
          ? await paymentsRepository.lockCustomerInvoice(client, organizationId, documentId)
          : await paymentsRepository.lockVendorBill(client, organizationId, documentId);

        // 3. Same org (the lock query enforced it), right contact, right state.
        if (!document) fail('A document on this payment was not found', 404);

        const documentContactId = inbound
          ? document.customer_contact_id
          : document.vendor_contact_id;
        if (documentContactId !== contactId) {
          fail('A document on this payment belongs to a different contact', 400);
        }

        if (!['posted', 'partially_paid'].includes(document.status)) {
          fail(
            `Document ${document.invoice_number || document.bill_number} is ${document.status} and cannot take a payment`,
            409
          );
        }

        // 4. No overpayment. This read happened under the lock, so the balance
        //    is current as of this transaction and cannot move underneath us.
        const allocated = money(allocation.allocated_amount);
        if (allocated.greaterThan(money(document.amount_due))) {
          fail(
            `Allocation ${toDb(allocated)} exceeds the ${document.amount_due} still outstanding on ${document.invoice_number || document.bill_number}`,
            400
          );
        }

        applied.push({ allocation, document, documentId });
      }

      // 5. Consumed on the shared client, so a rollback releases the row lock
      //    and the number is never burned.
      const fiscalYear = String(new Date(paymentDate).getFullYear());
      const paymentNumber = await sequenceService.nextDocumentNumber(
        client, organizationId, 'PAY', fiscalYear
      );

      // 6. Build the entry from the shared templates and post it.
      const counterpartCode = inbound ? DEBTORS_CODE : CREDITORS_CODE;
      const counterpart = await paymentsRepository.findAccountByCode(
        client, organizationId, counterpartCode
      );
      if (!counterpart) {
        fail(`The ${inbound ? 'Debtors' : 'Creditors'} account (${counterpartCode}) is missing or archived`, 400);
      }

      const journalLines = inbound
        ? accountingRules.customerInvoicePaid({
            debtorsAccountId: counterpart.id,
            cashOrBankAccountId: cashAccount.id,
            amount,
            contactId,
            description: `Receipt ${paymentNumber} from ${contact.name}`,
          })
        : accountingRules.vendorBillPaid({
            creditorsAccountId: counterpart.id,
            cashOrBankAccountId: cashAccount.id,
            amount,
            contactId,
            description: `Payment ${paymentNumber} to ${contact.name}`,
          });

      const journalEntry = await accountingService.postJournalEntry(client, {
        organizationId,
        journalId,
        entryDate: paymentDate,
        lines: journalLines,
        reference: paymentNumber,
        narration: `${inbound ? 'Receipt from' : 'Payment to'} ${contact.name} — ${paymentNumber}`,
        isAutoGenerated: true,
        sourceType: 'payment',
        sourceId: null,
        actorUserId,
      });

      const payment = await paymentsRepository.insertPayment(client, {
        organization_id: organizationId,
        payment_number: paymentNumber,
        contact_id: contactId,
        direction,
        method,
        payment_date: paymentDate,
        amount,
        reference,
        notes,
        journal_id: journalId,
        journal_entry_id: journalEntry.id,
        cash_account_id: cashAccount.id,
        gateway_payment_id: gatewayPaymentId,
        actor_user_id: actorUserId,
      });

      // 7. Roll each document forward, still under the lock taken in step 2.
      const documentResults = [];

      for (const { allocation, document, documentId } of applied) {
        const newPaid = sum([document.amount_paid, allocation.allocated_amount]);
        const newDue = toDb(money(document.total_amount).minus(money(newPaid)));
        const newStatus = statusForBalance(newDue);

        const updated = inbound
          ? await paymentsRepository.applyToCustomerInvoice(
              client, organizationId, documentId, newPaid, newDue, newStatus, actorUserId
            )
          : await paymentsRepository.applyToVendorBill(
              client, organizationId, documentId, newPaid, newDue, newStatus, actorUserId
            );

        documentResults.push(updated);
      }

      // 8. Allocations, then the audit row — all inside this transaction.
      await paymentsRepository.insertAllocations(
        client, organizationId, payment.id, allocations
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'payment',
        entityId: payment.id,
        after: {
          payment_number: paymentNumber,
          direction,
          method,
          amount,
          journal_entry_id: journalEntry.id,
          documents: documentResults.map((d) => ({
            number: d.invoice_number || d.bill_number,
            status: d.status,
            amount_due: d.amount_due,
          })),
        },
      });

      // 9. COMMIT happens when this callback returns.
      return paymentsRepository.getPaymentById(client, organizationId, payment.id);
    });
  },

  /**
   * Cancel a payment.
   *
   * REVERSES, never deletes: the entry stays in the ledger with a mirror
   * beside it, and each document's balance is restored to exactly what it was
   * before — technicalrequirement.md §3.8.
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {string} paymentId
   * @returns {Promise<object>}
   */
  async cancelPayment(organizationId, actorUserId, paymentId) {
    return withTransaction(async (client) => {
      const payment = await paymentsRepository.getPaymentById(client, organizationId, paymentId);
      if (!payment) fail('Payment not found', 404);
      if (payment.status === 'cancelled') fail('Payment is already cancelled', 409);

      const allocations = await paymentsRepository.findAllocations(
        client, organizationId, paymentId
      );

      const inbound = payment.direction === 'inbound';

      // Lock in the same id order as createPayment, for the same reason.
      const sorted = [...allocations].sort((a, b) => {
        const left = a.customer_invoice_id || a.vendor_bill_id;
        const right = b.customer_invoice_id || b.vendor_bill_id;
        return left < right ? -1 : left > right ? 1 : 0;
      });

      for (const allocation of sorted) {
        const documentId = inbound ? allocation.customer_invoice_id : allocation.vendor_bill_id;
        if (!documentId) continue;

        const document = inbound
          ? await paymentsRepository.lockCustomerInvoice(client, organizationId, documentId)
          : await paymentsRepository.lockVendorBill(client, organizationId, documentId);

        if (!document) continue;

        // Subtracting exactly what was allocated restores the previous
        // balance to the paisa, whatever else has happened since.
        const restoredPaid = toDb(
          money(document.amount_paid).minus(money(allocation.allocated_amount))
        );
        if (money(restoredPaid).isNegative()) {
          fail('Cancelling this payment would leave a negative paid amount', 409);
        }

        const restoredDue = toDb(money(document.total_amount).minus(money(restoredPaid)));
        // Back to 'posted' when nothing is left paid, otherwise still partial.
        const restoredStatus = money(restoredPaid).isZero()
          ? 'posted'
          : statusForBalance(restoredDue);

        if (inbound) {
          await paymentsRepository.applyToCustomerInvoice(
            client, organizationId, documentId, restoredPaid, restoredDue, restoredStatus, actorUserId
          );
        } else {
          await paymentsRepository.applyToVendorBill(
            client, organizationId, documentId, restoredPaid, restoredDue, restoredStatus, actorUserId
          );
        }
      }

      if (payment.journal_entry_id) {
        await accountingService.reverseJournalEntry(
          client,
          payment.journal_entry_id,
          `Cancellation of payment ${payment.payment_number}`,
          { organizationId, actorUserId }
        );
      }

      await paymentsRepository.markCancelled(client, organizationId, paymentId, actorUserId);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'cancel',
        entityType: 'payment',
        entityId: paymentId,
        before: { status: payment.status, amount: payment.amount },
        after: { status: 'cancelled' },
      });

      return paymentsRepository.getPaymentById(client, organizationId, paymentId);
    });
  },
};

module.exports = paymentsService;
module.exports.statusForBalance = statusForBalance;
module.exports.JOURNAL_TYPES_FOR_METHOD = JOURNAL_TYPES_FOR_METHOD;
