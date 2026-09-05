/**
 * Payments Repository
 *
 * Every :id query includes AND organization_id = $2.
 *
 * THE LOCKING FUNCTIONS BELOW ARE THE POINT OF THIS FILE.
 *
 * Two payments arriving at once against the same invoice will both read
 * amount_due, both decide their allocation fits, and both write — leaving the
 * invoice overpaid and the ledger crediting more than was ever owed. Reading
 * the document with SELECT ... FOR UPDATE inside the payment transaction makes
 * the second one wait for the first to commit, so it sees the reduced balance
 * and is correctly refused.
 *
 * There is no application-level substitute for this. Checking amount_due
 * before the transaction, or after, or twice, does not help: the race is
 * between the read and the write, and only the database can close it.
 */

const { pool } = require('../config/db');

const paymentsRepository = {
  // ─── Locking reads — used ONLY inside a payment transaction ──────────────

  /**
   * Read a customer invoice and LOCK the row until the transaction ends.
   *
   * @param {object} client - MANDATORY. A lock outside a transaction is
   *   released immediately and protects nothing.
   * @param {string} organizationId
   * @param {string} invoiceId
   * @returns {Promise<object|null>}
   */
  async lockCustomerInvoice(client, organizationId, invoiceId) {
    if (!client || typeof client.query !== 'function') {
      throw new Error('lockCustomerInvoice requires an active transaction client');
    }

    const res = await client.query(
      `SELECT id, invoice_number, customer_contact_id, status,
              total_amount, amount_due, amount_paid, due_date
         FROM customer_invoices
        WHERE id = $1 AND organization_id = $2
          FOR UPDATE`,
      [invoiceId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Read a vendor bill and LOCK the row until the transaction ends.
   *
   * @param {object} client - MANDATORY.
   * @param {string} organizationId
   * @param {string} billId
   * @returns {Promise<object|null>}
   */
  async lockVendorBill(client, organizationId, billId) {
    if (!client || typeof client.query !== 'function') {
      throw new Error('lockVendorBill requires an active transaction client');
    }

    const res = await client.query(
      `SELECT id, bill_number, vendor_contact_id, status,
              total_amount, amount_due, amount_paid, due_date
         FROM vendor_bills
        WHERE id = $1 AND organization_id = $2
          FOR UPDATE`,
      [billId, organizationId]
    );
    return res.rows[0] || null;
  },

  // ─── Payments ────────────────────────────────────────────

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query] - direction, method, status, contact_id, page, limit
   * @returns {Promise<{ items: Array, meta: object }>}
   */
  async listPayments(client, organizationId, query = {}) {
    const db = client || pool;
    const { direction, method, status, contact_id, page = 1, limit = 25 } = query;
    const safeLimit = Math.min(Math.max(1, Number(limit) || 25), 100);
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;

    let where = 'WHERE p.organization_id = $1';
    const params = [organizationId];
    let idx = 2;

    if (direction) { where += ` AND p.direction = $${idx++}`; params.push(direction); }
    if (method) { where += ` AND p.method = $${idx++}`; params.push(method); }
    if (status) { where += ` AND p.status = $${idx++}`; params.push(status); }
    if (contact_id) { where += ` AND p.contact_id = $${idx++}`; params.push(contact_id); }

    const countRes = await db.query(`SELECT COUNT(*) FROM payments p ${where}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(safeLimit, offset);
    const dataRes = await db.query(
      `SELECT p.*, c.name AS contact_name, j.name AS journal_name, j.journal_type,
              a.code AS cash_account_code, a.name AS cash_account_name
         FROM payments p
         LEFT JOIN contacts c ON c.id = p.contact_id AND c.organization_id = p.organization_id
         LEFT JOIN journals j ON j.id = p.journal_id AND j.organization_id = p.organization_id
         LEFT JOIN accounts a ON a.id = p.cash_account_id AND a.organization_id = p.organization_id
         ${where}
         ORDER BY p.payment_date DESC, p.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
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
   * A payment with its allocations, each naming the document it settled.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} paymentId
   * @returns {Promise<object|null>}
   */
  async getPaymentById(client, organizationId, paymentId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT p.*, c.name AS contact_name, c.email AS contact_email,
              j.name AS journal_name, j.journal_type,
              a.code AS cash_account_code, a.name AS cash_account_name,
              je.entry_number
         FROM payments p
         LEFT JOIN contacts c ON c.id = p.contact_id AND c.organization_id = p.organization_id
         LEFT JOIN journals j ON j.id = p.journal_id AND j.organization_id = p.organization_id
         LEFT JOIN accounts a ON a.id = p.cash_account_id AND a.organization_id = p.organization_id
         LEFT JOIN journal_entries je ON je.id = p.journal_entry_id AND je.organization_id = p.organization_id
        WHERE p.id = $1 AND p.organization_id = $2`,
      [paymentId, organizationId]
    );
    if (res.rows.length === 0) return null;

    const payment = res.rows[0];
    const allocRes = await db.query(
      `SELECT pa.*,
              ci.invoice_number, ci.total_amount AS invoice_total, ci.amount_due AS invoice_due,
              vb.bill_number, vb.total_amount AS bill_total, vb.amount_due AS bill_due
         FROM payment_allocations pa
         LEFT JOIN customer_invoices ci
                ON ci.id = pa.customer_invoice_id AND ci.organization_id = pa.organization_id
         LEFT JOIN vendor_bills vb
                ON vb.id = pa.vendor_bill_id AND vb.organization_id = pa.organization_id
        WHERE pa.payment_id = $1 AND pa.organization_id = $2
        ORDER BY pa.created_at`,
      [paymentId, organizationId]
    );

    payment.allocations = allocRes.rows;
    return payment;
  },

  /**
   * @param {object} client
   * @param {object} data
   * @returns {Promise<object>}
   */
  async insertPayment(client, data) {
    const res = await client.query(
      `INSERT INTO payments (
         organization_id, payment_number, contact_id, direction, method,
         payment_date, amount, reference, notes, status,
         journal_id, journal_entry_id, cash_account_id, gateway_payment_id,
         posted_at, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'posted', $10, $11, $12, $13, NOW(), $14, $14)
       RETURNING *`,
      [
        data.organization_id, data.payment_number, data.contact_id, data.direction,
        data.method, data.payment_date, data.amount, data.reference, data.notes,
        data.journal_id, data.journal_entry_id, data.cash_account_id,
        data.gateway_payment_id || null, data.actor_user_id,
      ]
    );
    return res.rows[0];
  },

  /**
   * Insert the allocation rows in ONE statement.
   *
   * @param {object} client
   * @param {string} organizationId
   * @param {string} paymentId
   * @param {Array} allocations - [{ customer_invoice_id?, vendor_bill_id?, allocated_amount }]
   * @returns {Promise<number>}
   */
  async insertAllocations(client, organizationId, paymentId, allocations) {
    if (!allocations.length) return 0;

    const COLS = 5;
    const tuples = [];
    const values = [];

    allocations.forEach((allocation, index) => {
      const b = index * COLS;
      tuples.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`);
      values.push(
        organizationId,
        paymentId,
        allocation.customer_invoice_id || null,
        allocation.vendor_bill_id || null,
        allocation.allocated_amount
      );
    });

    const res = await client.query(
      `INSERT INTO payment_allocations (
         organization_id, payment_id, customer_invoice_id, vendor_bill_id, allocated_amount
       ) VALUES ${tuples.join(', ')}`,
      values
    );
    return res.rowCount;
  },

  /**
   * Apply an allocation to a customer invoice and roll its status forward.
   *
   * Called only while the row is locked by lockCustomerInvoice.
   *
   * @param {object} client
   * @param {string} organizationId
   * @param {string} invoiceId
   * @param {string} amountPaid - New cumulative paid, as a 2dp string.
   * @param {string} amountDue  - New outstanding, as a 2dp string.
   * @param {string} status
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async applyToCustomerInvoice(client, organizationId, invoiceId, amountPaid, amountDue, status, actorUserId) {
    const res = await client.query(
      `UPDATE customer_invoices
          SET amount_paid = $1, amount_due = $2, status = $3,
              updated_by = $4, updated_at = NOW()
        WHERE id = $5 AND organization_id = $6
        RETURNING id, invoice_number, status, amount_paid, amount_due`,
      [amountPaid, amountDue, status, actorUserId, invoiceId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * @param {object} client
   * @returns {Promise<object|null>}
   */
  async applyToVendorBill(client, organizationId, billId, amountPaid, amountDue, status, actorUserId) {
    const res = await client.query(
      `UPDATE vendor_bills
          SET amount_paid = $1, amount_due = $2, status = $3,
              updated_by = $4, updated_at = NOW()
        WHERE id = $5 AND organization_id = $6
        RETURNING id, bill_number, status, amount_paid, amount_due`,
      [amountPaid, amountDue, status, actorUserId, billId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * @param {object} client
   * @param {string} organizationId
   * @param {string} paymentId
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async markCancelled(client, organizationId, paymentId, actorUserId) {
    const res = await client.query(
      `UPDATE payments
          SET status = 'cancelled', cancelled_at = NOW(),
              updated_by = $1, updated_at = NOW()
        WHERE id = $2 AND organization_id = $3 AND status = 'posted'
        RETURNING *`,
      [actorUserId, paymentId, organizationId]
    );
    return res.rows[0] || null;
  },

  // ─── Lookups ─────────────────────────────────────────────

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} contactId
   * @returns {Promise<object|null>}
   */
  async findActiveContact(client, organizationId, contactId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, contact_type FROM contacts
        WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
      [contactId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * A journal that is active AND of one of the permitted types.
   *
   * The type check is the security requirement: a cash payment posted through
   * a bank journal credits the WRONG ASSET ACCOUNT, and nothing downstream
   * notices until someone reconciles the bank.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} journalId
   * @param {string[]} allowedTypes
   * @returns {Promise<object|null>}
   */
  async findActiveJournalOfType(client, organizationId, journalId, allowedTypes) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, journal_type, default_debit_account_id, default_credit_account_id
         FROM journals
        WHERE id = $1 AND organization_id = $2 AND status = 'active'
          AND journal_type = ANY($3::text[])`,
      [journalId, organizationId, allowedTypes]
    );
    return res.rows[0] || null;
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} accountId
   * @returns {Promise<object|null>}
   */
  async findActiveAccount(client, organizationId, accountId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, code, name, account_type FROM accounts
        WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
      [accountId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} code
   * @returns {Promise<object|null>}
   */
  async findAccountByCode(client, organizationId, code) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, code, name, account_type FROM accounts
        WHERE organization_id = $1 AND code = $2 AND status = 'active'`,
      [organizationId, code]
    );
    return res.rows[0] || null;
  },

  /**
   * Allocations belonging to a payment, for reversing them on cancellation.
   *
   * @param {object} client
   * @param {string} organizationId
   * @param {string} paymentId
   * @returns {Promise<Array>}
   */
  async findAllocations(client, organizationId, paymentId) {
    const res = await client.query(
      `SELECT * FROM payment_allocations
        WHERE payment_id = $1 AND organization_id = $2`,
      [paymentId, organizationId]
    );
    return res.rows;
  },
};

module.exports = paymentsRepository;
