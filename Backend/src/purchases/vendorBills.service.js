/**
 * Vendor Bills Service
 *
 * Business logic for Vendor Bill lifecycle:
 *   draft → posted → partially_paid → paid → overdue → cancelled
 *
 * The `postVendorBill` method is the critical path:
 *   1. Validates draft status, active vendor, active journal & accounts
 *   2. Recomputes ALL totals server-side (client totals NEVER trusted)
 *   3. Consumes the BILL document sequence
 *   4. Builds the double-entry journal lines per project.md §5.1.4:
 *      Dr Purchase Expense (per line expense_account_id)  untaxed
 *      Dr Input Tax Credit (per line, when tax > 0)       tax
 *      Cr Creditors / AP (vendor payable)                 total
 *   5. Calls accountingService.postJournalEntry (THE ONLY way into the ledger)
 *   6. Updates bill: status, bill_number, journal_entry_id, amount_due, posted_at
 *   7. If from a PO, marks the PO as 'billed'
 *   8. Records audit log — all inside ONE transaction
 */

const { money, toDb, sum, eq } = require('../shared/money');
const { withTransaction } = require('../shared/withTransaction');
const sequenceService = require('../shared/sequence.service');
const auditService = require('../shared/audit.service');
const accountingService = require('../accounting/accounting.service');
const purchasesRepository = require('./purchases.repository');
const { computeLineTotals, resolveAndComputeLines } = require('./purchaseOrders.service');
const notificationsService = require('../notifications/notifications.service');
const logger = require('../utils/logger');

/** @private */
function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * Default account codes for the purchase posting template.
 * Input Tax Credit is code 1040 (ITC - CGST); Creditors is 2010.
 */
const DEFAULT_ITC_CODE = '1040';
const DEFAULT_CREDITORS_CODE = '2010';

const vendorBillsService = {
  /**
   * List vendor bills for an organization.
   */
  async listVendorBills(organizationId, query) {
    return purchasesRepository.listVendorBills(null, organizationId, query);
  },

  /**
   * Get a single vendor bill by ID.
   */
  async getVendorBillById(organizationId, billId) {
    const bill = await purchasesRepository.getVendorBillById(null, organizationId, billId);
    if (!bill) fail('Vendor bill not found', 404);
    return bill;
  },

  /**
   * Create a new draft vendor bill (direct, not from PO).
   */
  async createVendorBill(organizationId, actorUserId, data) {
    // Validate vendor
    const vendor = await purchasesRepository.findActiveVendor(null, organizationId, data.vendor_contact_id);
    if (!vendor) fail('Vendor not found or is inactive', 400);

    // Validate journal
    const journal = await purchasesRepository.findActiveJournal(null, organizationId, data.journal_id);
    if (!journal) fail('Journal not found or inactive', 400);

    return await withTransaction(async (client) => {
      // Recompute totals server-side
      const { computedLines, untaxed_amount, tax_amount, total_amount } = await resolveAndComputeLines(
        client, organizationId, data.lines
      );

      const draftNumber = `DRAFT-BILL-${Date.now()}`;

      const bill = await purchasesRepository.insertVendorBill(client, {
        organization_id: organizationId,
        bill_number: draftNumber,
        purchase_order_id: null,
        vendor_contact_id: data.vendor_contact_id,
        bill_date: data.bill_date,
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

      await purchasesRepository.insertVendorBillLines(
        client, organizationId, bill.id, computedLines
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'vendor_bill',
        entityId: bill.id,
        after: { bill_number: bill.bill_number, vendor: vendor.name, total: total_amount },
      });

      return purchasesRepository.getVendorBillById(client, organizationId, bill.id);
    });
  },

  /**
   * Update a draft vendor bill.
   */
  async updateVendorBill(organizationId, actorUserId, billId, data) {
    const existing = await purchasesRepository.getVendorBillById(null, organizationId, billId);
    if (!existing) fail('Vendor bill not found', 404);
    if (existing.status !== 'draft') fail('Only draft bills can be edited', 409);

    if (data.vendor_contact_id) {
      const vendor = await purchasesRepository.findActiveVendor(null, organizationId, data.vendor_contact_id);
      if (!vendor) fail('Vendor not found or is inactive', 400);
    }
    if (data.journal_id) {
      const journal = await purchasesRepository.findActiveJournal(null, organizationId, data.journal_id);
      if (!journal) fail('Journal not found or inactive', 400);
    }

    return await withTransaction(async (client) => {
      const updateData = {
        vendor_contact_id: data.vendor_contact_id,
        bill_date: data.bill_date,
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

        await purchasesRepository.deleteVendorBillLines(client, organizationId, billId);
        await purchasesRepository.insertVendorBillLines(client, organizationId, billId, computedLines);
      }

      await purchasesRepository.updateVendorBill(client, organizationId, billId, updateData);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'vendor_bill',
        entityId: billId,
        before: { status: existing.status },
        after: { updated_fields: Object.keys(data) },
      });

      return purchasesRepository.getVendorBillById(client, organizationId, billId);
    });
  },

  /**
   * POST a vendor bill — THE CRITICAL PATH.
   *
   * This is the 10-step algorithm from phase.md Phase 8:
   *   1. Auth → tenant → authorize (done by middleware)
   *   2. Load with lines; assert status='draft' else 409
   *   3. Assert >=1 line and total_amount > 0
   *   4. Assert vendor active; every account and journal active
   *   5. RECOMPUTE ALL TOTALS SERVER-SIDE
   *   6. Consume the BILL sequence
   *   7. Build journal lines per §5.3 and call postJournalEntry
   *   8. Update bill: status, number, journal_entry_id, amount_due=total, posted_at
   *   9. If from a PO, set the PO to 'billed'
   *  10. Write audit; commit
   */
  async postVendorBill(organizationId, actorUserId, billId) {
    let notificationId = null;
    const result = await withTransaction(async (client) => {
      // 2. Load bill with lines
      const bill = await purchasesRepository.getVendorBillById(client, organizationId, billId);
      if (!bill) fail('Vendor bill not found', 404);
      if (bill.status !== 'draft') fail('Only draft bills can be posted', 409);

      // 3. Assert >= 1 line
      if (!bill.lines || bill.lines.length === 0) {
        fail('Cannot post a bill with no lines', 400);
      }

      // 4. Assert vendor active
      const vendor = await purchasesRepository.findActiveVendor(client, organizationId, bill.vendor_contact_id);
      if (!vendor) fail('Vendor is inactive or not found', 400);

      // Assert journal active
      const journal = await purchasesRepository.findActiveJournal(client, organizationId, bill.journal_id);
      if (!journal) fail('Journal is inactive or not found', 400);

      // Assert all expense accounts active
      const expenseAccountIds = [...new Set(bill.lines.map(l => l.expense_account_id).filter(Boolean))];
      if (expenseAccountIds.length === 0) {
        fail('Every bill line must have an expense account', 400);
      }
      const activeAccounts = await purchasesRepository.findActiveAccounts(client, organizationId, expenseAccountIds);
      const activeAccountIds = new Set(activeAccounts.map(a => a.id));
      for (const accId of expenseAccountIds) {
        if (!activeAccountIds.has(accId)) {
          fail('An expense account on this bill is inactive or not found', 400);
        }
      }

      // 5. RECOMPUTE ALL TOTALS SERVER-SIDE
      const { computedLines, untaxed_amount, tax_amount, total_amount } = await resolveAndComputeLines(
        client, organizationId, bill.lines
      );

      if (money(total_amount).isZero() || money(total_amount).isNegative()) {
        fail('Bill total amount must be greater than zero', 400);
      }

      // Replace lines with recomputed values
      await purchasesRepository.deleteVendorBillLines(client, organizationId, billId);
      await purchasesRepository.insertVendorBillLines(client, organizationId, billId, computedLines);

      // 6. Consume the BILL sequence for the real bill number
      const fiscalYear = String(new Date(bill.bill_date).getFullYear());
      const billNumber = await sequenceService.nextDocumentNumber(
        client, organizationId, 'BILL', fiscalYear
      );

      // 7. Build journal lines per §5.1.4 / §5.3
      //    Dr  Purchase Expense (per line)        untaxed per line
      //    Dr  Input Tax Credit (per line, if tax > 0)  tax per line
      //    Cr  Creditors / AP (vendor payable)    total (sum of all)
      const journalLines = [];
      let lineNo = 1;

      // Look up the ITC and Creditors accounts for this org
      const itcAccRes = await client.query(
        `SELECT id FROM accounts WHERE organization_id = $1 AND code = $2 AND status = 'active'`,
        [organizationId, DEFAULT_ITC_CODE]
      );
      const creditorsAccRes = await client.query(
        `SELECT id FROM accounts WHERE organization_id = $1 AND code = $2 AND status = 'active'`,
        [organizationId, DEFAULT_CREDITORS_CODE]
      );
      const itcAccountId = itcAccRes.rows[0]?.id;
      const creditorsAccountId = creditorsAccRes.rows[0]?.id;

      if (!creditorsAccountId) {
        fail('Creditors account (2010) not found or inactive for this organization', 400);
      }

      for (const line of computedLines) {
        // Dr Purchase Expense (untaxed amount)
        if (!money(line.untaxed_amount).isZero()) {
          journalLines.push({
            account_id: line.expense_account_id,
            partner_contact_id: bill.vendor_contact_id,
            analytic_account_id: line.analytic_account_id || null,
            debit: line.untaxed_amount,
            credit: '0.00',
            description: line.description || 'Purchase expense',
          });
        }

        // Dr Input Tax Credit (tax amount, only if > 0)
        if (itcAccountId && !money(line.tax_amount).isZero()) {
          journalLines.push({
            account_id: itcAccountId,
            partner_contact_id: bill.vendor_contact_id,
            analytic_account_id: line.analytic_account_id || null,
            debit: line.tax_amount,
            credit: '0.00',
            description: `Input tax credit on ${line.description || 'purchase'}`,
          });
        }
      }

      // Cr Creditors (total amount — one consolidated credit line)
      journalLines.push({
        account_id: creditorsAccountId,
        partner_contact_id: bill.vendor_contact_id,
        debit: '0.00',
        credit: total_amount,
        description: `Payable to ${vendor.name} — ${billNumber}`,
      });

      // Post the journal entry through the ledger engine
      const journalEntry = await accountingService.postJournalEntry(client, {
        organizationId,
        journalId: bill.journal_id,
        entryDate: bill.bill_date,
        lines: journalLines,
        reference: billNumber,
        narration: `Vendor Bill ${billNumber} — ${vendor.name}`,
        isAutoGenerated: true,
        sourceType: 'vendor_bill',
        sourceId: billId,
        actorUserId,
      });

      // 8. Update bill with posted state
      const updatedBill = await purchasesRepository.updateBillStatus(client, organizationId, billId, {
        status: 'posted',
        bill_number: billNumber,
        journal_entry_id: journalEntry.id,
        amount_due: total_amount,
        posted_at: new Date().toISOString(),
        untaxed_amount,
        tax_amount,
        total_amount,
        updated_by: actorUserId,
      });

      // 9. If from a PO, mark PO as 'billed'
      if (bill.purchase_order_id) {
        await purchasesRepository.updatePOStatus(
          client, organizationId, bill.purchase_order_id, 'billed', actorUserId
        );
      }

      // 10. Audit log
      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'post',
        entityType: 'vendor_bill',
        entityId: billId,
        before: { status: 'draft' },
        after: {
          status: 'posted',
          bill_number: billNumber,
          journal_entry_id: journalEntry.id,
          total: total_amount,
          untaxed: untaxed_amount,
          tax: tax_amount,
        },
      });

      if (vendor?.email) {
        try {
          const notif = await notificationsService.triggerBillPosted(client, {
            organizationId,
            bill: { ...bill, id: billId, bill_number: billNumber, total_amount, due_date: bill.due_date },
            vendor,
          });
          if (notif?.id) notificationId = notif.id;
        } catch (notifErr) {
          logger.warn('Failed to queue bill posted notification', { error: notifErr.message });
        }
      }

      return purchasesRepository.getVendorBillById(client, organizationId, billId);
    });

    if (notificationId) {
      notificationsService.scheduleDispatch(notificationId);
    }

    return result;
  },

  /**
   * Cancel a vendor bill (admin-only).
   * If posted, creates a reversal journal entry.
   */
  async cancelVendorBill(organizationId, actorUserId, billId) {
    return await withTransaction(async (client) => {
      const bill = await purchasesRepository.getVendorBillById(client, organizationId, billId);
      if (!bill) fail('Vendor bill not found', 404);
      if (bill.status === 'cancelled') fail('Bill is already cancelled', 409);
      if (bill.status === 'paid') fail('Cannot cancel a fully paid bill', 409);

      // If posted, reverse the journal entry
      if (bill.journal_entry_id && bill.status !== 'draft') {
        await accountingService.reverseJournalEntry(
          client,
          bill.journal_entry_id,
          `Cancellation of Vendor Bill ${bill.bill_number}`,
          { organizationId, actorUserId }
        );
      }

      // If linked to a PO, revert PO status to confirmed
      if (bill.purchase_order_id) {
        const po = await purchasesRepository.getPurchaseOrderById(client, organizationId, bill.purchase_order_id);
        if (po && po.status === 'billed') {
          await purchasesRepository.updatePOStatus(
            client, organizationId, bill.purchase_order_id, 'confirmed', actorUserId
          );
        }
      }

      await purchasesRepository.updateBillStatus(client, organizationId, billId, {
        status: 'cancelled',
        updated_by: actorUserId,
      });

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'cancel',
        entityType: 'vendor_bill',
        entityId: billId,
        before: { status: bill.status },
        after: { status: 'cancelled' },
      });

      return purchasesRepository.getVendorBillById(client, organizationId, billId);
    });
  },
};

module.exports = vendorBillsService;
