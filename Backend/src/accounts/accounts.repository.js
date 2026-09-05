const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, searchTerm, listResult } = require('../shared/listQuery');

/**
 * Accounts Repository (Chart of Accounts)
 *
 * Parameterised SQL only.
 *
 * MULTI-TENANCY: every statement filters on organization_id, and every
 * single-row lookup matches on BOTH id and organization_id. An account in
 * another tenant must be indistinguishable from one that does not exist.
 *
 * MONEY: opening_balance is NUMERIC(15,2) and comes back from node-postgres as
 * a STRING. It is passed through untouched — do not install a global type
 * parser to "fix" it, which would turn every balance into a float.
 */

const ALLOWED_SORT_COLUMNS = ['code', 'name', 'account_type', 'status', 'created_at', 'updated_at'];

const SELECT_COLUMNS = `
  a.id, a.organization_id, a.code, a.name, a.account_type, a.parent_account_id,
  a.opening_balance, a.is_system, a.status,
  a.created_by, a.updated_by, a.created_at, a.updated_at
`;

const accountsRepository = {
  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query] - page, limit, search, status, type, sortBy, sortOrder
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async list(client, organizationId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['a.organization_id = $1'];
    const params = [organizationId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`a.status = $${params.length}`);
    }

    if (query.type) {
      params.push(query.type);
      conditions.push(`a.account_type = $${params.length}`);
    }

    const search = searchTerm(query);
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(a.name ILIKE $${idx} OR a.code ILIKE $${idx})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM accounts a ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    // Resolved from the allow-list, then qualified with the alias so it cannot
    // be ambiguous against the self-join for the parent name.
    const orderBy = buildSort(query, ALLOWED_SORT_COLUMNS, 'code').replace(/^"/, 'a."');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT ${SELECT_COLUMNS}, p.name AS parent_account_name
         FROM accounts a
         LEFT JOIN accounts p
                ON p.id = a.parent_account_id
               AND p.organization_id = a.organization_id
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return listResult(dataRes.rows, page, limit, total);
  },

  /**
   * Every account in the organization, ordered for tree assembly.
   * A single query — the tree is built in memory, never by querying per node.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query] - { status }
   * @returns {Promise<Array>}
   */
  async listAll(client, organizationId, query = {}) {
    const db = client || pool;
    const params = [organizationId];
    let statusClause = '';

    if (query.status) {
      params.push(query.status);
      statusClause = ` AND a.status = $${params.length}`;
    }

    const res = await db.query(
      `SELECT ${SELECT_COLUMNS}
         FROM accounts a
        WHERE a.organization_id = $1${statusClause}
        ORDER BY a.account_type, a.code`,
      params
    );
    return res.rows;
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} accountId
   * @returns {Promise<object|null>}
   */
  async findByIdAndOrg(client, organizationId, accountId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT ${SELECT_COLUMNS}, p.name AS parent_account_name
         FROM accounts a
         LEFT JOIN accounts p
                ON p.id = a.parent_account_id
               AND p.organization_id = a.organization_id
        WHERE a.id = $1 AND a.organization_id = $2`,
      [accountId, organizationId]
    );
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
    let sql = `SELECT id, code, name FROM accounts
                WHERE organization_id = $1 AND code = $2`;

    if (excludeId) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }

    const res = await db.query(`${sql} LIMIT 1`, params);
    return res.rows[0] || null;
  },

  /**
   * Walk from an account up to the root, returning the ancestor ids in order.
   *
   * Done as one recursive CTE rather than a loop of round trips, and capped at
   * a sane depth so a cycle that somehow already exists in the data cannot
   * spin here forever.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} accountId
   * @returns {Promise<string[]>}
   */
  async findAncestorIds(client, organizationId, accountId) {
    const db = client || pool;
    const res = await db.query(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_account_id, 1 AS depth
           FROM accounts
          WHERE id = $1 AND organization_id = $2
         UNION ALL
         SELECT a.id, a.parent_account_id, chain.depth + 1
           FROM accounts a
           JOIN chain ON a.id = chain.parent_account_id
          WHERE a.organization_id = $2 AND chain.depth < 64
       )
       SELECT id FROM chain`,
      [accountId, organizationId]
    );
    return res.rows.map((row) => row.id);
  },

  /**
   * Count the direct children of an account.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} accountId
   * @returns {Promise<number>}
   */
  async countChildren(client, organizationId, accountId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT COUNT(*)::integer AS total
         FROM accounts
        WHERE parent_account_id = $1 AND organization_id = $2 AND status = 'active'`,
      [accountId, organizationId]
    );
    return res.rows[0]?.total || 0;
  },

  /**
   * @param {object|null} client
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async insert(client, payload) {
    const db = client || pool;
    const res = await db.query(
      `INSERT INTO accounts (
         organization_id, code, name, account_type, parent_account_id,
         opening_balance, is_system, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, false, $7, $7)
       RETURNING id`,
      [
        payload.organization_id,
        payload.code,
        payload.name,
        payload.account_type,
        payload.parent_account_id,
        payload.opening_balance,
        payload.actor_user_id,
      ]
    );

    return accountsRepository.findByIdAndOrg(db, payload.organization_id, res.rows[0].id);
  },

  /**
   * Update an account's editable fields.
   *
   * The SET list is assembled from a fixed whitelist of column names, so no
   * request value ever reaches the SQL text — only bind parameters do.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} accountId
   * @param {object} fields
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async update(client, organizationId, accountId, fields, actorUserId) {
    const db = client || pool;
    const editable = ['code', 'name', 'account_type', 'parent_account_id', 'opening_balance'];

    const assignments = [];
    const params = [];

    for (const column of editable) {
      if (fields[column] !== undefined) {
        params.push(fields[column]);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    if (assignments.length === 0) {
      return accountsRepository.findByIdAndOrg(db, organizationId, accountId);
    }

    params.push(actorUserId);
    assignments.push(`updated_by = $${params.length}`);
    assignments.push('updated_at = NOW()');

    params.push(accountId);
    const idIdx = params.length;
    params.push(organizationId);
    const orgIdx = params.length;

    const res = await db.query(
      `UPDATE accounts
          SET ${assignments.join(', ')}
        WHERE id = $${idIdx} AND organization_id = $${orgIdx}
        RETURNING id`,
      params
    );

    if (res.rowCount === 0) return null;
    return accountsRepository.findByIdAndOrg(db, organizationId, accountId);
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} accountId
   * @param {string} status
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async setStatus(client, organizationId, accountId, status, actorUserId) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE accounts
          SET status = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING id`,
      [status, actorUserId, accountId, organizationId]
    );

    if (res.rowCount === 0) return null;
    return accountsRepository.findByIdAndOrg(db, organizationId, accountId);
  },
};

module.exports = accountsRepository;
