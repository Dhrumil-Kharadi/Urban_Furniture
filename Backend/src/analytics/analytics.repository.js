const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, searchTerm, listResult } = require('../shared/listQuery');

/**
 * Analytic Accounts Repository
 *
 * Parameterised SQL only. Every statement is scoped by organization_id, and
 * every single-row lookup matches on both id and organization_id.
 */

const ALLOWED_SORT_COLUMNS = ['name', 'code', 'analytic_type', 'department', 'status', 'created_at', 'updated_at'];

const SELECT_COLUMNS = `
  id, organization_id, code, name, analytic_type, department, status,
  created_by, updated_by, created_at, updated_at
`;

const analyticsRepository = {
  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query]
   * @returns {Promise<{ items: Array, pagination: object }>}
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

    if (query.type) {
      params.push(query.type);
      conditions.push(`analytic_type = $${params.length}`);
    }

    const search = searchTerm(query);
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(name ILIKE $${idx} OR code ILIKE $${idx} OR department ILIKE $${idx})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM analytic_accounts ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const orderBy = buildSort(query, ALLOWED_SORT_COLUMNS, 'name');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT ${SELECT_COLUMNS}
         FROM analytic_accounts
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return listResult(dataRes.rows, page, limit, total);
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} analyticId
   * @returns {Promise<object|null>}
   */
  async findByIdAndOrg(client, organizationId, analyticId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT ${SELECT_COLUMNS}
         FROM analytic_accounts
        WHERE id = $1 AND organization_id = $2`,
      [analyticId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} name
   * @param {string|null} [excludeId]
   * @returns {Promise<object|null>}
   */
  async findByName(client, organizationId, name, excludeId = null) {
    const db = client || pool;
    const params = [organizationId, name];
    let sql = `SELECT id, name FROM analytic_accounts
                WHERE organization_id = $1 AND lower(name) = lower($2)`;

    if (excludeId) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }

    const res = await db.query(`${sql} LIMIT 1`, params);
    return res.rows[0] || null;
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} code
   * @param {string|null} [excludeId]
   * @returns {Promise<object|null>}
   */
  async findByCode(client, organizationId, code, excludeId = null) {
    const db = client || pool;
    const params = [organizationId, code];
    let sql = `SELECT id, code FROM analytic_accounts
                WHERE organization_id = $1 AND code = $2`;

    if (excludeId) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }

    const res = await db.query(`${sql} LIMIT 1`, params);
    return res.rows[0] || null;
  },

  /**
   * @param {object|null} client
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async insert(client, payload) {
    const db = client || pool;
    const res = await db.query(
      `INSERT INTO analytic_accounts (
         organization_id, code, name, analytic_type, department, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING ${SELECT_COLUMNS}`,
      [
        payload.organization_id,
        payload.code,
        payload.name,
        payload.analytic_type,
        payload.department,
        payload.actor_user_id,
      ]
    );
    return res.rows[0];
  },

  /**
   * The SET list is built from a fixed whitelist of column names, so no
   * request value ever reaches the SQL text.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} analyticId
   * @param {object} fields
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async update(client, organizationId, analyticId, fields, actorUserId) {
    const db = client || pool;
    const editable = ['code', 'name', 'analytic_type', 'department'];

    const assignments = [];
    const params = [];

    for (const column of editable) {
      if (fields[column] !== undefined) {
        params.push(fields[column]);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    if (assignments.length === 0) {
      return analyticsRepository.findByIdAndOrg(db, organizationId, analyticId);
    }

    params.push(actorUserId);
    assignments.push(`updated_by = $${params.length}`);
    assignments.push('updated_at = NOW()');

    params.push(analyticId);
    const idIdx = params.length;
    params.push(organizationId);
    const orgIdx = params.length;

    const res = await db.query(
      `UPDATE analytic_accounts
          SET ${assignments.join(', ')}
        WHERE id = $${idIdx} AND organization_id = $${orgIdx}
        RETURNING ${SELECT_COLUMNS}`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} analyticId
   * @param {string} status
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async setStatus(client, organizationId, analyticId, status, actorUserId) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE analytic_accounts
          SET status = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING ${SELECT_COLUMNS}`,
      [status, actorUserId, analyticId, organizationId]
    );
    return res.rows[0] || null;
  },
};

module.exports = analyticsRepository;
