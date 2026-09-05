const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, searchTerm, listResult } = require('../shared/listQuery');

/**
 * Product Categories Repository
 *
 * Parameterised SQL only. Every statement is scoped by organization_id, and
 * every single-row lookup matches on both id and organization_id.
 */

const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'name', 'status'];

const SELECT_COLUMNS = `
  id, organization_id, name, description, status,
  created_by, updated_by, created_at, updated_at
`;

const productCategoriesRepository = {
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

    const search = searchTerm(query);
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM product_categories ${whereClause}`,
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
         FROM product_categories
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
   * @param {string} categoryId
   * @returns {Promise<object|null>}
   */
  async findByIdAndOrg(client, organizationId, categoryId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT ${SELECT_COLUMNS}
         FROM product_categories
        WHERE id = $1 AND organization_id = $2`,
      [categoryId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Case-insensitive name lookup within the organization.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} name
   * @param {string|null} [excludeId]
   * @returns {Promise<object|null>}
   */
  async findByName(client, organizationId, name, excludeId = null) {
    const db = client || pool;
    const params = [organizationId, name];
    let sql = `SELECT id, name FROM product_categories
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
      `INSERT INTO product_categories (organization_id, name, description, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING ${SELECT_COLUMNS}`,
      [payload.organization_id, payload.name, payload.description, payload.actor_user_id]
    );
    return res.rows[0];
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} categoryId
   * @param {object} fields
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async update(client, organizationId, categoryId, fields, actorUserId) {
    const db = client || pool;
    const editable = ['name', 'description'];

    const assignments = [];
    const params = [];

    for (const column of editable) {
      if (fields[column] !== undefined) {
        params.push(fields[column]);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    if (assignments.length === 0) {
      return productCategoriesRepository.findByIdAndOrg(db, organizationId, categoryId);
    }

    params.push(actorUserId);
    assignments.push(`updated_by = $${params.length}`);
    assignments.push('updated_at = NOW()');

    params.push(categoryId);
    const idIdx = params.length;
    params.push(organizationId);
    const orgIdx = params.length;

    const res = await db.query(
      `UPDATE product_categories
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
   * @param {string} categoryId
   * @param {string} status
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async setStatus(client, organizationId, categoryId, status, actorUserId) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE product_categories
          SET status = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING ${SELECT_COLUMNS}`,
      [status, actorUserId, categoryId, organizationId]
    );
    return res.rows[0] || null;
  },
};

module.exports = productCategoriesRepository;
