'use strict';

/**
 * pagination.js — reusable cursor-less, offset-based pagination helpers.
 *
 * Usage (in a route handler):
 *   const { parse, buildMeta, buildOrderBy } = require('../shared/pagination');
 *   const { page, limit, offset } = parse(req.query);
 *   const orderBy = buildOrderBy(req.query.sort, ['name', 'created_at'], 'created_at');
 *   const rows = await pool.query(
 *     `SELECT * FROM contacts ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
 *     [limit, offset]
 *   );
 *   const total = Number(rows.rows[0]?.total_count ?? 0);
 *   res.json({ data: rows.rows, meta: buildMeta(page, limit, total) });
 */

const { PAGINATION } = require('./constants');

// ─── parse ────────────────────────────────────────────────────────────────────

/**
 * Parse and clamp page / limit from raw query-string values.
 *
 * @param {{ page?: string|number, limit?: string|number }} query
 * @returns {{ page: number, limit: number, offset: number }}
 */
function parse(query = {}) {
  const page = clamp(parseInt(query.page, 10), 1, Infinity, PAGINATION.DEFAULT_PAGE);
  const limit = clamp(
    parseInt(query.limit, 10),
    1,
    PAGINATION.MAX_LIMIT,
    PAGINATION.DEFAULT_LIMIT
  );
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Clamp a value between min and max, falling back to defaultVal when NaN.
 * @private
 */
function clamp(value, min, max, defaultVal) {
  if (!Number.isFinite(value)) return defaultVal;
  return Math.min(Math.max(value, min), max);
}

// ─── buildMeta ────────────────────────────────────────────────────────────────

/**
 * Build the standard pagination meta block that every list response includes.
 *
 * @param {number} page
 * @param {number} limit
 * @param {number} total  - Total rows matching the query (before LIMIT).
 * @returns {{ page: number, limit: number, total: number, totalPages: number, hasNext: boolean, hasPrev: boolean }}
 */
function buildMeta(page, limit, total) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// ─── buildOrderBy ─────────────────────────────────────────────────────────────

/**
 * Build a safe ORDER BY clause from a user-supplied sort string.
 *
 * The sort string follows the convention: `field` (ASC) or `-field` (DESC).
 * Only columns in `allowList` are accepted; anything else falls back to
 * `defaultSort`.
 *
 * IMPORTANT: the returned string is safe to interpolate directly into SQL
 * because it is constructed exclusively from the allow-list — never from
 * raw user input.
 *
 * @param {string|undefined} sortParam    - Raw query param (e.g. '-created_at').
 * @param {string[]}          allowList   - Permitted column names (snake_case).
 * @param {string}            defaultSort - Fallback column (must be in allowList).
 * @returns {string}  e.g.  `"created_at" DESC`
 */
function buildOrderBy(sortParam, allowList, defaultSort) {
  const allowed = new Set(allowList);

  let col = defaultSort;
  let dir = 'ASC';

  if (typeof sortParam === 'string' && sortParam.length > 0) {
    const raw = sortParam.startsWith('-') ? sortParam.slice(1) : sortParam;
    if (allowed.has(raw)) {
      col = raw;
      dir = sortParam.startsWith('-') ? 'DESC' : 'ASC';
    }
    // silently ignore invalid column — fall back to defaultSort
  }

  // Double-quote the identifier to prevent any SQL injection even within the
  // allow-list (guards against columns with upper-case or reserved words).
  return `"${col}" ${dir}`;
}

module.exports = { parse, buildMeta, buildOrderBy };
