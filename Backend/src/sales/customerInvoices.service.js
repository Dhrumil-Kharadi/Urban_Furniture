/**
 * Customer Invoices Service
 *
 * Lifecycle (project.md §5.2.6):
 *   draft → posted → partially_paid → paid → overdue → cancelled
 *
 * `postCustomerInvoice` is the critical path, and the mirror of
 * postVendorBill. The journal entry it produces must match project.md §5.2.4
 * exactly:
 *
 *   Dr  Debtors (the customer's receivable)          total
 *   Cr  Sale Income (per line income_account_id)     untaxed
 *   Cr  Output Tax Payable                            tax
 *
 * project.md §7: TAX POSTS TO ITS OWN ACCOUNT. Folding it into Sale Income
 * would overstate revenue by the tax and understate the liability by the same
 * amount — two wrong reports from one shortcut, and the kind that is only
 * noticed at a filing deadline.
 *
 * Nothing here writes to the ledger directly: it builds lines and hands them
 * to accounting.service.postJournalEntry, which is the only way in.
 */

const { money } = require('../shared/money');
const { withTransaction } = require('../shared/withTransaction');
const sequenceService = require('../shared/sequence.service');
const auditService = require('../shared/audit.service');
const accountingService = require('../accounting/accounting.service');
const notificationsService = require('../notifications/notifications.service');
const logger = require('../utils/logger');
const salesRepository = require('./sales.repository');
const { computeSalesLines } = require('./salesOrders.service');

/** @private */
function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * System account codes the sales posting template reaches for.
 * Seeded for every organization by organizations.seed.js.
 */
const DEBTORS_CODE = '1030';
const OUTPUT_TAX_CODE = '2020';

const customerInvoicesService = {
  /**
   * @param {string} organizationId
   * @param {object} query
   * @returns {Promise<{ items: Array, meta: object }>}
   */
  async listCustomerInvoices(organizationId, query) {
    return salesRepository.listCustomerInvoices(null, organizationId, query);
  },

  /**
   * @param {string} organizationId
   * @param {string} invoiceId
   * @returns {Promise<object>}
   */
  async getCustomerInvoiceById(organizationId, invoiceId) {
    const invoice = await salesRepository.getCustomerInvoiceById(null, organizationId, invoiceId);
    if (!invoice) fail('Customer invoice not found', 404);
    return invoice;
  },

  /**
   * Create a draft invoice directly, without a sales order.
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createCustomerInvoice(organizationId, actorUserId, data) {
    const customer = await salesRepository.findActiveCustomer(
      null, organizationId, data.customer_contact_id
    );
    if (!customer) fail('Customer not found, inactive, or not a customer contact', 400);

    const journal = await salesRepository.findActiveJournal(
      null, organizationId, data.journal_id, ['sales', 'general']
    );
    if (!journal) fail('A sales journal is required and must be active', 400);

    return withTransaction(async (client) => {
      const { computedLines, untaxed_amount, tax_amount, total_amount } =
        await computeSalesLines(client, organizationId, data.lines);

      const missingAccount = computedLines.find((line) => !line.income_account_id);
      if (missingAccount) {
        fail(
          `Line ${missingAccount.line_no} has no income account — set one on the product or the line`,
          400
        );
      }

      const invoice = await salesRepository.insertCustomerInvoice(client, {
        organization_id: organizationId,
        invoice_number: `DRAFT-INV-${Date.now()}`,
        sales_order_id: null,
        customer_contact_id: data.customer_contact_id,
        invoice_date: data.invoice_date,
        due_date: data.due_date || null,
        status: 'draft',
        untaxed_amount,
        tax_amount,
        total_amount,
        amount_due: '0.00',
        amount_paid: '0.00',
        journal_id: data.journal_id,
        notes: data.notes || null,
        actor_user_id: actorUserId,
      });

      await salesRepository.insertCustomerInvoiceLines(
        client, organizationId, invoice.id, computedLines
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'customer_invoice',
        entityId: invoice.id,
        after: { customer: customer.name, total: total_amount },
      });

      return salesRepository.getCustomerInvoiceById(client, organizationId, invoice.id);
    });
  },

  /**
   * Update a DRAFT invoice. A posted one is refused with a 409 — it has
   * already reached the ledger.
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {string} invoiceId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async updateCustomerInvoice(organizationId, actorUserId, invoiceId, data) {
    const existing = await salesRepository.getCustomerInvoiceById(null, organizationId, invoiceId);
    if (!existing) fail('Customer invoice not found', 404);
    if (existing.status !== 'draft') fail('Only draft invoices can be edited', 409);

    if (data.customer_contact_id) {
      const customer = await salesRepository.findActiveCustomer(
        null, organizationId, data.customer_contact_id
      );
      if (!customer) fail('Customer not found, inactive, or not a customer contact', 400);
    }
    if (data.journal_id) {
      const journal = await salesRepository.findActiveJournal(
        null, organizationId, data.journal_id, ['sales', 'general']
      );
      if (!journal) fail('A sales journal is required and must be active', 400);
    }

    return withTransaction(async (client) => {
      const updateData = {
        customer_contact_id: data.customer_contact_id,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        notes: data.notes,
        journal_id: data.journal_id,
        updated_by: actorUserId,
      };

      if (Array.isArray(data.lines) && data.lines.length > 0) {
        const { computedLines, untaxed_amount, tax_amount, total_amount } =
          await computeSalesLines(client, organizationId, data.lines);

        const missingAccount = computedLines.find((line) => !line.income_account_id);
        if (missingAccount) {
          fail(`Line ${missingAccount.line_no} has no income account`, 400);
        }

        updateData.untaxed_amount = untaxed_amount;
        updateData.tax_amount = tax_amount;
        updateData.total_amount = total_amount;

        await salesRepository.deleteCustomerInvoiceLines(client, organizationId, invoiceId);
        await salesRepository.insertCustomerInvoiceLines(
          client, organizationId, invoiceId, computedLines
        );
      }

      await salesRepository.updateCustomerInvoice(client, organizationId, invoiceId, updateData);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'customer_invoice',
        entityId: invoiceId,
        before: { status: existing.status },
        after: { updated_fields: Object.keys(data) },
      });

      return salesRepository.getCustomerInvoiceById(client, organizationId, invoiceId);
    });
  },

  /**
   * POST an invoice — THE CRITICAL PATH. One transaction, exact order:
   *
   *   1. middleware has authenticated, resolved the tenant and authorized
   *   2. load with lines; assert 'draft' else 409
   *   3. assert >= 1 line and total > 0
   *   4. assert customer active; every income account and the journal active
   *   5. RECOMPUTE ALL TOTALS SERVER-SIDE
   *   6. consume the INV sequence on the shared client
   *   7. build the §5.2.4 lines and call postJournalEntry
   *   8. update the invoice: status, number, journal_entry_id, amount_due
   *   9. write audit
   *  10. COMMIT — the notification is queued by the caller, never in here
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {string} invoiceId
   * @returns {Promise<object>}
   */
  async postCustomerInvoice(organizationId, actorUserId, invoiceId) {
    let notificationId = null;
    const result = await withTransaction(async (client) => {
      // 2.
      const invoice = await salesRepository.getCustomerInvoiceById(
        client, organizationId, invoiceId
      );
      if (!invoice) fail('Customer invoice not found', 404);
      if (invoice.status !== 'draft') fail('Only draft invoices can be posted', 409);

      // 3.
      if (!invoice.lines || invoice.lines.length === 0) {
        fail('Cannot post an invoice with no lines', 400);
      }

      // 4.
      const customer = await salesRepository.findActiveCustomer(
        client, organizationId, invoice.customer_contact_id
      );
      if (!customer) fail('Customer is inactive or not found', 400);

      const journal = await salesRepository.findActiveJournal(
        client, organizationId, invoice.journal_id, ['sales', 'general']
      );
      if (!journal) fail('Journal is inactive or not found', 400);

      // 5. Client totals are never trusted; the lines decide.
      const { computedLines, untaxed_amount, tax_amount, total_amount } =
        await computeSalesLines(client, organizationId, invoice.lines);

      if (money(total_amount).isZero() || money(total_amount).isNegative()) {
        fail('Invoice total must be greater than zero', 400);
      }

      // Every line needs somewhere to credit. Several lines sharing one
      // account is normal, so the check is per line, not on the distinct count.
      const missingAccount = computedLines.find((line) => !line.income_account_id);
      if (missingAccount) {
        fail(`Line ${missingAccount.line_no} has no income account`, 400);
      }

      const incomeAccountIds = [
        ...new Set(computedLines.map((l) => l.income_account_id)),
      ];

      const activeAccounts = await salesRepository.findActiveAccounts(
        client, organizationId, incomeAccountIds
      );
      const activeIds = new Set(activeAccounts.map((a) => a.id));
      for (const accountId of incomeAccountIds) {
        if (!activeIds.has(accountId)) {
          fail('An income account on this invoice is archived or not found', 400);
        }
      }

      // Persist the recomputed lines so what is stored is what was posted.
      await salesRepository.deleteCustomerInvoiceLines(client, organizationId, invoiceId);
      await salesRepository.insertCustomerInvoiceLines(
        client, organizationId, invoiceId, computedLines
      );

      // 6.
      const fiscalYear = String(new Date(invoice.invoice_date).getFullYear());
      const invoiceNumber = await sequenceService.nextDocumentNumber(
        client, organizationId, 'INV', fiscalYear
      );

      // 7. project.md §5.2.4.
      const debtors = await salesRepository.findAccountByCode(
        client, organizationId, DEBTORS_CODE
      );
      if (!debtors) {
        fail(`Debtors account (${DEBTORS_CODE}) not found or archived`, 400);
      }

      const journalLines = [];

      // Dr Debtors — the whole taxed total, tagged with the customer so an
      // open-items statement need not walk back to the document.
      journalLines.push({
        account_id: debtors.id,
        partner_contact_id: invoice.customer_contact_id,
        debit: total_amount,
        credit: '0.00',
        description: `Receivable from ${customer.name} — ${invoiceNumber}`,
      });

      // Cr Sale Income — UNTAXED only, per line, carrying the analytic tag
      // through so the Budget Report has its actuals (project.md §8).
      for (const line of computedLines) {
        if (money(line.untaxed_amount).isZero()) continue;
        journalLines.push({
          account_id: line.income_account_id,
          analytic_account_id: line.analytic_account_id || null,
          debit: '0.00',
          credit: line.untaxed_amount,
          description: line.description || 'Sale income',
        });
      }

      // Cr Output Tax Payable — its OWN account. Never folded into income.
      if (!money(tax_amount).isZero()) {
        const outputTax = await salesRepository.findAccountByCode(
          client, organizationId, OUTPUT_TAX_CODE
        );
        if (!outputTax) {
          fail(`Output Tax Payable account (${OUTPUT_TAX_CODE}) not found or archived`, 400);
        }

        journalLines.push({
          account_id: outputTax.id,
          debit: '0.00',
          credit: tax_amount,
          description: `Output tax on ${invoiceNumber}`,
        });
      }

      const journalEntry = await accountingService.postJournalEntry(client, {
        organizationId,
        journalId: invoice.journal_id,
        entryDate: invoice.invoice_date,
        lines: journalLines,
        reference: invoiceNumber,
        narration: `Customer Invoice ${invoiceNumber} — ${customer.name}`,
        isAutoGenerated: true,
        sourceType: 'customer_invoice',
        sourceId: invoiceId,
        actorUserId,
      });

      // 8.
      await salesRepository.updateInvoiceStatus(client, organizationId, invoiceId, {
        status: 'posted',
        invoice_number: invoiceNumber,
        journal_entry_id: journalEntry.id,
        amount_due: total_amount,
        amount_paid: '0.00',
        posted_at: new Date().toISOString(),
        untaxed_amount,
        tax_amount,
        total_amount,
        updated_by: actorUserId,
      });

      // 9.
      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'post',
        entityType: 'customer_invoice',
        entityId: invoiceId,
        before: { status: 'draft' },
        after: {
          status: 'posted',
          invoice_number: invoiceNumber,
          journal_entry_id: journalEntry.id,
          total: total_amount,
          untaxed: untaxed_amount,
          tax: tax_amount,
        },
      });

      if (customer?.email) {
        try {
          const notif = await notificationsService.triggerInvoicePosted(client, {
            organizationId,
            invoice: { ...invoice, id: invoiceId, invoice_number: invoiceNumber, total_amount, due_date: invoice.due_date },
            customer: { name: customer.name, email: customer.email },
          });
          if (notif?.id) notificationId = notif.id;
        } catch (notifErr) {
          logger.warn('Failed to queue invoice posted notification', { error: notifErr.message });
        }
      }

      return salesRepository.getCustomerInvoiceById(client, organizationId, invoiceId);
    });

    if (notificationId) {
      notificationsService.scheduleDispatch(notificationId);
    }

    return result;
  },

  /**
   * Cancel an invoice. A posted one is REVERSED, never deleted — the entry
   * stays in the ledger with a mirror beside it
   * (technicalrequirement.md §3.8).
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {string} invoiceId
   * @returns {Promise<object>}
   */
  async cancelCustomerInvoice(organizationId, actorUserId, invoiceId) {
    return withTransaction(async (client) => {
      const invoice = await salesRepository.getCustomerInvoiceById(
        client, organizationId, invoiceId
      );
      if (!invoice) fail('Customer invoice not found', 404);
      if (invoice.status === 'cancelled') fail('Invoice is already cancelled', 409);
      if (invoice.status === 'paid') fail('Cannot cancel a fully paid invoice', 409);
      if (money(invoice.amount_paid).greaterThan(money(0))) {
        fail('Cancel or reverse the payments against this invoice first', 409);
      }

      if (invoice.journal_entry_id && invoice.status !== 'draft') {
        await accountingService.reverseJournalEntry(
          client,
          invoice.journal_entry_id,
          `Cancellation of Customer Invoice ${invoice.invoice_number}`,
          { organizationId, actorUserId }
        );
      }

      // A cancelled invoice releases its sales order back to 'confirmed' so
      // the order can be invoiced again.
      if (invoice.sales_order_id) {
        const salesOrder = await salesRepository.getSalesOrderById(
          client, organizationId, invoice.sales_order_id
        );
        if (salesOrder && salesOrder.status === 'invoiced') {
          await salesRepository.updateSOStatus(
            client, organizationId, invoice.sales_order_id, 'confirmed', actorUserId
          );
        }
      }

      await salesRepository.updateInvoiceStatus(client, organizationId, invoiceId, {
        status: 'cancelled',
        amount_due: '0.00',
        updated_by: actorUserId,
      });

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'cancel',
        entityType: 'customer_invoice',
        entityId: invoiceId,
        before: { status: invoice.status },
        after: { status: 'cancelled' },
      });

      return salesRepository.getCustomerInvoiceById(client, organizationId, invoiceId);
    });
  },

  /**
   * Mark a posted invoice as sent to the customer (project.md §9.7).
   *
   * The mail itself is dispatched AFTER the transaction commits — an SMTP
   * round trip inside a transaction holds a database connection open on a
   * third party's latency, and a rollback after a successful send would leave
   * the customer holding a link to an invoice that no longer exists.
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {string} invoiceId
   * @returns {Promise<object>}
   */
  async sendCustomerInvoice(organizationId, actorUserId, invoiceId) {
    const invoice = await salesRepository.getCustomerInvoiceById(
      null, organizationId, invoiceId
    );
    if (!invoice) fail('Customer invoice not found', 404);
    if (invoice.status === 'draft') fail('Post the invoice before sending it', 409);
    if (!invoice.customer_email) {
      fail('This customer has no email address to send the invoice to', 400);
    }

    let notificationId = null;
    const updated = await withTransaction(async (client) => {
      const saved = await salesRepository.updateInvoiceStatus(
        client, organizationId, invoiceId,
        { sent_at: new Date().toISOString(), updated_by: actorUserId }
      );

      try {
        const notif = await notificationsService.triggerInvoicePosted(client, {
          organizationId,
          invoice,
          customer: { name: invoice.customer_name, email: invoice.customer_email },
        });
        if (notif?.id) notificationId = notif.id;
      } catch (notifErr) {
        logger.warn('Failed to queue invoice sent notification', { error: notifErr.message });
      }

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'send',
        entityType: 'customer_invoice',
        entityId: invoiceId,
        after: { sent_to: invoice.customer_email },
      });

      return saved;
    });

    if (notificationId) {
      notificationsService.scheduleDispatch(notificationId);
    }

    logger.info('Customer invoice marked as sent', {
      organizationId,
      invoiceId,
      recipient: invoice.customer_email,
      portalEnabled: invoice.portal_access_enabled,
    });

    return { ...invoice, sent_at: updated?.sent_at ?? null };
  },
};

module.exports = customerInvoicesService;
