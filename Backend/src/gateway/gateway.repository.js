/**
 * Payment Gateway Repository
 *
 * The lookups the gateway needs that no other module owns. Everything is
 * scoped by organization_id, and the invoice lookup is additionally scoped by
 * CONTACT when the caller is a portal user — a customer must not be able to
 * pay, or even price, somebody else's invoice.
 */

const { pool } = require('../config/db');

const gatewayRepository = {
  /**
   * The contact record behind a portal login.
   *
   * auth.middleware does not put contact_id on req.user, so it is read here
   * rather than widening that middleware for one caller.
   *
   * @param {object|null} client
   * @param {string} userId
   * @param {string} organizationId
   * @returns {Promise<string|null>} The contact id, or null for staff.
   */
  async findContactIdForUser(client, userId, organizationId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT contact_id FROM users
        WHERE id = $1 AND organization_id = $2`,
      [userId, organizationId]
    );
    return res.rows[0]?.contact_id || null;
  },

  /**
   * An invoice that may legitimately be paid online.
   *
   * `contactId` narrows the lookup when the caller is a portal user. Passing
   * it means a mismatched invoice returns nothing at all, so the caller gets
   * a 404 and learns nothing about whether the id exists in another account.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} invoiceId
   * @param {string|null} [contactId]
   * @returns {Promise<object|null>}
   */
  async findPayableInvoice(client, organizationId, invoiceId, contactId = null) {
    const db = client || pool;
    const params = [invoiceId, organizationId];
    let contactClause = '';

    if (contactId) {
      params.push(contactId);
      contactClause = ` AND ci.customer_contact_id = $${params.length}`;
    }

    const res = await db.query(
      `SELECT ci.id, ci.invoice_number, ci.customer_contact_id, ci.status,
              ci.total_amount, ci.amount_due, ci.amount_paid
         FROM customer_invoices ci
        WHERE ci.id = $1 AND ci.organization_id = $2${contactClause}`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * Find an invoice for public payment without session org scoping.
   *
   * @param {object|null} client
   * @param {string} invoiceId
   * @returns {Promise<object|null>}
   */
  async findPublicPayableInvoice(client, invoiceId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT ci.id, ci.organization_id, ci.invoice_number, ci.customer_contact_id, ci.status,
              ci.total_amount, ci.amount_due, ci.amount_paid
         FROM customer_invoices ci
        WHERE ci.id = $1`,
      [invoiceId]
    );
    return res.rows[0] || null;
  },

  /**
   * A payment already recorded for this gateway payment id.
   *
   * The idempotency key. Razorpay retries, a user double-clicking, and a
   * webhook arriving alongside the browser callback all produce the same
   * payment id twice — recording it twice would credit the customer twice.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} gatewayPaymentId
   * @returns {Promise<object|null>}
   */
  async findPaymentByGatewayId(client, organizationId, gatewayPaymentId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, payment_number, amount, status, journal_entry_id
         FROM payments
        WHERE organization_id = $1 AND gateway_payment_id = $2`,
      [organizationId, gatewayPaymentId]
    );
    return res.rows[0] || null;
  },

  /**
   * The active account for a code — Payment Gateway Clearing is 1050.
   *
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
   * An active journal of a given type, for posting the gateway receipt.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} journalType
   * @returns {Promise<object|null>}
   */
  async findActiveJournalOfType(client, organizationId, journalType) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, journal_type FROM journals
        WHERE organization_id = $1 AND journal_type = $2 AND status = 'active'
        ORDER BY created_at
        LIMIT 1`,
      [organizationId, journalType]
    );
    return res.rows[0] || null;
  },
};

module.exports = gatewayRepository;
