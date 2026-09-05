/**
 * Sales Orders Service
 *
 * Lifecycle (project.md §5.2.2): draft → confirmed → invoiced → cancelled.
 *
 * Totals are ALWAYS recomputed server-side from the lines through
 * shared/documentLines.js. Client-sent totals are ignored — a client that can
 * name its own total can name zero.
 *
 * The line arithmetic itself is NOT here: it is the shared engine that
 * purchases also uses, configured for the sales side. Reimplementing it would
 * be the second of the four copies phase.md warns about.
 */

const { money } = require('../shared/money');
const { withTransaction } = require('../shared/withTransaction');
const sequenceService = require('../shared/sequence.service');
const auditService = require('../shared/audit.service');
const { resolveAndComputeLines, SALES_CONFIG } = require('../shared/documentLines');
const salesRepository = require('./sales.repository');

/** @private */
function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * Recompute the lines of a sales document from raw input.
 * @private
 */
function computeSalesLines(client, organizationId, rawLines) {
  return resolveAndComputeLines(client, organizationId, rawLines, SALES_CONFIG);
}

const salesOrdersService = {
  /**
   * @param {string} organizationId
   * @param {object} query
   * @returns {Promise<{ items: Array, meta: object }>}
   */
  async listSalesOrders(organizationId, query) {
    return salesRepository.listSalesOrders(null, organizationId, query);
  },

  /**
   * A sales order in another organization is reported as missing, never as
   * forbidden — a 403 would confirm it exists.
   *
   * @param {string} organizationId
   * @param {string} soId
   * @returns {Promise<object>}
   */
  async getSalesOrderById(organizationId, soId) {
    const salesOrder = await salesRepository.getSalesOrderById(null, organizationId, soId);
    if (!salesOrder) fail('Sales order not found', 404);
    return salesOrder;
  },

  /**
   * Create a draft sales order.
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createSalesOrder(organizationId, actorUserId, data) {
    const customer = await salesRepository.findActiveCustomer(
      null, organizationId, data.customer_contact_id
    );
    if (!customer) fail('Customer not found, inactive, or not a customer contact', 400);

    return withTransaction(async (client) => {
      const { computedLines, untaxed_amount, tax_amount, total_amount } =
        await computeSalesLines(client, organizationId, data.lines);

      // A draft carries a placeholder number. The real SO number comes from
      // the sequence at confirmation, so abandoned drafts do not consume one
      // and leave gaps in the numbering an auditor will ask about.
      const draftNumber = `DRAFT-SO-${Date.now()}`;

      const salesOrder = await salesRepository.insertSalesOrder(client, {
        organization_id: organizationId,
        so_number: draftNumber,
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
        client, organizationId, salesOrder.id, computedLines
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'sales_order',
        entityId: salesOrder.id,
        after: { so_number: salesOrder.so_number, customer: customer.name, total: total_amount },
      });

      return salesRepository.getSalesOrderById(client, organizationId, salesOrder.id);
    });
  },

  /**
   * Update a DRAFT sales order. Anything else is refused with a 409.
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {string} soId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async updateSalesOrder(organizationId, actorUserId, soId, data) {
    const existing = await salesRepository.getSalesOrderById(null, organizationId, soId);
    if (!existing) fail('Sales order not found', 404);
    if (existing.status !== 'draft') fail('Only draft sales orders can be edited', 409);

    if (data.customer_contact_id) {
      const customer = await salesRepository.findActiveCustomer(
        null, organizationId, data.customer_contact_id
      );
      if (!customer) fail('Customer not found, inactive, or not a customer contact', 400);
    }

    return withTransaction(async (client) => {
      const updateData = {
        customer_contact_id: data.customer_contact_id,
        order_date: data.order_date,
        expected_date: data.expected_date,
        notes: data.notes,
        updated_by: actorUserId,
      };

      if (Array.isArray(data.lines) && data.lines.length > 0) {
        const { computedLines, untaxed_amount, tax_amount, total_amount } =
          await computeSalesLines(client, organizationId, data.lines);

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
   * Confirm a draft: assign the real SO number and move to 'confirmed'.
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {string} soId
   * @returns {Promise<object>}
   */
  async confirmSalesOrder(organizationId, actorUserId, soId) {
    return withTransaction(async (client) => {
      const salesOrder = await salesRepository.getSalesOrderById(client, organizationId, soId);
      if (!salesOrder) fail('Sales order not found', 404);
      if (salesOrder.status !== 'draft') fail('Only draft sales orders can be confirmed', 409);
      if (!salesOrder.lines || salesOrder.lines.length === 0) {
        fail('Cannot confirm a sales order with no lines', 400);
      }
      if (money(salesOrder.total_amount).isZero()) {
        fail('Sales order total must be greater than zero', 400);
      }

      // Consumed on the shared client, so a rollback releases the row lock and
      // the number is never burned.
      const fiscalYear = String(new Date(salesOrder.order_date).getFullYear());
      const soNumber = await sequenceService.nextDocumentNumber(
        client, organizationId, 'SO', fiscalYear
      );

      await client.query(
        `UPDATE sales_orders
            SET so_number = $1, status = 'confirmed', updated_by = $2, updated_at = NOW()
          WHERE id = $3 AND organization_id = $4`,
        [soNumber, actorUserId, soId, organizationId]
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'confirm',
        entityType: 'sales_order',
        entityId: soId,
        before: { status: 'draft' },
        after: { status: 'confirmed', so_number: soNumber },
      });

      return salesRepository.getSalesOrderById(client, organizationId, soId);
    });
  },

  /**
   * Convert a confirmed sales order into a DRAFT customer invoice
   * (project.md §5.2.3). The invoice is not posted here — posting is a
   * separate, deliberate act.
   *
   * Refuses an order that is already invoiced, which is what stops the same
   * order being billed to the customer twice.
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {string} soId
   * @param {object} data - { invoice_date, due_date, journal_id }
   * @returns {Promise<object>} The created draft invoice.
   */
  async createInvoiceFromSO(organizationId, actorUserId, soId, data) {
    return withTransaction(async (client) => {
      const salesOrder = await salesRepository.getSalesOrderById(client, organizationId, soId);
      if (!salesOrder) fail('Sales order not found', 404);

      if (salesOrder.status === 'invoiced') {
        fail('This sales order has already been invoiced', 409);
      }
      if (salesOrder.status !== 'confirmed') {
        fail('Only a confirmed sales order can be invoiced', 409);
      }
      if (!salesOrder.lines || salesOrder.lines.length === 0) {
        fail('Cannot invoice a sales order with no lines', 400);
      }

      const journal = await salesRepository.findActiveJournal(
        client, organizationId, data.journal_id, ['sales', 'general']
      );
      if (!journal) fail('A sales journal is required and must be active', 400);

      // Recompute rather than copying the stored totals: the SO may have been
      // saved before a tax rate changed, and the invoice is the document that
      // will actually hit the ledger.
      const { computedLines, untaxed_amount, tax_amount, total_amount } =
        await computeSalesLines(client, organizationId, salesOrder.lines);

      // Every invoice line needs somewhere to credit. An SO line may have left
      // it blank; the invoice cannot.
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
        sales_order_id: soId,
        customer_contact_id: salesOrder.customer_contact_id,
        invoice_date: data.invoice_date,
        due_date: data.due_date || null,
        status: 'draft',
        untaxed_amount,
        tax_amount,
        total_amount,
        amount_due: '0.00',
        amount_paid: '0.00',
        journal_id: data.journal_id,
        notes: salesOrder.notes || null,
        actor_user_id: actorUserId,
      });

      await salesRepository.insertCustomerInvoiceLines(
        client, organizationId, invoice.id, computedLines
      );

      // The order is marked invoiced now, so a concurrent second conversion
      // sees 'invoiced' and is refused by the guard above.
      await salesRepository.updateSOStatus(client, organizationId, soId, 'invoiced', actorUserId);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'convert',
        entityType: 'sales_order',
        entityId: soId,
        before: { status: 'confirmed' },
        after: { status: 'invoiced', customer_invoice_id: invoice.id },
      });

      return salesRepository.getCustomerInvoiceById(client, organizationId, invoice.id);
    });
  },

  /**
   * Cancel a sales order. An invoiced order is refused: cancel the invoice
   * first, which reverses its ledger entry.
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {string} soId
   * @returns {Promise<object>}
   */
  async cancelSalesOrder(organizationId, actorUserId, soId) {
    return withTransaction(async (client) => {
      const salesOrder = await salesRepository.getSalesOrderById(client, organizationId, soId);
      if (!salesOrder) fail('Sales order not found', 404);
      if (salesOrder.status === 'cancelled') fail('Sales order is already cancelled', 409);
      if (salesOrder.status === 'invoiced') {
        fail('Cancel the customer invoice first — it has already reached the ledger', 409);
      }

      await salesRepository.updateSOStatus(client, organizationId, soId, 'cancelled', actorUserId);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'cancel',
        entityType: 'sales_order',
        entityId: soId,
        before: { status: salesOrder.status },
        after: { status: 'cancelled' },
      });

      return salesRepository.getSalesOrderById(client, organizationId, soId);
    });
  },
};

module.exports = salesOrdersService;
module.exports.computeSalesLines = computeSalesLines;
