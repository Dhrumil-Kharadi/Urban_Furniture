const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, searchTerm, listResult } = require('../shared/listQuery');

/**
 * Journals Repository
 *
 * Parameterised SQL only. Every statement is scoped by organization_id, and
 * every single-row lookup matches on both id and organization_id.
 */

const ALLOWED_SORT_COLUMNS = ['name', 'journal_type', 'status', 'created_at', 'updated_at'];

const SELECT_COLUMNS = `
  j.id, j.organization_id, j.name, j.journal_type, j.sequence_prefix,
  j.default_debit_account_id, j.default_credit_account_id, j.status,
  j.created_by, j.updated_by, j.created_at, j.updated_at
`;

/** Both default accounts are resolved in the same query, never per row. */
const ACCOUNT_JOINS = `
  LEFT JOIN accounts da
         ON da.id = j.default_debit_account_id
        AND da.organization_id = j.organization_id
  LEFT JOIN accounts ca
         ON ca.id = j.default_credit_account_id
        AND ca.organization_id = j.organization_id
`;

const ACCOUNT_NAMES = `
  da.name AS default_debit_account_name,
  da.code AS default_debit_account_code,
  ca.name AS default_credit_account_name,
  ca.code AS default_credit_account_code
`;

const journalsRepository = {
  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query]
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async list(client, organizationId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['j.organization_id = $1'];
    const params = [organizationId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`j.status = $${params.length}`);
    }

    if (query.type) {
      params.push(query.type);
      conditions.push(`j.journal_type = $${params.length}`);
    }

    const search = searchTerm(query);
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(j.name ILIKE $${idx} OR j.sequence_prefix ILIKE $${idx})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM journals j ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const orderBy = buildSort(query, ALLOWED_SORT_COLUMNS, 'name').replace(/^"/, 'j."');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT ${SELECT_COLUMNS}, ${ACCOUNT_NAMES}
         FROM journals j
         ${ACCOUNT_JOINS}
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
   * @param {string} journalId
   * @returns {Promise<object|null>}
   */
  async findByIdAndOrg(client, organizationId, journalId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT ${SELECT_COLUMNS}, ${ACCOUNT_NAMES}
         FROM journals j
         ${ACCOUNT_JOINS}
        WHERE j.id = $1 AND j.organization_id = $2`,
      [journalId, organizationId]
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
    let sql = `SELECT id, name FROM journals
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
      `INSERT INTO journals (
         organization_id, name, journal_type, sequence_prefix,
         default_debit_account_id, default_credit_account_id, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id`,
      [
        payload.organization_id,
        payload.name,
        payload.journal_type,
        payload.sequence_prefix,
        payload.default_debit_account_id,
        payload.default_credit_account_id,
        payload.actor_user_id,
      ]
    );

    return journalsRepository.findByIdAndOrg(db, payload.organization_id, res.rows[0].id);
  },

  /**
   * The SET list is built from a fixed whitelist of column names, so no
   * request value ever reaches the SQL text.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} journalId
   * @param {object} fields
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async update(client, organizationId, journalId, fields, actorUserId) {
    const db = client || pool;
    const editable = [
      'name', 'journal_type', 'sequence_prefix',
      'default_debit_account_id', 'default_credit_account_id',
    ];

    const assignments = [];
    const params = [];

    for (const column of editable) {
      if (fields[column] !== undefined) {
        params.push(fields[column]);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    if (assignments.length === 0) {
      return journalsRepository.findByIdAndOrg(db, organizationId, journalId);
    }

    params.push(actorUserId);
    assignments.push(`updated_by = $${params.length}`);
    assignments.push('updated_at = NOW()');

    params.push(journalId);
    const idIdx = params.length;
    params.push(organizationId);
    const orgIdx = params.length;

    const res = await db.query(
      `UPDATE journals
          SET ${assignments.join(', ')}
        WHERE id = $${idIdx} AND organization_id = $${orgIdx}
        RETURNING id`,
      params
    );

    if (res.rowCount === 0) return null;
    return journalsRepository.findByIdAndOrg(db, organizationId, journalId);
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} journalId
   * @param {string} status
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async setStatus(client, organizationId, journalId, status, actorUserId) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE journals
          SET status = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING id`,
      [status, actorUserId, journalId, organizationId]
    );

    if (res.rowCount === 0) return null;
    return journalsRepository.findByIdAndOrg(db, organizationId, journalId);
  },

  /**
   * Count the active journals of a type, so the last one of a type the posting
   * rules depend on cannot be archived out from under them.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} journalType
   * @returns {Promise<number>}
   */
  async countActiveOfType(client, organizationId, journalType) {
    const db = client || pool;
    const res = await db.query(
      `SELECT COUNT(*)::integer AS total
         FROM journals
        WHERE organization_id = $1 AND journal_type = $2 AND status = 'active'`,
      [organizationId, journalType]
    );
    return res.rows[0]?.total || 0;
  },
};

module.exports = journalsRepository;
