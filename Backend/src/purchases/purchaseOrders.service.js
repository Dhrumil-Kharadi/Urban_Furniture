/**
 * Purchase Orders Service
 *
 * Business logic for Purchase Order lifecycle:
 *   draft → confirmed → billed → cancelled
 *
 * Totals are ALWAYS recomputed server-side from lines using decimal.js.
 * Client-sent totals are IGNORED — this is a hard security requirement.
 */

const { money, toDb, mul, sum } = require('../shared/money');
const { withTransaction } = require('../shared/withTransaction');
const sequenceService = require('../shared/sequence.service');
const auditService = require('../shared/audit.service');
const {
  computeLineTotals: sharedComputeLineTotals,
  resolveAndComputeLines: sharedResolveAndComputeLines,
  PURCHASE_CONFIG,
} = require('../shared/documentLines');
const purchasesRepository = require('./purchases.repository');
const logger = require('../utils/logger');

/** @private */
function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * Line arithmetic for purchase documents.
 *
 * The maths itself lives in shared/documentLines.js, which the sales side uses
 * too — configured for the purchase fields (cost price, purchase tax, expense
 * account). Keeping one engine is what stops a purchase bill and a sales
 * invoice totalling differently for the same numbers.
 *
 * These wrappers keep the names vendorBills.service.js already imports.
 */

/**
 * @param {Array} rawLines
 * @returns {{ computedLines: Array, untaxed_amount: string, tax_amount: string, total_amount: string }}
 */
function computeLineTotals(rawLines) {
  return sharedComputeLineTotals(rawLines, PURCHASE_CONFIG);
}

/**
 * Resolve product and tax defaults, then recompute the totals.
 *
 * @param {object|null} client
 * @param {string} organizationId
 * @param {Array} rawLines
 * @returns {Promise<{ computedLines: Array, untaxed_amount: string, tax_amount: string, total_amount: string }>}
 */
async function resolveAndComputeLines(client, organizationId, rawLines) {
  return sharedResolveAndComputeLines(client, organizationId, rawLines, PURCHASE_CONFIG);
}

const purchaseOrdersService = {
  /**
   * List purchase orders for an organization.
   */
  async listPurchaseOrders(organizationId, query) {
    return purchasesRepository.listPurchaseOrders(null, organizationId, query);
  },

  /**
   * Get a single purchase order by ID.
   */
  async getPurchaseOrderById(organizationId, poId) {
    const po = await purchasesRepository.getPurchaseOrderById(null, organizationId, poId);
    if (!po) fail('Purchase order not found', 404);
    return po;
  },

  /**
   * Create a new draft purchase order.
   */
  async createPurchaseOrder(organizationId, actorUserId, data) {
    // Validate vendor is active and of type vendor/both
    const vendor = await purchasesRepository.findActiveVendor(null, organizationId, data.vendor_contact_id);
    if (!vendor) fail('Vendor not found or is inactive', 400);

    return await withTransaction(async (client) => {
      // Recompute totals server-side with DB lookup
      const { computedLines, untaxed_amount, tax_amount, total_amount } = await resolveAndComputeLines(
        client, organizationId, data.lines
      );

      // Consume PO sequence
      const poNumber = await sequenceService.nextDocumentNumber(
        client, organizationId, 'PO',
        String(new Date().getFullYear())
      );

      const po = await purchasesRepository.insertPurchaseOrder(client, {
        organization_id: organizationId,
        po_number: poNumber,
        vendor_contact_id: data.vendor_contact_id,
        order_date: data.order_date,
        expected_date: data.expected_date || null,
        status: 'draft',
        untaxed_amount,
        tax_amount,
        total_amount,
        notes: data.notes || null,
        actor_user_id: actorUserId,
      });

      await purchasesRepository.insertPurchaseOrderLines(
        client, organizationId, po.id, computedLines
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'purchase_order',
        entityId: po.id,
        after: { po_number: po.po_number, vendor: vendor.name, total: total_amount },
      });

      return purchasesRepository.getPurchaseOrderById(client, organizationId, po.id);
    });
  },

  /**
   * Update a draft purchase order.
   */
  async updatePurchaseOrder(organizationId, actorUserId, poId, data) {
    const existing = await purchasesRepository.getPurchaseOrderById(null, organizationId, poId);
    if (!existing) fail('Purchase order not found', 404);
    if (existing.status !== 'draft') fail('Only draft purchase orders can be edited', 409);

    if (data.vendor_contact_id) {
      const vendor = await purchasesRepository.findActiveVendor(null, organizationId, data.vendor_contact_id);
      if (!vendor) fail('Vendor not found or is inactive', 400);
    }

    return await withTransaction(async (client) => {
      const updateData = {
        vendor_contact_id: data.vendor_contact_id,
        order_date: data.order_date,
        expected_date: data.expected_date,
        notes: data.notes,
        updated_by: actorUserId,
      };

      // If lines are provided, recompute totals and replace lines
      if (data.lines && Array.isArray(data.lines) && data.lines.length > 0) {
        const { computedLines, untaxed_amount, tax_amount, total_amount } = await resolveAndComputeLines(
          client, organizationId, data.lines
        );
        updateData.untaxed_amount = untaxed_amount;
        updateData.tax_amount = tax_amount;
        updateData.total_amount = total_amount;

        await purchasesRepository.deletePurchaseOrderLines(client, organizationId, poId);
        await purchasesRepository.insertPurchaseOrderLines(client, organizationId, poId, computedLines);
      }

      await purchasesRepository.updatePurchaseOrder(client, organizationId, poId, updateData);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'purchase_order',
        entityId: poId,
        before: { status: existing.status },
        after: { updated_fields: Object.keys(data) },
      });

      return purchasesRepository.getPurchaseOrderById(client, organizationId, poId);
    });
  },

  /**
   * Confirm a draft purchase order → confirmed.
   */
  async confirmPurchaseOrder(organizationId, actorUserId, poId) {
    const po = await purchasesRepository.getPurchaseOrderById(null, organizationId, poId);
    if (!po) fail('Purchase order not found', 404);
    if (po.status !== 'draft') fail('Only draft purchase orders can be confirmed', 409);
    if (!po.lines || po.lines.length === 0) fail('Cannot confirm a purchase order with no lines', 400);

    return await withTransaction(async (client) => {
      const updated = await purchasesRepository.updatePOStatus(
        client, organizationId, poId, 'confirmed', actorUserId
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'confirm',
        entityType: 'purchase_order',
        entityId: poId,
        before: { status: 'draft' },
        after: { status: 'confirmed' },
      });

      return purchasesRepository.getPurchaseOrderById(client, organizationId, poId);
    });
  },

  /**
   * Create a vendor bill from a confirmed PO.
   * Copies lines from the PO into a new draft bill and transitions PO to 'billed'.
   */
  async createBillFromPO(organizationId, actorUserId, poId, journalId) {
    const po = await purchasesRepository.getPurchaseOrderById(null, organizationId, poId);
    if (!po) fail('Purchase order not found', 404);
    if (po.status === 'billed') fail('This purchase order has already been billed', 409);
    if (po.status !== 'confirmed') fail('Only confirmed purchase orders can create bills', 409);

    // Validate journal
    const journal = await purchasesRepository.findActiveJournal(null, organizationId, journalId);
    if (!journal) fail('Journal not found or inactive', 400);
    if (journal.journal_type !== 'purchase') {
      fail('Bills must use a purchase journal', 400);
    }

    return await withTransaction(async (client) => {
      // Mark PO as billed immediately to close the double-billing window
      await purchasesRepository.updatePOStatus(
        client, organizationId, po.id, 'billed', actorUserId
      );

      // Generate a draft bill number placeholder
      const draftBillNumber = `DRAFT-${po.po_number}`;

      const bill = await purchasesRepository.insertVendorBill(client, {
        organization_id: organizationId,
        bill_number: draftBillNumber,
        purchase_order_id: po.id,
        vendor_contact_id: po.vendor_contact_id,
        bill_date: new Date().toISOString().slice(0, 10),
        due_date: null,
        status: 'draft',
        untaxed_amount: po.untaxed_amount,
        tax_amount: po.tax_amount,
        total_amount: po.total_amount,
        amount_due: '0.00',
        amount_paid: '0.00',
        journal_id: journalId,
        notes: po.notes ? `From PO: ${po.po_number}. ${po.notes}` : `From PO: ${po.po_number}`,
        actor_user_id: actorUserId,
      });

      // Copy PO lines to bill lines, resolving expense accounts
      const billLines = await Promise.all(po.lines.map(async (poLine, i) => {
        let expenseAcc = poLine.expense_account_id;
        if (!expenseAcc && poLine.product_id) {
          const pRes = await client.query(
            `SELECT expense_account_id FROM products WHERE id = $1 AND organization_id = $2`,
            [poLine.product_id, organizationId]
          );
          expenseAcc = pRes.rows[0]?.expense_account_id;
        }
        if (!expenseAcc) {
          expenseAcc = journal.default_debit_account_id;
        }
        return {
          line_no: i + 1,
          product_id: poLine.product_id,
          description: poLine.description,
          quantity: poLine.quantity,
          unit_price: poLine.unit_price,
          tax_id: poLine.tax_id,
          tax_rate: poLine.tax_rate,
          untaxed_amount: poLine.untaxed_amount,
          tax_amount: poLine.tax_amount,
          total_amount: poLine.total_amount,
          analytic_account_id: poLine.analytic_account_id,
          expense_account_id: expenseAcc,
        };
      }));

      await purchasesRepository.insertVendorBillLines(
        client, organizationId, bill.id, billLines
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create_bill_from_po',
        entityType: 'vendor_bill',
        entityId: bill.id,
        after: { po_id: po.id, po_number: po.po_number, bill_number: bill.bill_number },
      });

      return purchasesRepository.getVendorBillById(client, organizationId, bill.id);
    });
  },

  /**
   * Cancel a purchase order (admin-only).
   */
  async cancelPurchaseOrder(organizationId, actorUserId, poId) {
    const po = await purchasesRepository.getPurchaseOrderById(null, organizationId, poId);
    if (!po) fail('Purchase order not found', 404);
    if (po.status === 'cancelled') fail('Purchase order is already cancelled', 409);
    if (po.status === 'billed') fail('Cannot cancel a billed purchase order', 409);

    return await withTransaction(async (client) => {
      await purchasesRepository.updatePOStatus(
        client, organizationId, poId, 'cancelled', actorUserId
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'cancel',
        entityType: 'purchase_order',
        entityId: poId,
        before: { status: po.status },
        after: { status: 'cancelled' },
      });

      return purchasesRepository.getPurchaseOrderById(client, organizationId, poId);
    });
  },
};

module.exports = purchaseOrdersService;
module.exports.computeLineTotals = computeLineTotals;
module.exports.resolveAndComputeLines = resolveAndComputeLines;
