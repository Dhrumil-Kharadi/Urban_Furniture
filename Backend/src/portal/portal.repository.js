/**
 * Portal Repository
 *
 * Scopes EVERY query by organization_id AND contact_id derived from req.user.
 * Cross-tenant or foreign contact access returns no rows (404).
 * Reference: project.md §5.3 · technicalrequirement.md §6.12
 */

const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, listResult } = require('../shared/listQuery');

const INVOICE_SORT_COLUMNS = ['invoice_date', 'due_date', 'total_amount', 'amount_due', 'status', 'created_at'];
const BILL_SORT_COLUMNS = ['bill_date', 'due_date', 'total_amount', 'amount_due', 'status', 'created_at'];

const portalRepository = {
  /**
   * Summary KPI figures for customer portal.
   */
  async getCustomerSummary(client, organizationId, contactId) {
    const db = client || pool;

    const statsRes = await db.query(
      `SELECT
         COALESCE(SUM(amount_due), 0) AS total_outstanding,
         COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN amount_due ELSE 0 END), 0) AS total_overdue,
         COUNT(CASE WHEN amount_due > 0 THEN 1 END)::integer AS unpaid_count
        FROM customer_invoices
       WHERE organization_id = $1
         AND customer_contact_id = $2
         AND status IN ('posted', 'partially_paid')`,
      [organizationId, contactId]
    );

    const paidRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid_this_year
         FROM payments
        WHERE organization_id = $1
          AND contact_id = $2
          AND status = 'posted'
          AND payment_type = 'inbound'
          AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [organizationId, contactId]
    );

    const recentRes = await db.query(
      `SELECT id, invoice_number, invoice_date, due_date, total_amount, amount_due, status
         FROM customer_invoices
        WHERE organization_id = $1 AND customer_contact_id = $2
        ORDER BY invoice_date DESC, created_at DESC
        LIMIT 5`,
      [organizationId, contactId]
    );

    return {
      totalOutstanding: statsRes.rows[0]?.total_outstanding || '0.00',
      totalOverdue: statsRes.rows[0]?.total_overdue || '0.00',
      unpaidCount: statsRes.rows[0]?.unpaid_count || 0,
      paidThisYear: paidRes.rows[0]?.paid_this_year || '0.00',
      recentDocuments: recentRes.rows,
    };
  },

  /**
   * Summary KPI figures for vendor portal.
   */
  async getVendorSummary(client, organizationId, contactId) {
    const db = client || pool;

    const statsRes = await db.query(
      `SELECT
         COALESCE(SUM(amount_due), 0) AS total_payable,
         COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN amount_due ELSE 0 END), 0) AS total_overdue,
         COUNT(CASE WHEN amount_due > 0 THEN 1 END)::integer AS unpaid_count
        FROM vendor_bills
       WHERE organization_id = $1
         AND vendor_contact_id = $2
         AND status IN ('posted', 'partially_paid')`,
      [organizationId, contactId]
    );

    const receivedRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid_this_year
         FROM payments
        WHERE organization_id = $1
          AND contact_id = $2
          AND status = 'posted'
          AND payment_type = 'outbound'
          AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [organizationId, contactId]
    );

    const recentRes = await db.query(
      `SELECT id, bill_number, vendor_reference, bill_date, due_date, total_amount, amount_due, status
         FROM vendor_bills
        WHERE organization_id = $1 AND vendor_contact_id = $2
        ORDER BY bill_date DESC, created_at DESC
        LIMIT 5`,
      [organizationId, contactId]
    );

    return {
      totalOutstanding: statsRes.rows[0]?.total_payable || '0.00',
      totalOverdue: statsRes.rows[0]?.total_overdue || '0.00',
      unpaidCount: statsRes.rows[0]?.unpaid_count || 0,
      paidThisYear: receivedRes.rows[0]?.paid_this_year || '0.00',
      recentDocuments: recentRes.rows,
    };
  },

  /**
   * List customer's own invoices.
   */
  async listInvoices(client, organizationId, contactId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['organization_id = $1', 'customer_contact_id = $2'];
    const params = [organizationId, contactId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }

    if (query.dateFrom) {
      params.push(query.dateFrom);
      conditions.push(`invoice_date >= $${params.length}`);
    }

    if (query.dateTo) {
      params.push(query.dateTo);
      conditions.push(`invoice_date <= $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM customer_invoices ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const sortParams = query.sortBy ? query : { ...query, sortBy: 'invoice_date', sortOrder: 'desc' };
    const orderBy = buildSort(sortParams, INVOICE_SORT_COLUMNS, 'invoice_date');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT id, invoice_number, invoice_date, due_date,
              untaxed_amount, tax_amount, total_amount, amount_paid, amount_due,
              status, posted_at, created_at
         FROM customer_invoices
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return listResult(dataRes.rows, page, limit, total);
  },

  /**
   * Single invoice detail with lines.
   */
  async findInvoiceById(client, organizationId, contactId, invoiceId) {
    const db = client || pool;

    const invoiceRes = await db.query(
      `SELECT i.*,
              c.name AS customer_name,
              c.email AS customer_email,
              c.mobile AS customer_mobile,
              c.city AS customer_city,
              c.state AS customer_state,
              c.pincode AS customer_pincode
         FROM customer_invoices i
         JOIN contacts c ON c.id = i.customer_contact_id AND c.organization_id = i.organization_id
        WHERE i.id = $1 AND i.organization_id = $2 AND i.customer_contact_id = $3`,
      [invoiceId, organizationId, contactId]
    );

    const invoice = invoiceRes.rows[0];
    if (!invoice) return null;

    const linesRes = await db.query(
      `SELECT l.*,
              p.name AS product_name,
              p.sku AS product_sku
         FROM customer_invoice_lines l
         LEFT JOIN products p ON p.id = l.product_id
        WHERE l.customer_invoice_id = $1
        ORDER BY l.line_no ASC`,
      [invoiceId]
    );

    invoice.lines = linesRes.rows;
    return invoice;
  },

  /**
   * Lock invoice with FOR UPDATE for card payment.
   * All three conditions guaranteed: id=$1, organization_id=$2, customer_contact_id=$3.
   */
  async findInvoiceForUpdate(client, organizationId, contactId, invoiceId) {
    const res = await client.query(
      `SELECT i.*,
              c.name AS customer_name
         FROM customer_invoices i
         JOIN contacts c ON c.id = i.customer_contact_id AND c.organization_id = i.organization_id
        WHERE i.id = $1 AND i.organization_id = $2 AND i.customer_contact_id = $3
          FOR UPDATE;`,
      [invoiceId, organizationId, contactId]
    );
    return res.rows[0] || null;
  },

  /**
   * List vendor's own bills (historical statement).
   */
  async listBills(client, organizationId, contactId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['organization_id = $1', 'vendor_contact_id = $2'];
    const params = [organizationId, contactId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }

    if (query.dateFrom) {
      params.push(query.dateFrom);
      conditions.push(`bill_date >= $${params.length}`);
    }

    if (query.dateTo) {
      params.push(query.dateTo);
      conditions.push(`bill_date <= $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM vendor_bills ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const sortParams = query.sortBy ? query : { ...query, sortBy: 'bill_date', sortOrder: 'desc' };
    const orderBy = buildSort(sortParams, BILL_SORT_COLUMNS, 'bill_date');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT id, bill_number, notes, bill_date, due_date,
              untaxed_amount, tax_amount, total_amount, amount_paid, amount_due,
              status, posted_at, created_at
         FROM vendor_bills
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return listResult(dataRes.rows, page, limit, total);
  },

  /**
   * Find payment by gateway payment id for idempotency check.
   */
  async findPaymentByGatewayId(client, organizationId, gatewayPaymentId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, payment_number, amount, status
         FROM payments
        WHERE organization_id = $1 AND gateway_payment_id = $2`,
      [organizationId, gatewayPaymentId]
    );
    return res.rows[0] || null;
  },

  /**
   * Insert a payment row.
   */
  async insertPayment(client, payload) {
    const res = await client.query(
      `INSERT INTO payments (
         organization_id, payment_number, payment_type, contact_id,
         payment_method, journal_id, payment_date, amount, status,
         journal_entry_id, gateway_provider, gateway_payment_id,
         gateway_order_id, gateway_signature, gateway_status, notes,
         created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
       RETURNING id, payment_number, amount, status, payment_date`,
      [
        payload.organization_id,
        payload.payment_number,
        payload.payment_type,
        payload.contact_id,
        payload.payment_method,
        payload.journal_id,
        payload.payment_date,
        payload.amount,
        payload.status || 'posted',
        payload.journal_entry_id,
        payload.gateway_provider,
        payload.gateway_payment_id,
        payload.gateway_order_id,
        payload.gateway_signature,
        payload.gateway_status || 'captured',
        payload.notes,
        payload.actor_user_id,
      ]
    );
    return res.rows[0];
  },

  /**
   * Insert allocation linking payment to invoice.
   */
  async insertAllocation(client, payload) {
    const res = await client.query(
      `INSERT INTO payment_allocations (
         organization_id, payment_id, invoice_id, bill_id, allocated_amount
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, payment_id, allocated_amount`,
      [
        payload.organization_id,
        payload.payment_id,
        payload.invoice_id || null,
        payload.bill_id || null,
        payload.allocated_amount,
      ]
    );
    return res.rows[0];
  },

  /**
   * Update invoice balances and status.
   */
  async updateInvoicePaidAmount(client, organizationId, invoiceId, amountPaid, amountDue, status, actorUserId) {
    const res = await client.query(
      `UPDATE customer_invoices
          SET amount_paid = $1,
              amount_due = $2,
              status = $3,
              updated_by = $4,
              updated_at = NOW()
        WHERE id = $5 AND organization_id = $6
        RETURNING id, invoice_number, amount_paid, amount_due, status`,
      [amountPaid, amountDue, status, actorUserId, invoiceId, organizationId]
    );
    return res.rows[0];
  },

  /**
   * Find clearing and debtors accounts for card payment posting.
   */
  async findPostingAccounts(client, organizationId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, code, name, account_type
         FROM accounts
        WHERE organization_id = $1
          AND (code IN ('1050', '1030', '1200') OR name ILIKE '%Clearing%' OR name ILIKE '%Debtors%')
          AND status = 'active'`,
      [organizationId]
    );
    return res.rows;
  },

  /**
   * Find active bank or general journal.
   */
  async findPaymentJournal(client, organizationId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, journal_type
         FROM journals
        WHERE organization_id = $1
          AND journal_type IN ('bank', 'general')
          AND status = 'active'
        ORDER BY CASE WHEN journal_type = 'bank' THEN 1 ELSE 2 END
        LIMIT 1`,
      [organizationId]
    );
    return res.rows[0] || null;
  },
};

module.exports = portalRepository;
