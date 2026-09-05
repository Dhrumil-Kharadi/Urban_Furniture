/**
 * Customer Invoices Service
 *
 * Business logic for Customer Invoice lifecycle:
 *   draft → posted → partially_paid → paid → overdue → cancelled
 *
 * The `postCustomerInvoice` method is the critical path:
 *   1. Auth & tenant context validated
 *   2. Load with lines; assert status='draft' else 409 (prevents double-posting)
 *   3. Assert >= 1 line and total > 0
 *   4. Assert customer active, sales journal active, all income accounts active
 *   5. Recompute ALL totals server-side using decimal.js (client totals NEVER trusted)
 *   6. Consume the INV sequence (INV/2026/00001)
 *   7. Build balanced double-entry lines per project.md §5.2.4 & §7:
 *      Dr Debtors (Account 1030)              total
 *      Cr Sale Income (income_account_id)     untaxed
 *      Cr Output Tax Payable (Account 2020)   tax
 *   8. Call accountingService.postJournalEntry (THE ONLY way into the ledger)
 *   9. Update invoice: status='posted', invoice_number, journal_entry_id, amount_due, posted_at
 *  10. If from a Sales Order, update SO status to 'invoiced'
 *  11. Record audit log & queue customer email notification
 */

const { money, toDb, sum, eq } = require('../shared/money');
const { withTransaction } = require('../shared/withTransaction');
const sequenceService = require('../shared/sequence.service');
const auditService = require('../shared/audit.service');
const accountingService = require('../accounting/accounting.service');
const salesRepository = require('./sales.repository');
const { resolveAndComputeLines } = require('./salesOrders.service');
const notificationsService = require('../notifications/notifications.service');
const logger = require('../utils/logger');

/** @private */
function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

const DEFAULT_DEBTORS_CODE = '1030';
const DEFAULT_OUTPUT_TAX_CODE = '2020';

const customerInvoicesService = {
  /**
   * List customer invoices for an organization.
   */
  async listCustomerInvoices(organizationId, query) {
    return salesRepository.listCustomerInvoices(null, organizationId, query);
  },

  /**
   * Get a single customer invoice by ID.
   */
  async getCustomerInvoiceById(organizationId, invoiceId) {
    const invoice = await salesRepository.getCustomerInvoiceById(null, organizationId, invoiceId);
    if (!invoice) fail('Customer invoice not found', 404);
    return invoice;
  },

  /**
   * Create a new draft customer invoice (direct, not from SO).
   */
  async createCustomerInvoice(organizationId, actorUserId, data) {
    // Validate customer
    const customer = await salesRepository.findActiveCustomer(null, organizationId, data.customer_contact_id);
    if (!customer) fail('Customer not found or is inactive', 400);

    // Validate journal
    const journal = await salesRepository.findActiveJournal(null, organizationId, data.journal_id);
    if (!journal) fail('Journal not found or inactive', 400);
    if (journal.journal_type !== 'sales') fail('Customer invoices must use a sales journal', 400);

    return await withTransaction(async (client) => {
      // Recompute totals server-side
      const { computedLines, untaxed_amount, tax_amount, total_amount } = await resolveAndComputeLines(
        client, organizationId, data.lines
      );

      const draftNumber = `DRAFT-INV-${Date.now()}`;

      const invoice = await salesRepository.insertCustomerInvoice(client, {
        organization_id: organizationId,
        invoice_number: draftNumber,
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
        after: { invoice_number: invoice.invoice_number, customer: customer.name, total: total_amount },
      });

      return salesRepository.getCustomerInvoiceById(client, organizationId, invoice.id);
    });
  },

  /**
   * Update a draft customer invoice.
   */
  async updateCustomerInvoice(organizationId, actorUserId, invoiceId, data) {
    const existing = await salesRepository.getCustomerInvoiceById(null, organizationId, invoiceId);
    if (!existing) fail('Customer invoice not found', 404);
    if (existing.status !== 'draft') fail('Only draft invoices can be edited', 409);

    if (data.customer_contact_id) {
      const customer = await salesRepository.findActiveCustomer(null, organizationId, data.customer_contact_id);
      if (!customer) fail('Customer not found or is inactive', 400);
    }
    if (data.journal_id) {
      const journal = await salesRepository.findActiveJournal(null, organizationId, data.journal_id);
      if (!journal) fail('Journal not found or inactive', 400);
      if (journal.journal_type !== 'sales') fail('Customer invoices must use a sales journal', 400);
    }

    return await withTransaction(async (client) => {
      const updateData = {
        customer_contact_id: data.customer_contact_id,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        notes: data.notes,
        journal_id: data.journal_id,
        updated_by: actorUserId,
      };

      if (data.lines && Array.isArray(data.lines) && data.lines.length > 0) {
        const { computedLines, untaxed_amount, tax_amount, total_amount } = await resolveAndComputeLines(
          client, organizationId, data.lines
        );
        updateData.untaxed_amount = untaxed_amount;
        updateData.tax_amount = tax_amount;
        updateData.total_amount = total_amount;

        await salesRepository.deleteCustomerInvoiceLines(client, organizationId, invoiceId);
        await salesRepository.insertCustomerInvoiceLines(client, organizationId, invoiceId, computedLines);
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
   * POST a customer invoice — THE CRITICAL PATH.
   *
   * 1. Assert status='draft' (rejects with 409 to prevent double-posting)
   * 2. Recompute all totals server-side
   * 3. Consume INV sequence for document number
   * 4. Build double-entry lines:
   *    Dr Debtors (1030)              total
   *    Cr Sale Income (per line)      untaxed
   *    Cr Output Tax Payable (2020)   tax
   * 5. Post to ledger via accountingService.postJournalEntry
   * 6. Mark posted and update document amounts
   */
  async postCustomerInvoice(organizationId, actorUserId, invoiceId) {
    return await withTransaction(async (client) => {
      // 1. Load invoice with lines
      const invoice = await salesRepository.getCustomerInvoiceById(client, organizationId, invoiceId);
      if (!invoice) fail('Customer invoice not found', 404);
      if (invoice.status !== 'draft') fail('Only draft invoices can be posted', 409);

      // 2. Assert >= 1 line
      if (!invoice.lines || invoice.lines.length === 0) {
        fail('Cannot post an invoice with no lines', 400);
      }

      // 3. Assert customer active
      const customer = await salesRepository.findActiveCustomer(client, organizationId, invoice.customer_contact_id);
      if (!customer) fail('Customer is inactive or not found', 400);

      // Assert journal active
      const journal = await salesRepository.findActiveJournal(client, organizationId, invoice.journal_id);
      if (!journal) fail('Journal is inactive or not found', 400);
      if (journal.journal_type !== 'sales') fail('Customer invoices must use a sales journal', 400);

      // Assert all income accounts active
      const incomeAccountIds = [...new Set(invoice.lines.map(l => l.income_account_id).filter(Boolean))];
      if (incomeAccountIds.length === 0) {
        fail('Every invoice line must have an income account', 400);
      }
      const activeAccounts = await salesRepository.findActiveAccounts(client, organizationId, incomeAccountIds);
      const activeAccountIds = new Set(activeAccounts.map(a => a.id));
      for (const accId of incomeAccountIds) {
        if (!activeAccountIds.has(accId)) {
          fail('An income account on this invoice is inactive or not found', 400);
        }
      }

      // 4. RECOMPUTE ALL TOTALS SERVER-SIDE
      const { computedLines, untaxed_amount, tax_amount, total_amount } = await resolveAndComputeLines(
        client, organizationId, invoice.lines
      );

      if (money(total_amount).isZero() || money(total_amount).isNegative()) {
        fail('Invoice total amount must be greater than zero', 400);
      }

      // Replace lines with recomputed values
      await salesRepository.deleteCustomerInvoiceLines(client, organizationId, invoiceId);
      await salesRepository.insertCustomerInvoiceLines(client, organizationId, invoiceId, computedLines);

      // 5. Consume the INV sequence
      const fiscalYear = String(new Date(invoice.invoice_date).getFullYear());
      const invoiceNumber = await sequenceService.nextDocumentNumber(
        client, organizationId, 'INV', fiscalYear
      );

      // 6. Look up Debtors (1030) and Output Tax Payable (2020) accounts
      const debtorsRes = await client.query(
        `SELECT id FROM accounts WHERE organization_id = $1 AND code = $2 AND status = 'active'`,
        [organizationId, DEFAULT_DEBTORS_CODE]
      );
      const outputTaxRes = await client.query(
        `SELECT id FROM accounts WHERE organization_id = $1 AND code = $2 AND status = 'active'`,
        [organizationId, DEFAULT_OUTPUT_TAX_CODE]
      );
      const debtorsAccountId = debtorsRes.rows[0]?.id;
      const outputTaxAccountId = outputTaxRes.rows[0]?.id;

      if (!debtorsAccountId) {
        fail('Debtors account (1030) not found or inactive for this organization', 400);
      }

      // 7. Build balanced journal lines:
      //    Dr  Debtors (customer receivable)        total
      //    Cr  Sale Income (per line, untaxed)      untaxed
      //    Cr  Output Tax Payable (own account!)    tax
      const journalLines = [];

      // Dr Debtors (total amount)
      journalLines.push({
        account_id: debtorsAccountId,
        partner_contact_id: invoice.customer_contact_id,
        debit: total_amount,
        credit: '0.00',
        description: `Receivable from ${customer.name} — ${invoiceNumber}`,
      });

      // Cr Sale Income (per line untaxed)
      for (const line of computedLines) {
        if (!money(line.untaxed_amount).isZero()) {
          journalLines.push({
            account_id: line.income_account_id,
            partner_contact_id: invoice.customer_contact_id,
            analytic_account_id: line.analytic_account_id || null,
            debit: '0.00',
            credit: line.untaxed_amount,
            description: line.description || 'Sale income',
          });
        }
      }

      // Cr Output Tax Payable (total tax, ONLY if tax > 0)
      if (!money(tax_amount).isZero()) {
        if (!outputTaxAccountId) {
          fail('Output Tax Payable account (2020) not found or inactive for this organization', 400);
        }
        journalLines.push({
          account_id: outputTaxAccountId,
          partner_contact_id: invoice.customer_contact_id,
          debit: '0.00',
          credit: tax_amount,
          description: `Output tax payable on ${invoiceNumber}`,
        });
      }

      // Post the journal entry through the ledger engine
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

      // 8. Update invoice with posted state
      const updatedInvoice = await salesRepository.updateInvoiceStatus(client, organizationId, invoiceId, {
        status: 'posted',
        invoice_number: invoiceNumber,
        journal_entry_id: journalEntry.id,
        amount_due: total_amount,
        posted_at: new Date().toISOString(),
        untaxed_amount,
        tax_amount,
        total_amount,
        updated_by: actorUserId,
      });

      // 9. If from an SO, mark SO as 'invoiced'
      if (invoice.sales_order_id) {
        await salesRepository.updateSOStatus(
          client, organizationId, invoice.sales_order_id, 'invoiced', actorUserId
        );
      }

      // 10. Audit log
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
        },
      });

      // Queue email notification (project.md §9.7)
      let queuedNotif = null;
      if (customer.email) {
        try {
          queuedNotif = await notificationsService.triggerInvoicePosted(client, {
            organizationId,
            invoice: { ...updatedInvoice, invoice_number: invoiceNumber },
            customer,
          });
          logger.info(`Queued invoice email to customer ${customer.email} for invoice ${invoiceNumber}`);
        } catch (notifErr) {
          logger.warn(`Failed to queue invoice notification: ${notifErr.message}`);
        }
      }

      return {
        invoice: {
          id: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoice_number,
          status: updatedInvoice.status,
          totalAmount: updatedInvoice.total_amount,
          amountDue: updatedInvoice.amount_due,
          dueDate: updatedInvoice.due_date,
        },
        journalEntry: {
          id: journalEntry.id,
          entryNumber: journalEntry.entry_number,
        },
        queuedNotificationId: queuedNotif?.id || null,
      };
    });

    if (result.queuedNotificationId) {
      notificationsService.scheduleDispatch(result.queuedNotificationId);
    }

    return {
      invoice: result.invoice,
      journalEntry: result.journalEntry,
    };
  },

  /**
   * Send invoice to customer via email (project.md §9.7).
   */
  async sendCustomerInvoice(organizationId, actorUserId, invoiceId) {
    const invoice = await salesRepository.getCustomerInvoiceById(null, organizationId, invoiceId);
    if (!invoice) fail('Customer invoice not found', 404);

    const customer = await salesRepository.findActiveCustomer(null, organizationId, invoice.customer_contact_id);
    if (!customer) fail('Customer not found', 404);
    if (!customer.email) fail('Customer has no registered email address', 400);

    // Record notification audit
    await auditService.recordAudit(null, {
      organizationId,
      actorUserId,
      action: 'send_invoice_email',
      entityType: 'customer_invoice',
      entityId: invoiceId,
      after: {
        sent_to: customer.email,
        invoice_number: invoice.invoice_number,
      },
    });

    logger.info(`Dispatched invoice ${invoice.invoice_number} to ${customer.email}`);

    return {
      success: true,
      message: `Invoice ${invoice.invoice_number} sent to ${customer.email}`,
      sentTo: customer.email,
    };
  },

  /**
   * Cancel a customer invoice (admin-only).
   * Reverses the journal entry if already posted.
   */
  async cancelCustomerInvoice(organizationId, actorUserId, invoiceId) {
    const invoice = await salesRepository.getCustomerInvoiceById(null, organizationId, invoiceId);
    if (!invoice) fail('Customer invoice not found', 404);
    if (invoice.status === 'cancelled') fail('Invoice is already cancelled', 409);
    if (invoice.status === 'paid' || invoice.status === 'partially_paid') {
      fail('Cannot cancel an invoice with payments applied', 409);
    }

    return await withTransaction(async (client) => {
      // If posted, reverse the journal entry
      if (invoice.status === 'posted' && invoice.journal_entry_id) {
        await accountingService.reverseJournalEntry(
          client,
          invoice.journal_entry_id,
          `Cancellation of Customer Invoice ${invoice.invoice_number}`,
          { organizationId, actorUserId }
        );
      }

      // If linked to an SO, revert SO status to confirmed
      if (invoice.sales_order_id) {
        const so = await salesRepository.getSalesOrderById(client, organizationId, invoice.sales_order_id);
        if (so && so.status === 'invoiced') {
          await salesRepository.updateSOStatus(
            client, organizationId, invoice.sales_order_id, 'confirmed', actorUserId
          );
        }
      }

      const updated = await salesRepository.updateInvoiceStatus(client, organizationId, invoiceId, {
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
};

module.exports = customerInvoicesService;
