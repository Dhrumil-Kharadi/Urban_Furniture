/**
 * Sales Repository
 *
 * Database queries for Sales Orders and Customer Invoices. The mirror of
 * purchases.repository.js, and deliberately the same shape so the two sides
 * stay legible together.
 *
 * EVERY :id query includes AND organization_id = $2. An id alone is never
 * trusted — that pairing is what closes the cross-tenant IDOR path, and it is
 * why a document from another tenant reads as missing rather than forbidden.
 *
 * MONEY: every amount is NUMERIC and comes back as a STRING. Nothing here
 * converts one to a Number.
 */

const { pool } = require('../config/db');

/** Line columns, with the master-data names a detail page needs. */
const SO_LINE_SELECT = `
  sol.*, p.name AS product_name, p.sku AS product_sku,
  t.name AS tax_name,
  a.name AS income_account_name, a.code AS income_account_code,
  aa.name AS analytic_account_name
`;

const INVOICE_LINE_SELECT = `
  cil.*, p.name AS product_name, p.sku AS product_sku,
  t.name AS tax_name,
  a.name AS income_account_name, a.code AS income_account_code,
  aa.name AS analytic_account_name
`;

/**
 * The derived-overdue predicate — technicalrequirement.md §7.8.
 *
 * Overdue is a QUESTION ABOUT THE ROW, not a state anything writes. Computing
 * it here means there is exactly one definition of it; a nightly job setting a
 * column would be a second definition that drifts from this one between runs.
 */
const IS_OVERDUE_SQL = `
  (ci.status IN ('posted', 'partially_paid')
   AND ci.due_date IS NOT NULL
   AND ci.due_date < CURRENT_DATE
   AND ci.amount_due > 0)
`;

const salesRepository = {
  // ─── SALES ORDERS ────────────────────────────────────────

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query] - status, customer_contact_id, page, limit
   * @returns {Promise<{ items: Array, meta: object }>}
   */
  async listSalesOrders(client, organizationId, query = {}) {
    const db = client || pool;
    const { status, customer_contact_id, page = 1, limit = 25 } = query;
    const safeLimit = Math.min(Math.max(1, Number(limit) || 25), 100);
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;

    let where = 'WHERE so.organization_id = $1';
    const params = [organizationId];
    let paramIdx = 2;

    if (status) {
      where += ` AND so.status = $${paramIdx++}`;
      params.push(status);
    }
    if (customer_contact_id) {
      where += ` AND so.customer_contact_id = $${paramIdx++}`;
      params.push(customer_contact_id);
    }

    const countRes = await db.query(
      `SELECT COUNT(*) FROM sales_orders so ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(safeLimit, offset);
    const dataRes = await db.query(
      `SELECT so.*, c.name AS customer_name
         FROM sales_orders so
         LEFT JOIN contacts c
                ON c.id = so.customer_contact_id
               AND c.organization_id = so.organization_id
         ${where}
         ORDER BY so.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      params
    );

    return {
      items: dataRes.rows,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} soId
   * @returns {Promise<object|null>}
   */
  async getSalesOrderById(client, organizationId, soId) {
    const db = client || pool;
    const soRes = await db.query(
      `SELECT so.*, c.name AS customer_name, c.email AS customer_email, c.contact_type
         FROM sales_orders so
         LEFT JOIN contacts c
                ON c.id = so.customer_contact_id
               AND c.organization_id = so.organization_id
        WHERE so.id = $1 AND so.organization_id = $2`,
      [soId, organizationId]
    );
    if (soRes.rows.length === 0) return null;

    const salesOrder = soRes.rows[0];
    const linesRes = await db.query(
      `SELECT ${SO_LINE_SELECT}
         FROM sales_order_lines sol
         LEFT JOIN products p ON p.id = sol.product_id
         LEFT JOIN taxes t ON t.id = sol.tax_id
         LEFT JOIN accounts a ON a.id = sol.income_account_id
         LEFT JOIN analytic_accounts aa ON aa.id = sol.analytic_account_id
        WHERE sol.sales_order_id = $1 AND sol.organization_id = $2
        ORDER BY sol.line_no`,
      [soId, organizationId]
    );

    salesOrder.lines = linesRes.rows;
    return salesOrder;
  },

  /**
   * @param {object} client
   * @param {object} data
   * @returns {Promise<object>}
   */
  async insertSalesOrder(client, data) {
    const res = await client.query(
      `INSERT INTO sales_orders (
         organization_id, so_number, customer_contact_id, order_date, expected_date,
         status, untaxed_amount, tax_amount, total_amount, notes, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       RETURNING *`,
      [
        data.organization_id,
        data.so_number,
        data.customer_contact_id,
        data.order_date,
        data.expected_date,
        data.status,
        data.untaxed_amount,
        data.tax_amount,
        data.total_amount,
        data.notes,
        data.actor_user_id,
      ]
    );
    return res.rows[0];
  },

  /**
   * Bulk-insert lines in ONE statement.
   *
   * The placeholder list is built from the line COUNT, never from line
   * content, so every value remains a bind parameter.
   *
   * @param {object} client
   * @param {string} organizationId
   * @param {string} salesOrderId
   * @param {Array} lines
   * @returns {Promise<number>}
   */
  async insertSalesOrderLines(client, organizationId, salesOrderId, lines) {
    if (!lines.length) return 0;

    // income_account_id is nullable here (a quote need not have decided the
    // posting account yet) but NOT NULL on an invoice line, where the ledger
    // needs somewhere to credit.
    const COLS = 14;
    const tuples = [];
    const values = [];

    lines.forEach((line, index) => {
      const b = index * COLS;
      tuples.push(
        `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, ` +
        `$${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, $${b + 12}, $${b + 13}, $${b + 14})`
      );
      values.push(
        organizationId, salesOrderId, line.line_no, line.product_id, line.description,
        line.quantity, line.unit_price, line.tax_id, line.tax_rate,
        line.untaxed_amount, line.tax_amount, line.total_amount,
        line.analytic_account_id, line.income_account_id || null
      );
    });

    const res = await client.query(
      `INSERT INTO sales_order_lines (
         organization_id, sales_order_id, line_no, product_id, description,
         quantity, unit_price, tax_id, tax_rate,
         untaxed_amount, tax_amount, total_amount, analytic_account_id, income_account_id
       ) VALUES ${tuples.join(', ')}`,
      values
    );

    return res.rowCount;
  },

  /**
   * @param {object} client
   * @param {string} organizationId
   * @param {string} soId
   * @param {object} data - Only defined keys are written.
   * @returns {Promise<object|null>}
   */
  async updateSalesOrder(client, organizationId, soId, data) {
    const editable = [
      'customer_contact_id', 'order_date', 'expected_date', 'notes',
      'untaxed_amount', 'tax_amount', 'total_amount', 'updated_by',
    ];

    const assignments = [];
    const params = [];

    for (const column of editable) {
      if (data[column] !== undefined) {
        params.push(data[column]);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    if (assignments.length === 0) return null;
    assignments.push('updated_at = NOW()');

    params.push(soId);
    const idIdx = params.length;
    params.push(organizationId);
    const orgIdx = params.length;

    const res = await client.query(
      `UPDATE sales_orders SET ${assignments.join(', ')}
        WHERE id = $${idIdx} AND organization_id = $${orgIdx}
        RETURNING *`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * @param {object} client
   * @param {string} organizationId
   * @param {string} salesOrderId
   * @returns {Promise<number>}
   */
  async deleteSalesOrderLines(client, organizationId, salesOrderId) {
    const res = await client.query(
      'DELETE FROM sales_order_lines WHERE sales_order_id = $1 AND organization_id = $2',
      [salesOrderId, organizationId]
    );
    return res.rowCount;
  },

  /**
   * @param {object} client
   * @param {string} organizationId
   * @param {string} soId
   * @param {string} status
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async updateSOStatus(client, organizationId, soId, status, actorUserId) {
    const res = await client.query(
      `UPDATE sales_orders
          SET status = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING *`,
      [status, actorUserId, soId, organizationId]
    );
    return res.rows[0] || null;
  },

  // ─── CUSTOMER INVOICES ───────────────────────────────────

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query] - status, customer_contact_id, overdue, page, limit
   * @returns {Promise<{ items: Array, meta: object }>}
   */
  async listCustomerInvoices(client, organizationId, query = {}) {
    const db = client || pool;
    const { status, customer_contact_id, overdue, page = 1, limit = 25 } = query;
    const safeLimit = Math.min(Math.max(1, Number(limit) || 25), 100);
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;

    let where = 'WHERE ci.organization_id = $1';
    const params = [organizationId];
    let paramIdx = 2;

    if (status) {
      where += ` AND ci.status = $${paramIdx++}`;
      params.push(status);
    }
    if (customer_contact_id) {
      where += ` AND ci.customer_contact_id = $${paramIdx++}`;
      params.push(customer_contact_id);
    }
    // Filtered SQL-side from the same predicate the computed field uses, so
    // the list and the badge can never disagree.
    if (overdue === true || overdue === 'true') {
      where += ` AND ${IS_OVERDUE_SQL}`;
    }

    const countRes = await db.query(
      `SELECT COUNT(*) FROM customer_invoices ci ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(safeLimit, offset);
    const dataRes = await db.query(
      `SELECT ci.*, c.name AS customer_name, ${IS_OVERDUE_SQL} AS is_overdue
         FROM customer_invoices ci
         LEFT JOIN contacts c
                ON c.id = ci.customer_contact_id
               AND c.organization_id = ci.organization_id
         ${where}
         ORDER BY ci.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      params
    );

    return {
      items: dataRes.rows,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} invoiceId
   * @returns {Promise<object|null>}
   */
  async getCustomerInvoiceById(client, organizationId, invoiceId) {
    const db = client || pool;
    const invRes = await db.query(
      `SELECT ci.*, c.name AS customer_name, c.email AS customer_email,
              c.contact_type, c.portal_access_enabled,
              so.so_number,
              ${IS_OVERDUE_SQL} AS is_overdue
         FROM customer_invoices ci
         LEFT JOIN contacts c
                ON c.id = ci.customer_contact_id
               AND c.organization_id = ci.organization_id
         LEFT JOIN sales_orders so
                ON so.id = ci.sales_order_id
               AND so.organization_id = ci.organization_id
        WHERE ci.id = $1 AND ci.organization_id = $2`,
      [invoiceId, organizationId]
    );
    if (invRes.rows.length === 0) return null;

    const invoice = invRes.rows[0];
    const linesRes = await db.query(
      `SELECT ${INVOICE_LINE_SELECT}
         FROM customer_invoice_lines cil
         LEFT JOIN products p ON p.id = cil.product_id
         LEFT JOIN taxes t ON t.id = cil.tax_id
         LEFT JOIN accounts a ON a.id = cil.income_account_id
         LEFT JOIN analytic_accounts aa ON aa.id = cil.analytic_account_id
        WHERE cil.customer_invoice_id = $1 AND cil.organization_id = $2
        ORDER BY cil.line_no`,
      [invoiceId, organizationId]
    );

    invoice.lines = linesRes.rows;
    return invoice;
  },

  /**
   * @param {object} client
   * @param {object} data
   * @returns {Promise<object>}
   */
  async insertCustomerInvoice(client, data) {
    const res = await client.query(
      `INSERT INTO customer_invoices (
         organization_id, invoice_number, sales_order_id, customer_contact_id,
         invoice_date, due_date, status, untaxed_amount, tax_amount, total_amount,
         amount_due, amount_paid, journal_id, notes, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
       RETURNING *`,
      [
        data.organization_id,
        data.invoice_number,
        data.sales_order_id,
        data.customer_contact_id,
        data.invoice_date,
        data.due_date,
        data.status,
        data.untaxed_amount,
        data.tax_amount,
        data.total_amount,
        data.amount_due,
        data.amount_paid,
        data.journal_id,
        data.notes,
        data.actor_user_id,
      ]
    );
    return res.rows[0];
  },

  /**
   * @param {object} client
   * @param {string} organizationId
   * @param {string} invoiceId
   * @param {Array} lines
   * @returns {Promise<number>}
   */
  async insertCustomerInvoiceLines(client, organizationId, invoiceId, lines) {
    if (!lines.length) return 0;

    const COLS = 14;
    const tuples = [];
    const values = [];

    lines.forEach((line, index) => {
      const b = index * COLS;
      tuples.push(
        `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, ` +
        `$${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, $${b + 12}, $${b + 13}, $${b + 14})`
      );
      values.push(
        organizationId, invoiceId, line.line_no, line.product_id, line.description,
        line.quantity, line.unit_price, line.tax_id, line.tax_rate,
        line.untaxed_amount, line.tax_amount, line.total_amount,
        line.analytic_account_id, line.income_account_id
      );
    });

    const res = await client.query(
      `INSERT INTO customer_invoice_lines (
         organization_id, customer_invoice_id, line_no, product_id, description,
         quantity, unit_price, tax_id, tax_rate,
         untaxed_amount, tax_amount, total_amount, analytic_account_id, income_account_id
       ) VALUES ${tuples.join(', ')}`,
      values
    );
    return res.rowCount;
  },

  /**
   * @param {object} client
   * @param {string} organizationId
   * @param {string} invoiceId
   * @param {object} data
   * @returns {Promise<object|null>}
   */
  async updateCustomerInvoice(client, organizationId, invoiceId, data) {
    const editable = [
      'customer_contact_id', 'invoice_date', 'due_date', 'notes', 'journal_id',
      'untaxed_amount', 'tax_amount', 'total_amount', 'updated_by',
    ];

    const assignments = [];
    const params = [];

    for (const column of editable) {
      if (data[column] !== undefined) {
        params.push(data[column]);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    if (assignments.length === 0) return null;
    assignments.push('updated_at = NOW()');

    params.push(invoiceId);
    const idIdx = params.length;
    params.push(organizationId);
    const orgIdx = params.length;

    const res = await client.query(
      `UPDATE customer_invoices SET ${assignments.join(', ')}
        WHERE id = $${idIdx} AND organization_id = $${orgIdx}
        RETURNING *`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * @param {object} client
   * @param {string} organizationId
   * @param {string} invoiceId
   * @returns {Promise<number>}
   */
  async deleteCustomerInvoiceLines(client, organizationId, invoiceId) {
    const res = await client.query(
      'DELETE FROM customer_invoice_lines WHERE customer_invoice_id = $1 AND organization_id = $2',
      [invoiceId, organizationId]
    );
    return res.rowCount;
  },

  /**
   * @param {object} client
   * @param {string} organizationId
   * @param {string} invoiceId
   * @param {object} data
   * @returns {Promise<object|null>}
   */
  async updateInvoiceStatus(client, organizationId, invoiceId, data) {
    const editable = [
      'status', 'invoice_number', 'journal_entry_id', 'amount_due', 'amount_paid',
      'posted_at', 'sent_at', 'untaxed_amount', 'tax_amount', 'total_amount', 'updated_by',
    ];

    const assignments = [];
    const params = [];

    for (const column of editable) {
      if (data[column] !== undefined) {
        params.push(data[column]);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    if (assignments.length === 0) return null;
    assignments.push('updated_at = NOW()');

    params.push(invoiceId);
    const idIdx = params.length;
    params.push(organizationId);
    const orgIdx = params.length;

    const res = await client.query(
      `UPDATE customer_invoices SET ${assignments.join(', ')}
        WHERE id = $${idIdx} AND organization_id = $${orgIdx}
        RETURNING *`,
      params
    );
    return res.rows[0] || null;
  },

  // ─── Shared lookups ──────────────────────────────────────

  /**
   * A contact who can be sold to: a customer or a 'both'.
   *
   * project.md §4.1 — a vendor-only contact must not appear on a sales
   * document, which is the sales-side mirror of the vendor check.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} contactId
   * @returns {Promise<object|null>}
   */
  async findActiveCustomer(client, organizationId, contactId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, email, contact_type, portal_access_enabled
         FROM contacts
        WHERE id = $1 AND organization_id = $2
          AND status = 'active'
          AND contact_type IN ('customer', 'both')`,
      [contactId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} journalId
   * @param {string[]} [allowedTypes] - Restrict to these journal types.
   * @returns {Promise<object|null>}
   */
  async findActiveJournal(client, organizationId, journalId, allowedTypes = null) {
    const db = client || pool;
    const params = [journalId, organizationId];
    let typeClause = '';

    if (allowedTypes && allowedTypes.length) {
      params.push(allowedTypes);
      typeClause = ` AND journal_type = ANY($${params.length}::text[])`;
    }

    const res = await db.query(
      `SELECT id, name, journal_type
         FROM journals
        WHERE id = $1 AND organization_id = $2 AND status = 'active'${typeClause}`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string[]} accountIds
   * @returns {Promise<Array>}
   */
  async findActiveAccounts(client, organizationId, accountIds) {
    const db = client || pool;
    if (!accountIds.length) return [];

    const res = await db.query(
      `SELECT id, code, name, account_type
         FROM accounts
        WHERE organization_id = $1 AND status = 'active' AND id = ANY($2::uuid[])`,
      [organizationId, accountIds]
    );
    return res.rows;
  },

  /**
   * Find an active system account by its code — Debtors, Output Tax Payable.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} code
   * @returns {Promise<object|null>}
   */
  async findAccountByCode(client, organizationId, code) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, code, name, account_type
         FROM accounts
        WHERE organization_id = $1 AND code = $2 AND status = 'active'`,
      [organizationId, code]
    );
    return res.rows[0] || null;
  },
};

module.exports = salesRepository;
module.exports.IS_OVERDUE_SQL = IS_OVERDUE_SQL;
