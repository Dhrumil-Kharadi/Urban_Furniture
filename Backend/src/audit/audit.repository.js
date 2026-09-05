/**
 * Audit Repository
 * Scoped data access for audit trails.
 * Reference: project.md §9.2 · phase.md Phase 13
 */

const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, listResult } = require('../shared/listQuery');

const ALLOWED_SORT_COLUMNS = ['created_at', 'action', 'entity_type'];

const auditRepository = {
  /**
   * List audit logs with multi-tenant scoping and filters.
   */
  async list(client, organizationId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['a.organization_id = $1'];
    const params = [organizationId];

    if (query.entityType) {
      params.push(query.entityType);
      conditions.push(`a.entity_type = $${params.length}`);
    }

    if (query.entityId) {
      params.push(query.entityId);
      conditions.push(`a.entity_id = $${params.length}`);
    }

    if (query.action) {
      params.push(query.action);
      conditions.push(`a.action = $${params.length}`);
    }

    if (query.actorUserId) {
      params.push(query.actorUserId);
      conditions.push(`a.actor_user_id = $${params.length}`);
    }

    if (query.fromDate) {
      params.push(query.fromDate);
      conditions.push(`a.created_at >= $${params.length}`);
    }

    if (query.toDate) {
      params.push(query.toDate);
      conditions.push(`a.created_at <= $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total count
    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total
         FROM audit_logs a
         ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const orderBy = buildSort(query, ALLOWED_SORT_COLUMNS, 'created_at');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT a.id, a.organization_id, a.actor_user_id, a.action,
              a.entity_type, a.entity_id, a.before, a.after, a.ip_address,
              a.created_at,
              u.email AS actor_email,
              u.name AS actor_name
         FROM audit_logs a
         LEFT JOIN users u ON a.actor_user_id = u.id
         ${whereClause}
         ORDER BY ${orderBy}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return listResult(dataRes.rows, page, limit, total);
  },

  /**
   * Find single audit log entry by ID.
   */
  async findById(client, organizationId, id) {
    const db = client || pool;
    const res = await db.query(
      `SELECT a.*,
              u.email AS actor_email,
              u.name AS actor_name
         FROM audit_logs a
         LEFT JOIN users u ON a.actor_user_id = u.id
        WHERE a.id = $1 AND a.organization_id = $2`,
      [id, organizationId]
    );
    return res.rows[0] || null;
  },
};

module.exports = auditRepository;
