'use strict';

const { pool } = require('../config/db');
const { buildOrderBy, buildMeta } = require('../shared/pagination');

const ALLOWED_SORT_COLUMNS = [
  'name',
  'code',
  'analytic_type',
  'department_or_project',
  'status',
  'created_at',
];

/**
 * Insert a new analytic account.
 */
async function createAnalyticAccount(client, orgId, userId, data) {
  const db = client || pool;
  const sql = `
    INSERT INTO analytic_accounts (
      organization_id, name, code, analytic_type, department_or_project,
      status, created_by, updated_by
    ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $6)
    RETURNING id, organization_id, name, code, analytic_type, department_or_project,
              status, created_at, updated_at
  `;
  const params = [
    orgId,
    data.name,
    data.code,
    data.analytic_type,
    data.department_or_project,
    userId,
  ];
  const res = await db.query(sql, params);
  return res.rows[0];
}

/**
 * Find analytic account by ID within an organization.
 */
async function findAnalyticAccountById(client, orgId, id) {
  const db = client || pool;
  const sql = `
    SELECT id, organization_id, name, code, analytic_type, department_or_project,
           status, created_at, updated_at
    FROM analytic_accounts
    WHERE id = $1 AND organization_id = $2
  `;
  const res = await db.query(sql, [id, orgId]);
  return res.rows[0] || null;
}

/**
 * Find analytic account by name within an organization.
 */
async function findAnalyticAccountByName(client, orgId, name) {
  const db = client || pool;
  const sql = `
    SELECT id, organization_id, name, code, analytic_type, status
    FROM analytic_accounts
    WHERE organization_id = $1 AND LOWER(name) = LOWER($2)
  `;
  const res = await db.query(sql, [orgId, name]);
  return res.rows[0] || null;
}

/**
 * List analytic accounts with pagination, filters, and safe allow-listed sorting.
 */
async function listAnalyticAccounts(client, orgId, query = {}) {
  const db = client || pool;
  const {
    page = 1,
    limit = 25,
    offset = 0,
    search = '',
    status = '',
    analyticType = '',
    sortBy = 'name',
    sortOrder = 'ASC',
  } = query;

  const conditions = ['organization_id = $1'];
  const params = [orgId];
  let paramIdx = 2;

  if (status && status !== 'all') {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  if (analyticType && analyticType !== 'all') {
    conditions.push(`analytic_type = $${paramIdx++}`);
    params.push(analyticType);
  }

  if (search && search.trim()) {
    conditions.push(`(name ILIKE $${paramIdx} OR code ILIKE $${paramIdx} OR department_or_project ILIKE $${paramIdx})`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');
  const orderByClause = buildOrderBy(sortBy, ALLOWED_SORT_COLUMNS, 'name', sortOrder);

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM analytic_accounts
    WHERE ${whereClause}
  `;
  const countRes = await db.query(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  const dataSql = `
    SELECT id, organization_id, name, code, analytic_type, department_or_project,
           status, created_at, updated_at
    FROM analytic_accounts
    WHERE ${whereClause}
    ORDER BY ${orderByClause}
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
 * Update an existing analytic account.
 */
async function updateAnalyticAccount(client, orgId, id, userId, data) {
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
  if (data.code !== undefined) {
    setClauses.push(`code = $${paramIdx++}`);
    params.push(data.code);
  }
  if (data.analytic_type !== undefined) {
    setClauses.push(`analytic_type = $${paramIdx++}`);
    params.push(data.analytic_type);
  }
  if (data.department_or_project !== undefined) {
    setClauses.push(`department_or_project = $${paramIdx++}`);
    params.push(data.department_or_project);
  }

  const sql = `
    UPDATE analytic_accounts
    SET ${setClauses.join(', ')}
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, name, code, analytic_type, department_or_project,
              status, created_at, updated_at
  `;
  const res = await db.query(sql, params);
  return res.rows[0] || null;
}

/**
 * Archive an analytic account (sets status='archived').
 */
async function archiveAnalyticAccount(client, orgId, id, userId) {
  const db = client || pool;
  const sql = `
    UPDATE analytic_accounts
    SET status = 'archived', updated_by = $3, updated_at = NOW()
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, name, code, analytic_type, status
  `;
  const res = await db.query(sql, [id, orgId, userId]);
  return res.rows[0] || null;
}

/**
 * Unarchive an analytic account (sets status='active').
 */
async function unarchiveAnalyticAccount(client, orgId, id, userId) {
  const db = client || pool;
  const sql = `
    UPDATE analytic_accounts
    SET status = 'active', updated_by = $3, updated_at = NOW()
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, name, code, analytic_type, status
  `;
  const res = await db.query(sql, [id, orgId, userId]);
  return res.rows[0] || null;
}

/**
 * Check if an analytic account is referenced by budgets or transaction lines.
 */
async function checkAnalyticAccountBlockers(client, orgId, id) {
  const db = client || pool;

  // 1. Check budgets if table exists
  try {
    const budgetCheck = await db.query(
      `SELECT COUNT(*)::int AS count FROM budgets WHERE analytic_account_id = $1 AND organization_id = $2 LIMIT 1`,
      [id, orgId]
    );
    if (budgetCheck.rows[0]?.count > 0) {
      return 'Referenced by existing budgets';
    }
  } catch (err) {
    // budgets table might not exist until Phase 11
  }

  // 2. Check journal entry lines if table exists
  try {
    const linesCheck = await db.query(
      `SELECT COUNT(*)::int AS count FROM journal_entry_lines WHERE analytic_account_id = $1 LIMIT 1`,
      [id]
    );
    if (linesCheck.rows[0]?.count > 0) {
      return 'Referenced by existing journal entry lines';
    }
  } catch (err) {
    // journal_entry_lines might not exist until Phase 7
  }

  return null;
}

module.exports = {
  createAnalyticAccount,
  findAnalyticAccountById,
  findAnalyticAccountByName,
  listAnalyticAccounts,
  updateAnalyticAccount,
  archiveAnalyticAccount,
  unarchiveAnalyticAccount,
  checkAnalyticAccountBlockers,
  ALLOWED_SORT_COLUMNS,
};
