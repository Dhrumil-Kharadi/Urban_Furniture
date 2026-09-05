const { pool } = require('../config/db');
const { parse: parsePagination, buildMeta, buildOrderBy } = require('../shared/pagination');

/**
 * Users Repository
 *
 * Scoped data access for organization user management.
 * Every query filters strictly on organization_id.
 */

const ALLOWED_SORT_COLUMNS = ['created_at', 'name', 'email', 'role', 'status'];

const usersRepository = {
  /**
   * List users in an organization with pagination, filtering, and sorting.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query]
   * @returns {Promise<{ items: Array, meta: object }>}
   */
  async listByOrganization(client, organizationId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['organization_id = $1'];
    const params = [organizationId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }

    if (query.role) {
      params.push(query.role);
      conditions.push(`role = $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get total count
    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM users ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    // Build order by using safe pagination helper
    const sortParam = query.sortBy
      ? (String(query.sortOrder).toUpperCase() === 'DESC' || String(query.sortBy).startsWith('-')
          ? `-${query.sortBy.replace(/^-/, '')}`
          : query.sortBy)
      : '-created_at';
    const orderBy = buildOrderBy(sortParam, ALLOWED_SORT_COLUMNS, 'created_at');

    // Fetch paginated rows (excluding password_hash)
    params.push(limit);
    const limitParamIdx = params.length;
    params.push(offset);
    const offsetParamIdx = params.length;

    const dataRes = await db.query(
      `SELECT id, name, email, role, organization_id, contact_id,
              must_change_password, status, email_verified, created_at, updated_at
         FROM users
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
      params
    );

    return {
      items: dataRes.rows,
      // buildMeta takes (page, limit, total) — the arguments were transposed here,
      // which made every page report a total of `limit` and a totalPages of 1.
      meta: buildMeta(page, limit, total),
    };
  },

  /**
   * Find a user within an organization by ID.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async findByIdAndOrg(client, organizationId, userId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, email, role, organization_id, contact_id,
              must_change_password, status, email_verified, created_at, updated_at
         FROM users
        WHERE id = $1 AND organization_id = $2`,
      [userId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Update a user's status within an organization.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} userId
   * @param {string} status 'active' | 'inactive'
   * @returns {Promise<object|null>}
   */
  async updateStatus(client, organizationId, userId, status) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE users
          SET status = $1, updated_at = NOW()
        WHERE id = $2 AND organization_id = $3
        RETURNING id, name, email, role, organization_id, status, updated_at`,
      [status, userId, organizationId]
    );
    return res.rows[0] || null;
  },
};

module.exports = usersRepository;
