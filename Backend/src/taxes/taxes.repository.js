'use strict';

const { pool } = require('../config/db');
const { buildOrderBy, buildMeta } = require('../shared/pagination');

const ALLOWED_SORT_COLUMNS = ['name', 'rate', 'tax_scope', 'computation', 'status', 'created_at'];

/**
 * Insert a new tax rate.
 */
async function createTax(client, orgId, userId, data) {
  const db = client || pool;
  const sql = `
    INSERT INTO taxes (
      organization_id, name, rate, tax_scope, computation,
      collected_account_id, paid_account_id, status,
      created_by, updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $8)
    RETURNING id, organization_id, name, rate, tax_scope, computation,
              collected_account_id, paid_account_id, status,
              created_at, updated_at
  `;
  const params = [
    orgId,
    data.name,
    data.rate,
    data.tax_scope,
    data.computation,
    data.collected_account_id,
    data.paid_account_id,
    userId,
  ];
  const res = await db.query(sql, params);
  return res.rows[0];
}

/**
 * Find tax by ID within an organization with account details.
 */
async function findTaxById(client, orgId, id) {
  const db = client || pool;
  const sql = `
    SELECT t.id, t.organization_id, t.name, t.rate, t.tax_scope, t.computation,
           t.collected_account_id, t.paid_account_id, t.status,
           t.created_at, t.updated_at,
           ca.name AS collected_account_name, ca.code AS collected_account_code,
           pa.name AS paid_account_name, pa.code AS paid_account_code
    FROM taxes t
    LEFT JOIN accounts ca ON t.collected_account_id = ca.id AND ca.organization_id = t.organization_id
    LEFT JOIN accounts pa ON t.paid_account_id = pa.id AND pa.organization_id = t.organization_id
    WHERE t.id = $1 AND t.organization_id = $2
  `;
  const res = await db.query(sql, [id, orgId]);
  return res.rows[0] || null;
}

/**
 * Find tax by name within an organization.
 */
async function findTaxByName(client, orgId, name) {
  const db = client || pool;
  const sql = `
    SELECT id, organization_id, name, rate, tax_scope, status
    FROM taxes
    WHERE organization_id = $1 AND LOWER(name) = LOWER($2)
  `;
  const res = await db.query(sql, [orgId, name]);
  return res.rows[0] || null;
}

/**
 * List taxes with pagination, filters, and safe allow-listed sorting.
 */
async function listTaxes(client, orgId, query = {}) {
  const db = client || pool;
  const {
    page = 1,
    limit = 25,
    offset = 0,
    search = '',
    status = '',
    taxScope = '',
    sortBy = 'name',
    sortOrder = 'ASC',
  } = query;

  const conditions = ['t.organization_id = $1'];
  const params = [orgId];
  let paramIdx = 2;

  if (status && status !== 'all') {
    conditions.push(`t.status = $${paramIdx++}`);
    params.push(status);
  }

  if (taxScope && taxScope !== 'all') {
    conditions.push(`t.tax_scope = $${paramIdx++}`);
    params.push(taxScope);
  }

  if (search && search.trim()) {
    conditions.push(`t.name ILIKE $${paramIdx}`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');
  const orderByClause = buildOrderBy(sortBy, ALLOWED_SORT_COLUMNS, 'name', sortOrder);

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM taxes t
    WHERE ${whereClause}
  `;
  const countRes = await db.query(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  const dataSql = `
    SELECT t.id, t.organization_id, t.name, t.rate, t.tax_scope, t.computation,
           t.collected_account_id, t.paid_account_id, t.status,
           t.created_at, t.updated_at,
           ca.name AS collected_account_name, ca.code AS collected_account_code,
           pa.name AS paid_account_name, pa.code AS paid_account_code
    FROM taxes t
    LEFT JOIN accounts ca ON t.collected_account_id = ca.id AND ca.organization_id = t.organization_id
    LEFT JOIN accounts pa ON t.paid_account_id = pa.id AND pa.organization_id = t.organization_id
    WHERE ${whereClause}
    ORDER BY t.${orderByClause}
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
 * Update an existing tax.
 */
async function updateTax(client, orgId, id, userId, data) {
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
  if (data.rate !== undefined) {
    setClauses.push(`rate = $${paramIdx++}`);
    params.push(data.rate);
  }
  if (data.tax_scope !== undefined) {
    setClauses.push(`tax_scope = $${paramIdx++}`);
    params.push(data.tax_scope);
  }
  if (data.computation !== undefined) {
    setClauses.push(`computation = $${paramIdx++}`);
    params.push(data.computation);
  }
  if (data.collected_account_id !== undefined) {
    setClauses.push(`collected_account_id = $${paramIdx++}`);
    params.push(data.collected_account_id);
  }
  if (data.paid_account_id !== undefined) {
    setClauses.push(`paid_account_id = $${paramIdx++}`);
    params.push(data.paid_account_id);
  }

  const sql = `
    UPDATE taxes
    SET ${setClauses.join(', ')}
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, name, rate, tax_scope, computation,
              collected_account_id, paid_account_id, status,
              created_at, updated_at
  `;
  const res = await db.query(sql, params);
  return res.rows[0] || null;
}

/**
 * Archive a tax (sets status='archived').
 */
async function archiveTax(client, orgId, id, userId) {
  const db = client || pool;
  const sql = `
    UPDATE taxes
    SET status = 'archived', updated_by = $3, updated_at = NOW()
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, name, rate, status
  `;
  const res = await db.query(sql, [id, orgId, userId]);
  return res.rows[0] || null;
}

/**
 * Unarchive a tax (sets status='active').
 */
async function unarchiveTax(client, orgId, id, userId) {
  const db = client || pool;
  const sql = `
    UPDATE taxes
    SET status = 'active', updated_by = $3, updated_at = NOW()
    WHERE id = $1 AND organization_id = $2
    RETURNING id, organization_id, name, rate, status
  `;
  const res = await db.query(sql, [id, orgId, userId]);
  return res.rows[0] || null;
}

/**
 * Check if a tax rate is referenced by products or transaction lines.
 */
async function checkTaxBlockers(client, orgId, id) {
  const db = client || pool;
  try {
    const prodCheck = await db.query(
      `SELECT COUNT(*)::int AS count FROM products WHERE (sales_tax_id = $1 OR purchase_tax_id = $1) AND organization_id = $2 LIMIT 1`,
      [id, orgId]
    );
    if (prodCheck.rows[0]?.count > 0) {
      return 'Referenced by active products';
    }
  } catch (err) {
    // products table might not exist until Phase 6
  }
  return null;
}

module.exports = {
  createTax,
  findTaxById,
  findTaxByName,
  listTaxes,
  updateTax,
  archiveTax,
  unarchiveTax,
  checkTaxBlockers,
  ALLOWED_SORT_COLUMNS,
};
