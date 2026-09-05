/**
 * Sales Orders Service
 *
 * Business logic for Sales Order lifecycle:
 *   draft → confirmed → invoiced → cancelled
 *
 * Totals are ALWAYS recomputed server-side from lines using decimal.js.
 * Client-sent totals are IGNORED.
 */

const { money, toDb, sum } = require('../shared/money');
const { withTransaction } = require('../shared/withTransaction');
const sequenceService = require('../shared/sequence.service');
const auditService = require('../shared/audit.service');
const salesRepository = require('./sales.repository');
const logger = require('../utils/logger');

/** @private */
function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * Compute line-level and header-level totals from raw lines.
 * Client-sent totals are never trusted.
 *
 * @param {Array} rawLines
 * @returns {{ computedLines: Array, untaxed_amount: string, tax_amount: string, total_amount: string }}
 */
function computeLineTotals(rawLines) {
  const computedLines = rawLines.map((line, index) => {
    const qty = money(line.quantity);
    const unitPrice = money(line.unit_price);
    const taxRate = money(line.tax_rate || 0);

    const untaxed = qty.times(unitPrice).toFixed(2);
    const taxAmt = money(untaxed).times(taxRate).dividedBy(100).toFixed(2);
    const total = money(untaxed).plus(money(taxAmt)).toFixed(2);

    return {
      line_no: index + 1,
      product_id: line.product_id || null,
      description: (line.description || '').trim(),
      quantity: toDb(qty),
      unit_price: toDb(unitPrice),
      tax_id: line.tax_id || null,
      tax_rate: taxRate.toFixed(4),
      untaxed_amount: untaxed,
      tax_amount: taxAmt,
      total_amount: total,
      analytic_account_id: line.analytic_account_id || null,
      income_account_id: line.income_account_id || null,
    };
  });

  const headerUntaxed = sum(computedLines.map(l => l.untaxed_amount));
  const headerTax = sum(computedLines.map(l => l.tax_amount));
  const headerTotal = sum(computedLines.map(l => l.total_amount));

  return {
    computedLines,
    untaxed_amount: headerUntaxed,
    tax_amount: headerTax,
    total_amount: headerTotal,
  };
}

/**
 * Resolve product and tax metadata from database, then recompute totals.
 */
async function resolveAndComputeLines(client, organizationId, rawLines) {
  const { pool } = require('../config/db');
  const db = client || pool;
  const productIds = [...new Set(rawLines.map(l => l.product_id).filter(Boolean))];
  const taxIds = [...new Set(rawLines.map(l => l.tax_id).filter(Boolean))];

  let productMap = {};
  if (productIds.length > 0) {
    const pRes = await db.query(
      `SELECT id, name, sales_price, income_account_id, sales_tax_id
         FROM products
        WHERE id = ANY($1) AND organization_id = $2`,
      [productIds, organizationId]
    );
    for (const row of pRes.rows) {
      productMap[row.id] = row;
    }
  }

  let taxMap = {};
  if (taxIds.length > 0) {
    const tRes = await db.query(
      `SELECT id, rate FROM taxes WHERE id = ANY($1) AND organization_id = $2`,
      [taxIds, organizationId]
    );
    for (const row of tRes.rows) {
      taxMap[row.id] = row.rate;
    }
  }

  const enrichedLines = rawLines.map((line) => {
    const prod = line.product_id ? productMap[line.product_id] : null;
    let unitPrice = (line.unit_price !== undefined && line.unit_price !== null && line.unit_price !== '')
      ? line.unit_price
      : (prod?.sales_price || 0);
    let taxId = line.tax_id || prod?.sales_tax_id || null;
    let taxRateVal = (line.tax_rate !== undefined && line.tax_rate !== null && line.tax_rate !== '')
      ? line.tax_rate
      : (taxId && taxMap[taxId] !== undefined ? taxMap[taxId] : 0);
    let incomeAcc = line.income_account_id || prod?.income_account_id || null;

    return {
      ...line,
      unit_price: unitPrice,
      tax_id: taxId,
      tax_rate: taxRateVal,
      income_account_id: incomeAcc,
      description: line.description || prod?.name || '',
    };
  });

  return computeLineTotals(enrichedLines);
}

const salesOrdersService = {
  /**
   * List sales orders for an organization.
   */
  async listSalesOrders(organizationId, query) {
    return salesRepository.listSalesOrders(null, organizationId, query);
  },

  /**
   * Get a single sales order by ID.
   */
  async getSalesOrderById(organizationId, soId) {
    const so = await salesRepository.getSalesOrderById(null, organizationId, soId);
    if (!so) fail('Sales order not found', 404);
    return so;
  },

  /**
   * Create a new draft sales order.
   */
  async createSalesOrder(organizationId, actorUserId, data) {
    // Validate customer is active and of type customer/both
    const customer = await salesRepository.findActiveCustomer(null, organizationId, data.customer_contact_id);
    if (!customer) fail('Customer not found or is inactive', 400);

    return await withTransaction(async (client) => {
      // Recompute totals server-side with DB lookup
      const { computedLines, untaxed_amount, tax_amount, total_amount } = await resolveAndComputeLines(
        client, organizationId, data.lines
      );

      // Consume SO sequence
      const soNumber = await sequenceService.nextDocumentNumber(
        client, organizationId, 'SO',
        String(new Date().getFullYear())
      );

      const so = await salesRepository.insertSalesOrder(client, {
        organization_id: organizationId,
        so_number: soNumber,
        customer_contact_id: data.customer_contact_id,
        order_date: data.order_date,
        expected_date: data.expected_date || null,
        status: 'draft',
        untaxed_amount,
        tax_amount,
        total_amount,
        notes: data.notes || null,
        actor_user_id: actorUserId,
      });

      await salesRepository.insertSalesOrderLines(
        client, organizationId, so.id, computedLines
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'sales_order',
        entityId: so.id,
        after: { so_number: so.so_number, customer: customer.name, total: total_amount },
      });

      return salesRepository.getSalesOrderById(client, organizationId, so.id);
    });
  },

  /**
   * Update a draft sales order.
   */
  async updateSalesOrder(organizationId, actorUserId, soId, data) {
    const existing = await salesRepository.getSalesOrderById(null, organizationId, soId);
    if (!existing) fail('Sales order not found', 404);
    if (existing.status !== 'draft') fail('Only draft sales orders can be edited', 409);

    if (data.customer_contact_id) {
      const customer = await salesRepository.findActiveCustomer(null, organizationId, data.customer_contact_id);
      if (!customer) fail('Customer not found or is inactive', 400);
    }

    return await withTransaction(async (client) => {
      const updateData = {
        customer_contact_id: data.customer_contact_id,
        order_date: data.order_date,
        expected_date: data.expected_date,
        notes: data.notes,
        updated_by: actorUserId,
      };

      if (data.lines && Array.isArray(data.lines) && data.lines.length > 0) {
        const { computedLines, untaxed_amount, tax_amount, total_amount } = await resolveAndComputeLines(
          client, organizationId, data.lines
        );
        updateData.untaxed_amount = untaxed_amount;
        updateData.tax_amount = tax_amount;
        updateData.total_amount = total_amount;

        await salesRepository.deleteSalesOrderLines(client, organizationId, soId);
        await salesRepository.insertSalesOrderLines(client, organizationId, soId, computedLines);
      }

      await salesRepository.updateSalesOrder(client, organizationId, soId, updateData);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'sales_order',
        entityId: soId,
        before: { status: existing.status },
        after: { updated_fields: Object.keys(data) },
      });

      return salesRepository.getSalesOrderById(client, organizationId, soId);
    });
  },

  /**
   * Confirm a draft sales order → confirmed.
   */
  async confirmSalesOrder(organizationId, actorUserId, soId) {
    const so = await salesRepository.getSalesOrderById(null, organizationId, soId);
    if (!so) fail('Sales order not found', 404);
    if (so.status !== 'draft') fail('Only draft sales orders can be confirmed', 409);
    if (!so.lines || so.lines.length === 0) fail('Cannot confirm a sales order with no lines', 400);

    return await withTransaction(async (client) => {
      await salesRepository.updateSOStatus(
        client, organizationId, soId, 'confirmed', actorUserId
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'confirm',
        entityType: 'sales_order',
        entityId: soId,
        before: { status: 'draft' },
        after: { status: 'confirmed' },
      });

      return salesRepository.getSalesOrderById(client, organizationId, soId);
    });
  },

  /**
   * Create a customer invoice from a confirmed SO.
   * Copies lines from the SO into a new draft invoice and transitions SO to 'invoiced'.
   */
  async createInvoiceFromSO(organizationId, actorUserId, soId, journalId = null) {
    const so = await salesRepository.getSalesOrderById(null, organizationId, soId);
    if (!so) fail('Sales order not found', 404);
    if (so.status === 'invoiced') fail('This sales order has already been invoiced', 409);
    if (so.status !== 'confirmed') fail('Only confirmed sales orders can create invoices', 409);

    return await withTransaction(async (client) => {
      // Resolve journal
      let targetJournal = null;
      if (journalId) {
        targetJournal = await salesRepository.findActiveJournal(client, organizationId, journalId);
        if (!targetJournal) fail('Journal not found or inactive', 400);
        if (targetJournal.journal_type !== 'sales') {
          fail('Customer invoices must use a sales journal', 400);
        }
      } else {
        targetJournal = await salesRepository.findDefaultSalesJournal(client, organizationId);
        if (!targetJournal) {
          fail('No active sales journal found for this organization', 400);
        }
      }

      // Mark SO as invoiced immediately to prevent double-invoicing
      await salesRepository.updateSOStatus(
        client, organizationId, so.id, 'invoiced', actorUserId
      );

      // Generate a draft invoice number placeholder
      const draftInvoiceNumber = `DRAFT-${so.so_number}`;

      const invoice = await salesRepository.insertCustomerInvoice(client, {
        organization_id: organizationId,
        invoice_number: draftInvoiceNumber,
        sales_order_id: so.id,
        customer_contact_id: so.customer_contact_id,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: null,
        status: 'draft',
        untaxed_amount: so.untaxed_amount,
        tax_amount: so.tax_amount,
        total_amount: so.total_amount,
        amount_due: '0.00',
        amount_paid: '0.00',
        journal_id: targetJournal.id,
        notes: so.notes ? `From SO: ${so.so_number}. ${so.notes}` : `From SO: ${so.so_number}`,
        actor_user_id: actorUserId,
      });

      // Copy SO lines to invoice lines, resolving income accounts
      const invoiceLines = await Promise.all(so.lines.map(async (soLine, i) => {
        let incomeAcc = soLine.income_account_id;
        if (!incomeAcc && soLine.product_id) {
          const pRes = await client.query(
            `SELECT income_account_id FROM products WHERE id = $1 AND organization_id = $2`,
            [soLine.product_id, organizationId]
          );
          incomeAcc = pRes.rows[0]?.income_account_id;
        }
        if (!incomeAcc) {
          incomeAcc = targetJournal.default_credit_account_id;
        }
        if (!incomeAcc) {
          const accRes = await client.query(
            `SELECT id FROM accounts WHERE organization_id = $1 AND code = '4010' AND status = 'active'`,
            [organizationId]
          );
          incomeAcc = accRes.rows[0]?.id;
        }
        if (!incomeAcc) {
          fail('An income account could not be resolved for invoice lines', 400);
        }

        return {
          line_no: i + 1,
          product_id: soLine.product_id,
          description: soLine.description,
          quantity: soLine.quantity,
          unit_price: soLine.unit_price,
          tax_id: soLine.tax_id,
          tax_rate: soLine.tax_rate,
          untaxed_amount: soLine.untaxed_amount,
          tax_amount: soLine.tax_amount,
          total_amount: soLine.total_amount,
          analytic_account_id: soLine.analytic_account_id,
          income_account_id: incomeAcc,
        };
      }));

      await salesRepository.insertCustomerInvoiceLines(
        client, organizationId, invoice.id, invoiceLines
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create_invoice_from_so',
        entityType: 'customer_invoice',
        entityId: invoice.id,
        after: { so_id: so.id, so_number: so.so_number, invoice_number: invoice.invoice_number },
      });

      return salesRepository.getCustomerInvoiceById(client, organizationId, invoice.id);
    });
  },

  /**
   * Cancel a sales order (admin-only).
   */
  async cancelSalesOrder(organizationId, actorUserId, soId) {
    const so = await salesRepository.getSalesOrderById(null, organizationId, soId);
    if (!so) fail('Sales order not found', 404);
    if (so.status === 'cancelled') fail('Sales order is already cancelled', 409);
    if (so.status === 'invoiced') fail('Cannot cancel an invoiced sales order', 409);

    return await withTransaction(async (client) => {
      await salesRepository.updateSOStatus(
        client, organizationId, soId, 'cancelled', actorUserId
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'cancel',
        entityType: 'sales_order',
        entityId: soId,
        before: { status: so.status },
        after: { status: 'cancelled' },
      });

      return salesRepository.getSalesOrderById(client, organizationId, soId);
    });
  },
};

module.exports = salesOrdersService;
module.exports.computeLineTotals = computeLineTotals;
module.exports.resolveAndComputeLines = resolveAndComputeLines;
