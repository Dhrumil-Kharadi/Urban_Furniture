/**
 * Notifications Repository
 *
 * Scoped data access for email notifications.
 * Reference: project.md §9.7 · phase.md Phase 13
 */

const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, listResult } = require('../shared/listQuery');

const ALLOWED_SORT_COLUMNS = ['created_at', 'status', 'recipient_email', 'trigger_event'];

const notificationsRepository = {
  /**
   * Insert notification within or outside transaction.
   */
  async insert(client, payload) {
    const db = client || pool;

    const res = await db.query(
      `INSERT INTO notifications (
         organization_id, recipient_email, subject, body_html,
         trigger_event, entity_type, entity_id, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        payload.organization_id,
        payload.recipient_email,
        payload.subject,
        payload.body_html,
        payload.trigger_event,
        payload.entity_type || null,
        payload.entity_id || null,
      ]
    );

    return res.rows[0];
  },

  /**
   * Find notification by ID.
   */
  async findById(client, id) {
    const db = client || pool;
    const res = await db.query(
      `SELECT * FROM notifications WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  },

  /**
   * Update notification status after dispatch attempt.
   */
  async updateStatus(client, id, { status, errorMessage = null }) {
    const db = client || pool;
    const isSent = status === 'sent';
    const isFailed = status === 'failed';

    const res = await db.query(
      `UPDATE notifications
          SET status = $1,
              error_message = $2,
              sent_at = CASE WHEN $4 = true THEN NOW() ELSE sent_at END,
              retry_count = CASE WHEN $5 = true THEN retry_count + 1 ELSE retry_count END,
              updated_at = NOW()
        WHERE id = $3
        RETURNING *`,
      [status, errorMessage, id, isSent, isFailed]
    );

    return res.rows[0] || null;
  },

  /**
   * Find pending or failed notifications eligible for retry.
   */
  async findRetriable(client, organizationId = null) {
    const db = client || pool;

    const conditions = ["status IN ('pending', 'failed')", 'retry_count < 3'];
    const params = [];

    if (organizationId) {
      params.push(organizationId);
      conditions.push(`organization_id = $${params.length}`);
    }

    const res = await db.query(
      `SELECT * FROM notifications
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at ASC
        LIMIT 50`,
      params
    );

    return res.rows;
  },

  /**
   * List notifications for admin view.
   */
  async list(client, organizationId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['organization_id = $1'];
    const params = [organizationId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }

    if (query.triggerEvent) {
      params.push(query.triggerEvent);
      conditions.push(`trigger_event = $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM notifications ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const orderBy = buildSort(query, ALLOWED_SORT_COLUMNS, 'created_at');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT * FROM notifications
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return listResult(dataRes.rows, page, limit, total);
  },
};

module.exports = notificationsRepository;
