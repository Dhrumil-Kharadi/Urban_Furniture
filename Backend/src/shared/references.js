'use strict';

/**
 * references.js — "is this master-data row still in use?"
 *
 * project.md §9.6: a Product or Contact that has transactions may be archived
 * but never deleted, and archiving must name what is blocking it rather than
 * failing with a bare foreign-key error.
 *
 * The document tables that will reference this master data are built in
 * Phases 8 and 9. Rather than leave a TODO that a later phase has to remember
 * to come back for, each candidate table is probed with `to_regclass` and
 * skipped when it does not exist yet. The check is therefore correct today
 * (nothing references anything, so archiving is allowed) and correct the day
 * the first invoice table lands, with no edit here.
 */

const { pool } = require('../config/db');

/**
 * Count rows in `sources` that point at `id` within the given organization.
 *
 * @param {object}   db      - pg pool or transaction client.
 * @param {Array<{ table: string, column: string }>} sources
 * @param {string}   id      - Master-data row id.
 * @param {string}   organizationId
 * @returns {Promise<Array<{ table: string, count: number }>>} Only non-zero entries.
 */
async function findBlockingReferences(db, sources, id, organizationId) {
  const client = db || pool;
  const blockers = [];

  for (const { table, column } of sources) {
    // Table names come from this module's own hard-coded lists, never from a
    // request, so interpolating them is safe — and a table name cannot be a
    // bind parameter. The VALUES are still parameterised.
    const exists = await client.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    if (!exists.rows[0]?.reg) continue;

    const result = await client.query(
      `SELECT COUNT(*)::integer AS total
         FROM ${table}
        WHERE ${column} = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    const total = result.rows[0]?.total || 0;
    if (total > 0) blockers.push({ table, count: total });
  }

  return blockers;
}

/** Document tables that will reference a contact (Phases 8/9). */
const CONTACT_REFERENCE_SOURCES = Object.freeze([
  { table: 'sales_orders', column: 'contact_id' },
  { table: 'purchase_orders', column: 'contact_id' },
  { table: 'invoices', column: 'contact_id' },
  { table: 'bills', column: 'contact_id' },
  { table: 'payments', column: 'contact_id' },
]);

/** Document tables that will reference a product (Phases 8/9). */
const PRODUCT_REFERENCE_SOURCES = Object.freeze([
  { table: 'sales_order_lines', column: 'product_id' },
  { table: 'purchase_order_lines', column: 'product_id' },
  { table: 'invoice_lines', column: 'product_id' },
  { table: 'bill_lines', column: 'product_id' },
]);

/** Tables that reference a product category. */
const PRODUCT_CATEGORY_REFERENCE_SOURCES = Object.freeze([
  { table: 'products', column: 'category_id' },
]);

/**
 * Everything that can point at a Chart of Accounts row.
 *
 * `journal_entry_lines` is the one that matters most: once an account carries
 * a posted line it is part of the ledger's history and archiving it must not
 * be allowed to orphan that line's meaning.
 */
const ACCOUNT_REFERENCE_SOURCES = Object.freeze([
  { table: 'journal_entry_lines', column: 'account_id' },
  { table: 'journals', column: 'default_debit_account_id' },
  { table: 'journals', column: 'default_credit_account_id' },
  { table: 'taxes', column: 'tax_account_id' },
  { table: 'products', column: 'income_account_id' },
  { table: 'products', column: 'expense_account_id' },
  { table: 'accounts', column: 'parent_account_id' },
]);

/** Tables that reference a journal. */
const JOURNAL_REFERENCE_SOURCES = Object.freeze([
  { table: 'journal_entries', column: 'journal_id' },
]);

/** Tables that reference a tax. */
const TAX_REFERENCE_SOURCES = Object.freeze([
  { table: 'products', column: 'sales_tax_id' },
  { table: 'products', column: 'purchase_tax_id' },
  { table: 'invoice_lines', column: 'tax_id' },
  { table: 'bill_lines', column: 'tax_id' },
  { table: 'sales_order_lines', column: 'tax_id' },
  { table: 'purchase_order_lines', column: 'tax_id' },
]);

/** Tables that reference an analytic account. */
const ANALYTIC_REFERENCE_SOURCES = Object.freeze([
  { table: 'journal_entry_lines', column: 'analytic_account_id' },
  { table: 'budgets', column: 'analytic_account_id' },
]);

module.exports = {
  findBlockingReferences,
  CONTACT_REFERENCE_SOURCES,
  PRODUCT_REFERENCE_SOURCES,
  PRODUCT_CATEGORY_REFERENCE_SOURCES,
  ACCOUNT_REFERENCE_SOURCES,
  JOURNAL_REFERENCE_SOURCES,
  TAX_REFERENCE_SOURCES,
  ANALYTIC_REFERENCE_SOURCES,
};
