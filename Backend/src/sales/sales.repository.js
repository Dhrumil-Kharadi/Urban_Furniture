/**
 * Sales Repository
 *
 * Database queries for Sales Orders and Customer Invoices.
 * EVERY :id query includes AND organization_id = $2 to ensure
 * strict multi-tenant isolation.
 */

const { pool } = require('../config/db');

const salesRepository = {
  // ─── SALES ORDERS ─────────────────────────────────────────

  /**
   * List sales orders for an organization with pagination.
   */
  async listSalesOrders(client, organizationId, query = {}) {
    const db = client || pool;
    const { status, customer_contact_id, page = 1, limit = 25 } = query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

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

    params.push(Number(limit), offset);
    const dataRes = await db.query(
      `SELECT so.*, c.name AS customer_name
         FROM sales_orders so
         LEFT JOIN contacts c ON c.id = so.customer_contact_id
         ${where}
         ORDER BY so.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      params
    );

    return {
      items: dataRes.rows,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  },

  /**
   * Get a sales order by ID with its lines, scoped by organization.
   */
  async getSalesOrderById(client, organizationId, soId) {
    const db = client || pool;
    const soRes = await db.query(
      `SELECT so.*, c.name AS customer_name, c.email AS customer_email, c.contact_type
         FROM sales_orders so
         LEFT JOIN contacts c ON c.id = so.customer_contact_id
        WHERE so.id = $1 AND so.organization_id = $2`,
      [soId, organizationId]
    );
    if (soRes.rows.length === 0) return null;

    const so = soRes.rows[0];
    const linesRes = await db.query(
      `SELECT sol.*, p.name AS product_name, p.sku AS product_sku,
              t.name AS tax_name, a.name AS income_account_name, a.code AS income_account_code,
              aa.name AS analytic_account_name
         FROM sales_order_lines sol
         LEFT JOIN products p ON p.id = sol.product_id
         LEFT JOIN taxes t ON t.id = sol.tax_id
         LEFT JOIN accounts a ON a.id = sol.income_account_id
         LEFT JOIN analytic_accounts aa ON aa.id = sol.analytic_account_id
        WHERE sol.sales_order_id = $1 AND sol.organization_id = $2
        ORDER BY sol.line_no`,
      [soId, organizationId]
    );

    so.lines = linesRes.rows;
    return so;
  },

  /**
   * Insert a sales order header.
   */
  async insertSalesOrder(client, data) {
    const res = await client.query(
      `INSERT INTO sales_orders (
        organization_id, so_number, customer_contact_id, order_date, expected_date,
        status, untaxed_amount, tax_amount, total_amount, notes,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
      RETURNING *`,
      [
        data.organization_id,
        data.so_number,
        data.customer_contact_id,
        data.order_date,
        data.expected_date || null,
        data.status || 'draft',
        data.untaxed_amount,
        data.tax_amount,
        data.total_amount,
        data.notes || null,
        data.actor_user_id,
      ]
    );
    return res.rows[0];
  },

  /**
   * Insert sales order lines in bulk.
   */
  async insertSalesOrderLines(client, organizationId, salesOrderId, lines) {
    for (const line of lines) {
      await client.query(
        `INSERT INTO sales_order_lines (
          organization_id, sales_order_id, line_no, product_id, description,
          quantity, unit_price, tax_id, tax_rate, untaxed_amount, tax_amount, total_amount,
          analytic_account_id, income_account_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          organizationId,
          salesOrderId,
          line.line_no,
          line.product_id || null,
          line.description,
          line.quantity,
          line.unit_price,
          line.tax_id || null,
          line.tax_rate,
          line.untaxed_amount,
          line.tax_amount,
          line.total_amount,
          line.analytic_account_id || null,
          line.income_account_id || null,
        ]
      );
    }
  },

  /**
   * Update a sales order header (draft only).
   */
  async updateSalesOrder(client, organizationId, soId, data) {
    const setClauses = [];
    const params = [soId, organizationId];
    let idx = 3;

    const allowedFields = [
      'customer_contact_id', 'order_date', 'expected_date', 'notes',
      'untaxed_amount', 'tax_amount', 'total_amount',
    ];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        params.push(data[field]);
      }
    }
    if (data.updated_by) {
      setClauses.push(`updated_by = $${idx++}`);
      params.push(data.updated_by);
    }
    setClauses.push('updated_at = NOW()');

    if (setClauses.length <= 1) return this.getSalesOrderById(client, organizationId, soId);

    const res = await client.query(
      `UPDATE sales_orders SET ${setClauses.join(', ')}
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * Delete all lines for a sales order.
   */
  async deleteSalesOrderLines(client, organizationId, salesOrderId) {
    await client.query(
      `DELETE FROM sales_order_lines WHERE sales_order_id = $1 AND organization_id = $2`,
      [salesOrderId, organizationId]
    );
  },

  /**
   * Update sales order status.
   */
  async updateSOStatus(client, organizationId, soId, status, actorUserId) {
    const res = await client.query(
      `UPDATE sales_orders
          SET status = $3, updated_by = $4, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING *`,
      [soId, organizationId, status, actorUserId]
    );
    return res.rows[0] || null;
  },

  // ─── CUSTOMER INVOICES ───────────────────────────────────

  /**
   * List customer invoices for an organization with pagination.
   */
  async listCustomerInvoices(client, organizationId, query = {}) {
    const db = client || pool;
    const { status, customer_contact_id, page = 1, limit = 25 } = query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

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

    const countRes = await db.query(
      `SELECT COUNT(*) FROM customer_invoices ci ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(Number(limit), offset);
    const dataRes = await db.query(
      `SELECT ci.*, c.name AS customer_name, j.name AS journal_name
         FROM customer_invoices ci
         LEFT JOIN contacts c ON c.id = ci.customer_contact_id
         LEFT JOIN journals j ON j.id = ci.journal_id
         ${where}
         ORDER BY ci.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      params
    );

    return {
      items: dataRes.rows,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  },

  /**
   * Get a customer invoice by ID with its lines, scoped by organization.
   */
  async getCustomerInvoiceById(client, organizationId, invoiceId) {
    const db = client || pool;
    const invRes = await db.query(
      `SELECT ci.*, c.name AS customer_name, c.email AS customer_email,
              j.name AS journal_name, j.journal_type
         FROM customer_invoices ci
         LEFT JOIN contacts c ON c.id = ci.customer_contact_id
         LEFT JOIN journals j ON j.id = ci.journal_id
        WHERE ci.id = $1 AND ci.organization_id = $2`,
      [invoiceId, organizationId]
    );
    if (invRes.rows.length === 0) return null;

    const invoice = invRes.rows[0];
    const linesRes = await db.query(
      `SELECT cil.*, p.name AS product_name, p.sku AS product_sku,
              t.name AS tax_name, a.name AS income_account_name, a.code AS income_account_code,
              aa.name AS analytic_account_name
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
   * Insert a customer invoice header.
   */
  async insertCustomerInvoice(client, data) {
    const res = await client.query(
      `INSERT INTO customer_invoices (
        organization_id, invoice_number, sales_order_id, customer_contact_id,
        invoice_date, due_date, status, untaxed_amount, tax_amount, total_amount,
        amount_due, amount_paid, journal_id, notes, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
      RETURNING *`,
      [
        data.organization_id,
        data.invoice_number,
        data.sales_order_id || null,
        data.customer_contact_id,
        data.invoice_date,
        data.due_date || null,
        data.status || 'draft',
        data.untaxed_amount,
        data.tax_amount,
        data.total_amount,
        data.amount_due || '0.00',
        data.amount_paid || '0.00',
        data.journal_id,
        data.notes || null,
        data.actor_user_id,
      ]
    );
    return res.rows[0];
  },

  /**
   * Insert customer invoice lines in bulk.
   */
  async insertCustomerInvoiceLines(client, organizationId, customerInvoiceId, lines) {
    for (const line of lines) {
      await client.query(
        `INSERT INTO customer_invoice_lines (
          organization_id, customer_invoice_id, line_no, product_id, description,
          quantity, unit_price, tax_id, tax_rate, untaxed_amount, tax_amount, total_amount,
          analytic_account_id, income_account_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          organizationId,
          customerInvoiceId,
          line.line_no,
          line.product_id || null,
          line.description,
          line.quantity,
          line.unit_price,
          line.tax_id || null,
          line.tax_rate,
          line.untaxed_amount,
          line.tax_amount,
          line.total_amount,
          line.analytic_account_id || null,
          line.income_account_id,
        ]
      );
    }
  },

  /**
   * Update a customer invoice header (draft only).
   */
  async updateCustomerInvoice(client, organizationId, invoiceId, data) {
    const setClauses = [];
    const params = [invoiceId, organizationId];
    let idx = 3;

    const allowedFields = [
      'customer_contact_id', 'invoice_date', 'due_date', 'notes',
      'untaxed_amount', 'tax_amount', 'total_amount', 'journal_id',
    ];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        params.push(data[field]);
      }
    }
    if (data.updated_by) {
      setClauses.push(`updated_by = $${idx++}`);
      params.push(data.updated_by);
    }
    setClauses.push('updated_at = NOW()');

    if (setClauses.length <= 1) return this.getCustomerInvoiceById(client, organizationId, invoiceId);

    const res = await client.query(
      `UPDATE customer_invoices SET ${setClauses.join(', ')}
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * Delete all lines for a customer invoice.
   */
  async deleteCustomerInvoiceLines(client, organizationId, customerInvoiceId) {
    await client.query(
      `DELETE FROM customer_invoice_lines WHERE customer_invoice_id = $1 AND organization_id = $2`,
      [customerInvoiceId, organizationId]
    );
  },

  /**
   * Update customer invoice status and optional posting fields.
   */
  async updateInvoiceStatus(client, organizationId, invoiceId, data) {
    const setClauses = ['status = $3', 'updated_by = $4', 'updated_at = NOW()'];
    const params = [invoiceId, organizationId, data.status, data.updated_by];
    let idx = 5;

    if (data.invoice_number !== undefined) {
      setClauses.push(`invoice_number = $${idx++}`);
      params.push(data.invoice_number);
    }
    if (data.journal_entry_id !== undefined) {
      setClauses.push(`journal_entry_id = $${idx++}`);
      params.push(data.journal_entry_id);
    }
    if (data.amount_due !== undefined) {
      setClauses.push(`amount_due = $${idx++}`);
      params.push(data.amount_due);
    }
    if (data.posted_at !== undefined) {
      setClauses.push(`posted_at = $${idx++}`);
      params.push(data.posted_at);
    }
    if (data.untaxed_amount !== undefined) {
      setClauses.push(`untaxed_amount = $${idx++}`);
      params.push(data.untaxed_amount);
    }
    if (data.tax_amount !== undefined) {
      setClauses.push(`tax_amount = $${idx++}`);
      params.push(data.tax_amount);
    }
    if (data.total_amount !== undefined) {
      setClauses.push(`total_amount = $${idx++}`);
      params.push(data.total_amount);
    }

    const res = await client.query(
      `UPDATE customer_invoices SET ${setClauses.join(', ')}
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      params
    );
    return res.rows[0] || null;
  },

  // ─── MASTER DATA LOOKUPS ─────────────────────────────────

  /**
   * Check if a customer contact is active and belongs to this org.
   * Contact filter is customers and "both".
   */
  async findActiveCustomer(client, organizationId, contactId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, contact_type, status, email
         FROM contacts
        WHERE id = $1 AND organization_id = $2
          AND status = 'active'
          AND contact_type IN ('customer', 'both')`,
      [contactId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Find active journal by id and organization.
   */
  async findActiveJournal(client, organizationId, journalId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, journal_type, default_debit_account_id, default_credit_account_id, status
         FROM journals
        WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
      [journalId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Find default or first active Sales journal for an organization.
   */
  async findDefaultSalesJournal(client, organizationId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, journal_type, default_debit_account_id, default_credit_account_id, status
         FROM journals
        WHERE organization_id = $1 AND journal_type = 'sales' AND status = 'active'
        ORDER BY is_system DESC, created_at ASC
        LIMIT 1`,
      [organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Find active accounts by ids and organization.
   */
  async findActiveAccounts(client, organizationId, accountIds) {
    const db = client || pool;
    if (!accountIds || accountIds.length === 0) return [];
    const res = await db.query(
      `SELECT id, code, name, account_type, status
         FROM accounts
        WHERE id = ANY($1) AND organization_id = $2 AND status = 'active'`,
      [accountIds, organizationId]
    );
    return res.rows;
  },
};

module.exports = salesRepository;
