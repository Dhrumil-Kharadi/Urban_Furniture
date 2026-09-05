const { pool } = require('../config/db');

/**
 * Audit Logging Service
 *
 * Captures all state-changing actions on financial documents and master data.
 *
 * CRITICAL RULE:
 * Must run inside the caller's transaction alongside the domain write.
 * Actor user ID MUST originate from authenticated req.user, NEVER from request bodies.
 */

const auditService = {
  /**
   * Record an audit log entry within a transaction.
   *
   * @param {object|null} client - Transaction client or null
   * @param {object} params
   * @param {string} params.organizationId - UUID of the tenant
   * @param {string|null} params.actorUserId - UUID of authenticated user performing the action
   * @param {string} params.action - e.g. 'create', 'update', 'post', 'reverse', 'archive', 'delete'
   * @param {string} params.entityType - e.g. 'invoice', 'bill', 'payment', 'product', 'contact'
   * @param {string} params.entityId - UUID of the target entity
   * @param {object|null} [params.before] - State before change
   * @param {object|null} [params.after] - State after change
   * @param {string|null} [params.ipAddress] - IP address of the client
   * @returns {Promise<object>} The created audit log record
   */
  async recordAudit(client, {
    organizationId,
    actorUserId = null,
    action,
    entityType,
    entityId,
    before = null,
    after = null,
    ipAddress = null,
  }) {
    const db = client || pool;

    if (!organizationId) {
      throw new Error('organizationId is required for audit logging');
    }
    if (!action) throw new Error('action is required for audit logging');
    if (!entityType) throw new Error('entityType is required for audit logging');
    if (!entityId) throw new Error('entityId is required for audit logging');

    const query = `
      INSERT INTO audit_logs (
        organization_id, actor_user_id, action, entity_type, entity_id,
        before, after, ip_address, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, organization_id, actor_user_id, action, entity_type, entity_id, created_at;
    `;

    const beforeJson = before !== null && typeof before === 'object' ? JSON.stringify(before) : before;
    const afterJson = after !== null && typeof after === 'object' ? JSON.stringify(after) : after;

    const values = [
      organizationId,
      actorUserId,
      action,
      entityType,
      entityId,
      beforeJson,
      afterJson,
      ipAddress,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  },
};

module.exports = auditService;
