'use strict';

const { pool } = require('../config/db');
const { buildOrderBy, buildMeta } = require('../shared/pagination');

const ALLOWED_SORT_COLUMNS = ['name', 'journal_type', 'sequence_prefix', 'status', 'created_at'];

/**
 * Insert a new journal.
 */
async function createJournal(client, orgId, userId, data) {
  const db = client || pool;
  const sql = `
    INSERT INTO journals (
      organization_id, name, journal_type, sequence_prefix,
      default_debit_account_id, default_credit_account_id, status,
      created_by, updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7)
    RETURNING id, organization_id, name, journal_type, sequence_prefix,
              default_debit_account_id, default_credit_account_id, status,
              created_at, updated_at
  `;
  const params = [
    orgId,
    data.name,
    data.journal_type,
    data.sequence_prefix,
    data.default_debit_account_id,
    data.default_credit_account_id,
    userId,
  ];
  const res = await db.query(sql, params);
  return res.rows[0];
}

/**
 * Find journal by ID within an organization with account details.
 */
async function findJournalById(client, orgId, id) {
  const db = client || pool;
  const sql = `
    SELECT j.id, j.organization_id, j.name, j.journal_type, j.sequence_prefix,
           j.default_debit_account_id, j.default_credit_account_id, j.status,
           j.created_at, j.updated_at,
           da.name AS default_debit_account_name, da.code AS default_debit_account_code,
           ca.name AS default_credit_account_name, ca.code AS default_credit_account_code
    FROM journals j
    LEFT JOIN accounts da ON j.default_debit_account_id = da.id AND da.organization_id = j.organization_id
    LEFT JOIN accounts ca ON j.default_credit_account_id = ca.id AND ca.organization_id = j.organization_id
    WHERE j.id = $1 AND j.organization_id = $2
  `;
  const res = await db.query(sql, [id, orgId]);
  return res.rows[0] || null;
}

/**
 * Find journal by name within an organization.
 */
async function findJournalByName(client, orgId, name) {
  const db = client || pool;
  const sql = `
    SELECT id, organization_id, name, journal_type, status
    FROM journals
    WHERE organization_id = $1 AND LOWER(name) = LOWER($2)
  `;
  const res = await db.query(sql, [orgId, name]);
  return res.rows[0] || null;
}

/**
 * List journals with pagination, filters, and safe allow-listed sorting.
 */
async function listJournals(client, orgId, query = {}) {
  const db = client || pool;
  const {
    page = 1,
    limit = 25,
    offset = 0,
    search = '',
    status = '',
    journalType = '',
    sortBy = 'name',
    sortOrder = 'ASC',
  } = query;

  const conditions = ['j.organization_id = $1'];
  const params = [orgId];
  let paramIdx = 2;

  if (status && status !== 'all') {
    conditions.push(`j.status = $${paramIdx++}`);
    params.push(status);
  }

  if (journalType && journalType !== 'all') {
    conditions.push(`j.journal_type = $${paramIdx++}`);
    params.push(journalType);
  }

  if (search && search.trim()) {
    conditions.push(`(j.name ILIKE $${paramIdx} OR j.sequence_prefix ILIKE $${paramIdx})`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');
  const orderByClause = buildOrderBy(sortBy, ALLOWED_SORT_COLUMNS, 'name', sortOrder);

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM journals j
    WHERE ${whereClause}
  `;
  const countRes = await db.query(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  const dataSql = `
    SELECT j.id, j.organization_id, j.name, j.journal_type, j.sequence_prefix,
           j.default_debit_account_id, j.default_credit_account_id, j.status,
           j.created_at, j.updated_at,
           da.name AS default_debit_account_name, da.code AS default_debit_account_code,
           ca.name AS default_credit_account_name, ca.code AS default_credit_account_code
    FROM journals j
    LEFT JOIN accounts da ON j.default_debit_account_id = da.id AND da.organization_id = j.organization_id
    LEFT JOIN accounts ca ON j.default_credit_account_id = ca.id AND ca.organization_id = j.organization_id
    WHERE ${whereClause}
    ORDER BY j.${orderByClause}
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;
  params.push(limit, offset);

  const dataRes = await db.query(dataSql, params);
  return {
    items: dataRes.rows,
    pagination: buildMeta(page, limit, total),
  };
}

/**
 * Update an existing journal.
 */
async function updateJournal(client, orgId, id, userId, data) {
  const db = client || pool;
  const setClauses = ['updated_at = NOW()'];
  const params = [id, orgId];
  let paramIdx = 3;

  if (userId) {
    setClauses.push(`updated_by = $${paramIdx++}`);
    params.push(userId);
  }

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIdx++}`);
    params.push(data.name);
  }
  if (data.journal_type !== undefined) {
    setClauses.push(`journal_type = $${paramIdx++}`);
    params.push(data.journal_type);
  }
  if (data.sequence_prefix !== undefined) {
    setClauses.push(`sequence_prefix = $${paramIdx++}`);
    params.push(data.sequence_prefix);
  }
  if (data.default_debit_account_id !== undefined) {
    setClauses.push(`default_debit_account_id = $${paramIdx++}`);
    params.push(data.default_debit_account_id);
  }
  if (data.default_credit_account_id !== undefined) {
    setClauses.push(`default_credit_account_id = $${paramIdx++}`);
    params.push(data.default_credit_account_id);
  }

  const sql = `
    UPDATE journals
    SET ${setClauses.join(', ')}
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, name, journal_type, sequence_prefix,
              default_debit_account_id, default_credit_account_id, status,
              created_at, updated_at
  `;
  const res = await db.query(sql, params);
  return res.rows[0] || null;
}

/**
 * Archive a journal (sets status='archived').
 */
async function archiveJournal(client, orgId, id, userId) {
  const db = client || pool;
  const sql = `
    UPDATE journals
    SET status = 'archived', updated_by = $3, updated_at = NOW()
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, name, journal_type, status
  `;
  const res = await db.query(sql, [id, orgId, userId]);
  return res.rows[0] || null;
}

/**
 * Unarchive a journal (sets status='active').
 */
async function unarchiveJournal(client, orgId, id, userId) {
  const db = client || pool;
  const sql = `
    UPDATE journals
    SET status = 'active', updated_by = $3, updated_at = NOW()
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, name, journal_type, status
  `;
  const res = await db.query(sql, [id, orgId, userId]);
  return res.rows[0] || null;
}

/**
 * Check if a journal is referenced by posted journal entries.
 */
async function checkJournalBlockers(client, orgId, id) {
  const db = client || pool;
  try {
    const entryCheck = await db.query(
      `SELECT COUNT(*)::int AS count FROM journal_entries WHERE journal_id = $1 AND organization_id = $2 LIMIT 1`,
      [id, orgId]
    );
    if (entryCheck.rows[0]?.count > 0) {
      return 'Referenced by existing journal entries';
    }
  } catch (err) {
    // journal_entries table might not exist until Phase 7
  }
  return null;
}

module.exports = {
  createJournal,
  findJournalById,
  findJournalByName,
  listJournals,
  updateJournal,
  archiveJournal,
  unarchiveJournal,
  checkJournalBlockers,
  ALLOWED_SORT_COLUMNS,
};
