'use strict';

const { pool } = require('../config/db');
const { buildOrderBy, buildMeta } = require('../shared/pagination');

const ALLOWED_SORT_COLUMNS = ['code', 'name', 'account_type', 'opening_balance', 'created_at', 'status'];

/**
 * Insert a new account.
 */
async function createAccount(client, orgId, userId, data) {
  const db = client || pool;
  const sql = `
    INSERT INTO accounts (
      organization_id, code, name, account_type, parent_account_id,
      opening_balance, is_system, status, created_by, updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, false, 'active', $7, $7)
    RETURNING id, organization_id, code, name, account_type, parent_account_id,
              opening_balance, is_system, status, created_at, updated_at
  `;
  const params = [
    orgId,
    data.code,
    data.name,
    data.account_type,
    data.parent_account_id,
    data.opening_balance,
    userId,
  ];
  const res = await db.query(sql, params);
  return res.rows[0];
}

/**
 * Find account by ID within an organization.
 */
async function findAccountById(client, orgId, id) {
  const db = client || pool;
  const sql = `
    SELECT a.id, a.organization_id, a.code, a.name, a.account_type,
           a.parent_account_id, a.opening_balance, a.is_system, a.status,
           a.created_at, a.updated_at,
           p.name AS parent_account_name, p.code AS parent_account_code
    FROM accounts a
    LEFT JOIN accounts p ON a.parent_account_id = p.id AND p.organization_id = a.organization_id
    WHERE a.id = $1 AND a.organization_id = $2
  `;
  const res = await db.query(sql, [id, orgId]);
  return res.rows[0] || null;
}

/**
 * Find account by code within an organization.
 */
async function findAccountByCode(client, orgId, code) {
  const db = client || pool;
  const sql = `
    SELECT id, organization_id, code, name, account_type, status
    FROM accounts
    WHERE organization_id = $1 AND code = $2
  `;
  const res = await db.query(sql, [orgId, code]);
  return res.rows[0] || null;
}

/**
 * List accounts with pagination, filters, and safe allow-listed sorting.
 */
async function listAccounts(client, orgId, query = {}) {
  const db = client || pool;
  const {
    page = 1,
    limit = 25,
    offset = 0,
    search = '',
    status = '',
    accountType = '',
    sortBy = 'code',
    sortOrder = 'ASC',
  } = query;

  const conditions = ['a.organization_id = $1'];
  const params = [orgId];
  let paramIdx = 2;

  if (status && status !== 'all') {
    conditions.push(`a.status = $${paramIdx++}`);
    params.push(status);
  }

  if (accountType && accountType !== 'all') {
    conditions.push(`a.account_type = $${paramIdx++}`);
    params.push(accountType === 'equity' ? 'capital' : accountType);
  }

  if (search && search.trim()) {
    conditions.push(`(a.code ILIKE $${paramIdx} OR a.name ILIKE $${paramIdx})`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');
  const orderByClause = buildOrderBy(sortBy, ALLOWED_SORT_COLUMNS, 'code', sortOrder);

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM accounts a
    WHERE ${whereClause}
  `;
  const countRes = await db.query(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  const dataSql = `
    SELECT a.id, a.organization_id, a.code, a.name, a.account_type,
           a.parent_account_id, a.opening_balance, a.is_system, a.status,
           a.created_at, a.updated_at,
           p.name AS parent_account_name, p.code AS parent_account_code
    FROM accounts a
    LEFT JOIN accounts p ON a.parent_account_id = p.id AND p.organization_id = a.organization_id
    WHERE ${whereClause}
    ORDER BY a.${orderByClause}
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
 * List all accounts in an organization to build tree hierarchy.
 */
async function listAllAccountsForTree(client, orgId) {
  const db = client || pool;
  const sql = `
    SELECT a.id, a.code, a.name, a.account_type, a.parent_account_id,
           a.opening_balance, a.is_system, a.status
    FROM accounts a
    WHERE a.organization_id = $1
    ORDER BY a.code ASC
  `;
  const res = await db.query(sql, [orgId]);
  return res.rows;
}

/**
 * Update an existing account.
 */
async function updateAccount(client, orgId, id, userId, data) {
  const db = client || pool;
  const setClauses = ['updated_at = NOW()'];
  const params = [id, orgId];
  let paramIdx = 3;

  if (userId) {
    setClauses.push(`updated_by = $${paramIdx++}`);
    params.push(userId);
  }

  if (data.code !== undefined) {
    setClauses.push(`code = $${paramIdx++}`);
    params.push(data.code);
  }
  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIdx++}`);
    params.push(data.name);
  }
  if (data.account_type !== undefined) {
    setClauses.push(`account_type = $${paramIdx++}`);
    params.push(data.account_type);
  }
  if (data.parent_account_id !== undefined) {
    setClauses.push(`parent_account_id = $${paramIdx++}`);
    params.push(data.parent_account_id);
  }
  if (data.opening_balance !== undefined) {
    setClauses.push(`opening_balance = $${paramIdx++}`);
    params.push(data.opening_balance);
  }

  const sql = `
    UPDATE accounts
    SET ${setClauses.join(', ')}
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, code, name, account_type, parent_account_id,
              opening_balance, is_system, status, created_at, updated_at
  `;
  const res = await db.query(sql, params);
  return res.rows[0] || null;
}

/**
 * Archive an account (sets status='archived').
 */
async function archiveAccount(client, orgId, id, userId) {
  const db = client || pool;
  const sql = `
    UPDATE accounts
    SET status = 'archived', updated_by = $3, updated_at = NOW()
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, code, name, account_type, is_system, status
  `;
  const res = await db.query(sql, [id, orgId, userId]);
  return res.rows[0] || null;
}

/**
 * Unarchive an account (sets status='active').
 */
async function unarchiveAccount(client, orgId, id, userId) {
  const db = client || pool;
  const sql = `
    UPDATE accounts
    SET status = 'active', updated_by = $3, updated_at = NOW()
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, code, name, account_type, is_system, status
  `;
  const res = await db.query(sql, [id, orgId, userId]);
  return res.rows[0] || null;
}

/**
 * Check if an account is referenced by posted documents, journals, taxes, or child accounts.
 */
async function checkAccountBlockers(client, orgId, id) {
  const db = client || pool;

  // 1. Check for child accounts
  const childCheck = await db.query(
    `SELECT COUNT(*)::int AS count FROM accounts WHERE parent_account_id = $1 AND organization_id = $2 AND status = 'active'`,
    [id, orgId]
  );
  if (childCheck.rows[0]?.count > 0) {
    return 'Active child accounts exist under this account';
  }

  // 2. Check for journal references
  const journalCheck = await db.query(
    `SELECT name FROM journals WHERE (default_debit_account_id = $1 OR default_credit_account_id = $1) AND organization_id = $2 LIMIT 1`,
    [id, orgId]
  );
  if (journalCheck.rows.length > 0) {
    return `Referenced by Journal "${journalCheck.rows[0].name}"`;
  }

  // 3. Check for tax references
  const taxCheck = await db.query(
    `SELECT name FROM taxes WHERE (collected_account_id = $1 OR paid_account_id = $1) AND organization_id = $2 LIMIT 1`,
    [id, orgId]
  );
  if (taxCheck.rows.length > 0) {
    return `Referenced by Tax "${taxCheck.rows[0].name}"`;
  }

  // 4. Check for journal entry lines if table exists
  try {
    const linesCheck = await db.query(
      `SELECT COUNT(*)::int AS count FROM journal_entry_lines WHERE account_id = $1 LIMIT 1`,
      [id]
    );
    if (linesCheck.rows[0]?.count > 0) {
      return 'Referenced by posted journal entry lines';
    }
  } catch (err) {
    // journal_entry_lines might not exist until Phase 7
  }

  return null;
}

module.exports = {
  createAccount,
  findAccountById,
  findAccountByCode,
  listAccounts,
  listAllAccountsForTree,
  updateAccount,
  archiveAccount,
  unarchiveAccount,
  checkAccountBlockers,
  ALLOWED_SORT_COLUMNS,
};
