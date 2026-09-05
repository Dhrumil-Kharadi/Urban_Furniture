const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, searchTerm, listResult } = require('../shared/listQuery');

/**
 * Taxes Repository
 *
 * Parameterised SQL only. Every statement is scoped by organization_id, and
 * every single-row lookup matches on both id and organization_id.
 *
 * RATE: NUMERIC(7,4) comes back from node-postgres as a STRING and is passed
 * through untouched.
 */

const ALLOWED_SORT_COLUMNS = ['name', 'rate', 'tax_scope', 'status', 'created_at', 'updated_at'];

const SELECT_COLUMNS = `
  t.id, t.organization_id, t.name, t.rate, t.tax_scope, t.tax_account_id,
  t.status, t.created_by, t.updated_by, t.created_at, t.updated_at
`;

const taxesRepository = {
  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query]
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async list(client, organizationId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['t.organization_id = $1'];
    const params = [organizationId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`t.status = $${params.length}`);
    }

    if (query.scope) {
      // A tax scoped to 'both' applies on either side, so filtering for sales
      // must also return it — otherwise the sales picker hides half the rates.
      params.push(query.scope);
      conditions.push(`(t.tax_scope = $${params.length} OR t.tax_scope = 'both')`);
    }

    const search = searchTerm(query);
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`t.name ILIKE $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM taxes t ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const orderBy = buildSort(query, ALLOWED_SORT_COLUMNS, 'name').replace(/^"/, 't."');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT ${SELECT_COLUMNS}, a.name AS tax_account_name, a.code AS tax_account_code
         FROM taxes t
         LEFT JOIN accounts a
                ON a.id = t.tax_account_id
               AND a.organization_id = t.organization_id
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
   * @param {string} taxId
   * @returns {Promise<object|null>}
   */
  async findByIdAndOrg(client, organizationId, taxId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT ${SELECT_COLUMNS}, a.name AS tax_account_name, a.code AS tax_account_code
         FROM taxes t
         LEFT JOIN accounts a
                ON a.id = t.tax_account_id
               AND a.organization_id = t.organization_id
        WHERE t.id = $1 AND t.organization_id = $2`,
      [taxId, organizationId]
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
    let sql = `SELECT id, name FROM taxes
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
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async insert(client, payload) {
    const db = client || pool;
    const res = await db.query(
      `INSERT INTO taxes (
         organization_id, name, rate, tax_scope, tax_account_id, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id`,
      [
        payload.organization_id,
        payload.name,
        payload.rate,
        payload.tax_scope,
        payload.tax_account_id,
        payload.actor_user_id,
      ]
    );

    return taxesRepository.findByIdAndOrg(db, payload.organization_id, res.rows[0].id);
  },

  /**
   * The SET list is built from a fixed whitelist of column names, so no
   * request value ever reaches the SQL text.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} taxId
   * @param {object} fields
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async update(client, organizationId, taxId, fields, actorUserId) {
    const db = client || pool;
    const editable = ['name', 'rate', 'tax_scope', 'tax_account_id'];

    const assignments = [];
    const params = [];

    for (const column of editable) {
      if (fields[column] !== undefined) {
        params.push(fields[column]);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    if (assignments.length === 0) {
      return taxesRepository.findByIdAndOrg(db, organizationId, taxId);
    }

    params.push(actorUserId);
    assignments.push(`updated_by = $${params.length}`);
    assignments.push('updated_at = NOW()');

    params.push(taxId);
    const idIdx = params.length;
    params.push(organizationId);
    const orgIdx = params.length;

    const res = await db.query(
      `UPDATE taxes
          SET ${assignments.join(', ')}
        WHERE id = $${idIdx} AND organization_id = $${orgIdx}
        RETURNING id`,
      params
    );

    if (res.rowCount === 0) return null;
    return taxesRepository.findByIdAndOrg(db, organizationId, taxId);
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} taxId
   * @param {string} status
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async setStatus(client, organizationId, taxId, status, actorUserId) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE taxes
          SET status = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING id`,
      [status, actorUserId, taxId, organizationId]
    );

    if (res.rowCount === 0) return null;
    return taxesRepository.findByIdAndOrg(db, organizationId, taxId);
  },
};

module.exports = taxesRepository;
