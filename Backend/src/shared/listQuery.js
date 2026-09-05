'use strict';

/**
 * listQuery.js — the one place the standard collection list contract is built.
 *
 * Every collection endpoint accepts the same query string:
 *   ?page=1&limit=25&search=&status=&sortBy=&sortOrder=
 *
 * and returns the same envelope:
 *   { items: [], pagination: { page, limit, total, totalPages, hasNext, hasPrev } }
 *
 * `sortBy` is NEVER interpolated into SQL. It is mapped through a per-module
 * allow-list by pagination.buildOrderBy — a column name cannot be a bind
 * parameter, so this is the single place injection could otherwise enter an
 * otherwise fully parameterised codebase.
 */

const { parse, buildMeta, buildOrderBy } = require('./pagination');

/**
 * Translate the public `sortBy` / `sortOrder` pair into the `-column` form
 * that buildOrderBy expects.
 *
 * @param {object} query - Raw req.query.
 * @returns {string} e.g. '-created_at'
 */
function toSortParam(query = {}) {
  const raw = typeof query.sortBy === 'string' ? query.sortBy.replace(/^-/, '') : '';
  if (!raw) return '-created_at';
  const desc = String(query.sortOrder || '').toUpperCase() === 'DESC';
  return desc ? `-${raw}` : raw;
}

/**
 * Build the ORDER BY fragment for a list query.
 *
 * @param {object}   query       - Raw req.query.
 * @param {string[]} allowList   - Sortable column names for this module.
 * @param {string}   defaultSort - Fallback column (must be in allowList).
 * @returns {string} A safe, quoted `"column" DIR` fragment.
 */
function buildSort(query, allowList, defaultSort = 'created_at') {
  return buildOrderBy(toSortParam(query), allowList, defaultSort);
}

/**
 * Trim a free-text search term, returning null when there is nothing to match.
 *
 * @param {object} query
 * @returns {string|null}
 */
function searchTerm(query = {}) {
  const raw = typeof query.search === 'string' ? query.search.trim() : '';
  return raw.length ? raw : null;
}

/**
 * Assemble the standard list envelope.
 *
 * @param {Array}  items
 * @param {number} page
 * @param {number} limit
 * @param {number} total
 * @returns {{ items: Array, pagination: object }}
 */
function listResult(items, page, limit, total) {
  return { items, pagination: buildMeta(page, limit, total) };
}

module.exports = { parse, buildSort, searchTerm, listResult, toSortParam };
