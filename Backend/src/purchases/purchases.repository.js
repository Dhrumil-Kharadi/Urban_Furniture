/**
 * Purchases Repository
 *
 * Database queries for Purchase Orders and Vendor Bills.
 * EVERY :id query includes AND organization_id = $2 to close
 * the cross-tenant IDOR path.
 */

const { pool } = require('../config/db');

const purchasesRepository = {
  // ─── PURCHASE ORDERS ─────────────────────────────────────

  /**
   * List purchase orders for an organization with pagination.
   */
  async listPurchaseOrders(client, organizationId, query = {}) {
    const db = client || pool;
    const { status, vendor_contact_id, page = 1, limit = 25 } = query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    let where = 'WHERE po.organization_id = $1';
    const params = [organizationId];
    let paramIdx = 2;

    if (status) {
      where += ` AND po.status = $${paramIdx++}`;
      params.push(status);
    }
    if (vendor_contact_id) {
      where += ` AND po.vendor_contact_id = $${paramIdx++}`;
      params.push(vendor_contact_id);
    }

    const countRes = await db.query(
      `SELECT COUNT(*) FROM purchase_orders po ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(Number(limit), offset);
    const dataRes = await db.query(
      `SELECT po.*, c.name AS vendor_name
         FROM purchase_orders po
         LEFT JOIN contacts c ON c.id = po.vendor_contact_id
         ${where}
         ORDER BY po.created_at DESC
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
   * Get a purchase order by ID with its lines, scoped by organization.
   */
  async getPurchaseOrderById(client, organizationId, poId) {
    const db = client || pool;
    const poRes = await db.query(
      `SELECT po.*, c.name AS vendor_name, c.email AS vendor_email, c.contact_type
         FROM purchase_orders po
         LEFT JOIN contacts c ON c.id = po.vendor_contact_id
        WHERE po.id = $1 AND po.organization_id = $2`,
      [poId, organizationId]
    );
    if (poRes.rows.length === 0) return null;

    const po = poRes.rows[0];
    const linesRes = await db.query(
      `SELECT pol.*, p.name AS product_name, p.sku AS product_sku,
              t.name AS tax_name, a.name AS expense_account_name, a.code AS expense_account_code,
              aa.name AS analytic_account_name
         FROM purchase_order_lines pol
         LEFT JOIN products p ON p.id = pol.product_id
         LEFT JOIN taxes t ON t.id = pol.tax_id
         LEFT JOIN accounts a ON a.id = pol.expense_account_id
         LEFT JOIN analytic_accounts aa ON aa.id = pol.analytic_account_id
        WHERE pol.purchase_order_id = $1 AND pol.organization_id = $2
        ORDER BY pol.line_no`,
      [poId, organizationId]
    );

    po.lines = linesRes.rows;
    return po;
  },

  /**
   * Insert a purchase order header.
   */
  async insertPurchaseOrder(client, data) {
    const res = await client.query(
      `INSERT INTO purchase_orders (
        organization_id, po_number, vendor_contact_id, order_date, expected_date,
        status, untaxed_amount, tax_amount, total_amount, notes,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
      RETURNING *`,
      [
        data.organization_id,
        data.po_number,
        data.vendor_contact_id,
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
   * Insert purchase order lines in bulk.
   */
  async insertPurchaseOrderLines(client, organizationId, purchaseOrderId, lines) {
    for (const line of lines) {
      await client.query(
        `INSERT INTO purchase_order_lines (
          organization_id, purchase_order_id, line_no, product_id, description,
          quantity, unit_price, tax_id, tax_rate, untaxed_amount, tax_amount, total_amount,
          analytic_account_id, expense_account_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          organizationId,
          purchaseOrderId,
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
          line.expense_account_id || null,
        ]
      );
    }
  },

  /**
   * Update a purchase order header (draft only — caller verifies status).
   */
  async updatePurchaseOrder(client, organizationId, poId, data) {
    const setClauses = [];
    const params = [poId, organizationId];
    let idx = 3;

    const allowedFields = [
      'vendor_contact_id', 'order_date', 'expected_date', 'notes',
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

    if (setClauses.length <= 1) return this.getPurchaseOrderById(client, organizationId, poId);

    const res = await client.query(
      `UPDATE purchase_orders SET ${setClauses.join(', ')}
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * Delete all lines for a PO (used before re-insert on update).
   */
  async deletePurchaseOrderLines(client, organizationId, purchaseOrderId) {
    await client.query(
      `DELETE FROM purchase_order_lines WHERE purchase_order_id = $1 AND organization_id = $2`,
      [purchaseOrderId, organizationId]
    );
  },

  /**
   * Update PO status.
   */
  async updatePOStatus(client, organizationId, poId, status, actorUserId) {
    const res = await client.query(
      `UPDATE purchase_orders
          SET status = $3, updated_by = $4, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING *`,
      [poId, organizationId, status, actorUserId]
    );
    return res.rows[0] || null;
  },

  // ─── VENDOR BILLS ────────────────────────────────────────

  /**
   * List vendor bills for an organization with pagination.
   */
  async listVendorBills(client, organizationId, query = {}) {
    const db = client || pool;
    const { status, vendor_contact_id, page = 1, limit = 25 } = query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    let where = 'WHERE vb.organization_id = $1';
    const params = [organizationId];
    let paramIdx = 2;

    if (status) {
      where += ` AND vb.status = $${paramIdx++}`;
      params.push(status);
    }
    if (vendor_contact_id) {
      where += ` AND vb.vendor_contact_id = $${paramIdx++}`;
      params.push(vendor_contact_id);
    }

    const countRes = await db.query(
      `SELECT COUNT(*) FROM vendor_bills vb ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(Number(limit), offset);
    const dataRes = await db.query(
      `SELECT vb.*, c.name AS vendor_name, j.name AS journal_name
         FROM vendor_bills vb
         LEFT JOIN contacts c ON c.id = vb.vendor_contact_id
         LEFT JOIN journals j ON j.id = vb.journal_id
         ${where}
         ORDER BY vb.created_at DESC
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
   * Get a vendor bill by ID with its lines, scoped by organization.
   */
  async getVendorBillById(client, organizationId, billId) {
    const db = client || pool;
    const billRes = await db.query(
      `SELECT vb.*, c.name AS vendor_name, c.email AS vendor_email,
              j.name AS journal_name, j.journal_type
         FROM vendor_bills vb
         LEFT JOIN contacts c ON c.id = vb.vendor_contact_id
         LEFT JOIN journals j ON j.id = vb.journal_id
        WHERE vb.id = $1 AND vb.organization_id = $2`,
      [billId, organizationId]
    );
    if (billRes.rows.length === 0) return null;

    const bill = billRes.rows[0];
    const linesRes = await db.query(
      `SELECT vbl.*, p.name AS product_name, p.sku AS product_sku,
              t.name AS tax_name, a.name AS expense_account_name, a.code AS expense_account_code,
              aa.name AS analytic_account_name
         FROM vendor_bill_lines vbl
         LEFT JOIN products p ON p.id = vbl.product_id
         LEFT JOIN taxes t ON t.id = vbl.tax_id
         LEFT JOIN accounts a ON a.id = vbl.expense_account_id
         LEFT JOIN analytic_accounts aa ON aa.id = vbl.analytic_account_id
        WHERE vbl.vendor_bill_id = $1 AND vbl.organization_id = $2
        ORDER BY vbl.line_no`,
      [billId, organizationId]
    );

    bill.lines = linesRes.rows;
    return bill;
  },

  /**
   * Insert a vendor bill header.
   */
  async insertVendorBill(client, data) {
    const res = await client.query(
      `INSERT INTO vendor_bills (
        organization_id, bill_number, purchase_order_id, vendor_contact_id,
        bill_date, due_date, status, untaxed_amount, tax_amount, total_amount,
        amount_due, amount_paid, journal_id, notes, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
      RETURNING *`,
      [
        data.organization_id,
        data.bill_number,
        data.purchase_order_id || null,
        data.vendor_contact_id,
        data.bill_date,
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
   * Insert vendor bill lines in bulk.
   */
  async insertVendorBillLines(client, organizationId, vendorBillId, lines) {
    for (const line of lines) {
      await client.query(
        `INSERT INTO vendor_bill_lines (
          organization_id, vendor_bill_id, line_no, product_id, description,
          quantity, unit_price, tax_id, tax_rate, untaxed_amount, tax_amount, total_amount,
          analytic_account_id, expense_account_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          organizationId,
          vendorBillId,
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
          line.expense_account_id,
        ]
      );
    }
  },

  /**
   * Update a vendor bill header (draft only).
   */
  async updateVendorBill(client, organizationId, billId, data) {
    const setClauses = [];
    const params = [billId, organizationId];
    let idx = 3;

    const allowedFields = [
      'vendor_contact_id', 'bill_date', 'due_date', 'notes',
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

    if (setClauses.length <= 1) return this.getVendorBillById(client, organizationId, billId);

    const res = await client.query(
      `UPDATE vendor_bills SET ${setClauses.join(', ')}
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * Delete all lines for a bill (used before re-insert on update).
   */
  async deleteVendorBillLines(client, organizationId, vendorBillId) {
    await client.query(
      `DELETE FROM vendor_bill_lines WHERE vendor_bill_id = $1 AND organization_id = $2`,
      [vendorBillId, organizationId]
    );
  },

  /**
   * Update vendor bill status and optional posting fields.
   */
  async updateBillStatus(client, organizationId, billId, data) {
    const setClauses = ['status = $3', 'updated_by = $4', 'updated_at = NOW()'];
    const params = [billId, organizationId, data.status, data.updated_by];
    let idx = 5;

    if (data.bill_number !== undefined) {
      setClauses.push(`bill_number = $${idx++}`);
      params.push(data.bill_number);
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
      `UPDATE vendor_bills SET ${setClauses.join(', ')}
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * Check if a vendor contact is active and belongs to this org.
   */
  async findActiveVendor(client, organizationId, contactId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, contact_type, status
         FROM contacts
        WHERE id = $1 AND organization_id = $2
          AND status = 'active'
          AND contact_type IN ('vendor', 'both')`,
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

module.exports = purchasesRepository;
