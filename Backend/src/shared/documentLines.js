'use strict';

/**
 * documentLines.js — line arithmetic for every transaction document.
 *
 * Purchase Orders, Vendor Bills, Sales Orders and Customer Invoices all
 * compute a line the same way:
 *
 *     untaxed = quantity x unit_price
 *     tax     = untaxed x rate / 100
 *     total   = untaxed + tax
 *
 * They differ only in WHICH product field supplies the default price, the
 * default tax, and the posting account. So that difference is a config object
 * and the arithmetic is written once.
 *
 * Four copies of this is the single most likely way this build goes wrong:
 * the copies drift, and the drift shows up as a sales invoice that totals
 * differently from the purchase bill for the same numbers.
 *
 * MONEY
 * - Every amount is a fixed-2dp STRING throughout. Nothing becomes a Number.
 * - Rounding is ROUND_HALF_UP at 2dp, applied ONCE PER LINE after tax, never
 *   on a running total — technicalrequirement.md §3.3. That is what makes the
 *   line totals sum exactly to the document total instead of drifting a paisa
 *   at a time.
 * - Client-sent totals are never read. The caller passes raw lines; this
 *   returns what the totals actually are.
 */

const { money, toDb, sum } = require('./money');

/**
 * How a document type maps onto the product master.
 *
 * @typedef {object} LineConfig
 * @property {string} priceField   - Product column supplying the default price.
 * @property {string} taxField     - Product column supplying the default tax.
 * @property {string} accountField - Line column holding the posting account.
 */

/** Purchase side: cost price, purchase tax, expense account. */
const PURCHASE_CONFIG = Object.freeze({
  priceField: 'cost_price',
  taxField: 'purchase_tax_id',
  accountField: 'expense_account_id',
  productAccountField: 'expense_account_id',
});

/** Sales side: sales price, sales tax, income account. */
const SALES_CONFIG = Object.freeze({
  priceField: 'sales_price',
  taxField: 'sales_tax_id',
  accountField: 'income_account_id',
  productAccountField: 'income_account_id',
});

/**
 * Compute line and header totals from already-enriched lines.
 *
 * @param {Array} rawLines
 * @param {LineConfig} config
 * @returns {{ computedLines: Array, untaxed_amount: string, tax_amount: string, total_amount: string }}
 */
function computeLineTotals(rawLines, config) {
  const computedLines = rawLines.map((line, index) => {
    const quantity = money(line.quantity);
    const unitPrice = money(line.unit_price);
    const taxRate = money(line.tax_rate || 0);

    // Rounded once, here, after tax — not on the running sum.
    const untaxed = quantity.times(unitPrice).toFixed(2);
    const taxAmount = money(untaxed).times(taxRate).dividedBy(100).toFixed(2);
    const total = money(untaxed).plus(money(taxAmount)).toFixed(2);

    return {
      line_no: index + 1,
      product_id: line.product_id || null,
      description: (line.description || '').trim(),
      quantity: quantity.toFixed(4),
      unit_price: toDb(unitPrice),
      tax_id: line.tax_id || null,
      tax_rate: taxRate.toFixed(4),
      untaxed_amount: untaxed,
      tax_amount: taxAmount,
      total_amount: total,
      analytic_account_id: line.analytic_account_id || null,
      // The posting account lives under whichever name this document uses.
      [config.accountField]: line[config.accountField] || null,
    };
  });

  return {
    computedLines,
    untaxed_amount: sum(computedLines.map((l) => l.untaxed_amount)),
    tax_amount: sum(computedLines.map((l) => l.tax_amount)),
    total_amount: sum(computedLines.map((l) => l.total_amount)),
  };
}

/**
 * Fill in defaults from the product and tax masters, then compute the totals.
 *
 * Products and taxes are fetched in TWO queries regardless of line count —
 * never one lookup per line. A twenty-line invoice would otherwise be forty
 * round trips inside a transaction that is holding a sequence lock.
 *
 * Both lookups are scoped to organization_id, so a line naming another
 * tenant's product simply resolves to nothing rather than leaking its price.
 *
 * @param {object|null} client - Transaction client, or null for the pool.
 * @param {string} organizationId
 * @param {Array} rawLines
 * @param {LineConfig} config
 * @returns {Promise<{ computedLines: Array, untaxed_amount: string, tax_amount: string, total_amount: string }>}
 */
async function resolveAndComputeLines(client, organizationId, rawLines, config) {
  // Required lazily: config/db pulls in the pool, and this module is also used
  // by pure unit tests that never touch a database.
  // eslint-disable-next-line global-require
  const { pool } = require('../config/db');
  const db = client || pool;

  const productIds = [...new Set(rawLines.map((l) => l.product_id).filter(Boolean))];
  const taxIds = [...new Set(rawLines.map((l) => l.tax_id).filter(Boolean))];

  const productMap = {};
  if (productIds.length > 0) {
    const res = await db.query(
      `SELECT id, name, description, ${config.priceField}, ${config.taxField}, ${config.productAccountField}
         FROM products
        WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
      [productIds, organizationId]
    );
    for (const row of res.rows) productMap[row.id] = row;
  }

  const taxMap = {};
  const taxIdsToLoad = new Set(taxIds);
  // A line with no explicit tax inherits the product's, so those ids have to
  // be resolved too — in the same query, not a second pass.
  for (const line of rawLines) {
    if (!line.tax_id && line.product_id) {
      const inherited = productMap[line.product_id]?.[config.taxField];
      if (inherited) taxIdsToLoad.add(inherited);
    }
  }

  if (taxIdsToLoad.size > 0) {
    const res = await db.query(
      `SELECT id, rate FROM taxes WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
      [[...taxIdsToLoad], organizationId]
    );
    for (const row of res.rows) taxMap[row.id] = row.rate;
  }

  const enriched = rawLines.map((line) => {
    const product = line.product_id ? productMap[line.product_id] : null;

    const taxId = line.tax_id || product?.[config.taxField] || null;

    // An explicitly supplied rate wins, so a historical document can be
    // recomputed at the rate it was raised under rather than today's.
    const hasExplicitRate =
      line.tax_rate !== undefined && line.tax_rate !== null && line.tax_rate !== '';
    const taxRate = hasExplicitRate
      ? line.tax_rate
      : (taxId && taxMap[taxId] !== undefined ? taxMap[taxId] : 0);

    const hasExplicitPrice =
      line.unit_price !== undefined && line.unit_price !== null && line.unit_price !== '';

    return {
      ...line,
      tax_id: taxId,
      tax_rate: taxRate,
      // The price is the one on the line when given. Falling back to the
      // product's current price is only for a line that never had one —
      // a posted document must never be repriced by a later master change.
      unit_price: hasExplicitPrice ? line.unit_price : (product?.[config.priceField] ?? 0),
      [config.accountField]:
        line[config.accountField] || product?.[config.productAccountField] || null,
      description: (line.description || product?.description || product?.name || '').trim(),
    };
  });

  return computeLineTotals(enriched, config);
}

module.exports = {
  computeLineTotals,
  resolveAndComputeLines,
  PURCHASE_CONFIG,
  SALES_CONFIG,
};
