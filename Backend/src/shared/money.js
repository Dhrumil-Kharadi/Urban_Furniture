/**
 * Money Arithmetic Engine
 *
 * CRITICAL ACCOUNTING RULE:
 * node-postgres returns PostgreSQL NUMERIC(15,2) as JavaScript STRINGS.
 * NEVER install a global type parser (types.setTypeParser(1700, ...)) to parse
 * numeric into JavaScript Numbers — that reintroduces binary floating-point error
 * (e.g. 0.1 + 0.2 === 0.30000000000000004).
 *
 * All money arithmetic in this application MUST go through this file.
 * Rounding mode: ROUND_HALF_UP at 2 decimal places.
 */

const Decimal = require('decimal.js');

// Configure Decimal defaults for accounting precision
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Instantiate a Decimal from a string, number, or Decimal.
 * Returns Decimal instance for raw calculations.
 *
 * @param {string|number|Decimal} v
 * @returns {Decimal}
 */
function money(v) {
  if (v instanceof Decimal) return v;
  if (v === null || v === undefined || v === '') return new Decimal(0);
  return new Decimal(v);
}

/**
 * Format a Decimal / value as a 2-decimal-place string for database insertion.
 *
 * @param {string|number|Decimal} d
 * @returns {string} e.g. "1250.50"
 */
function toDb(d) {
  return money(d).toFixed(2);
}

/**
 * Round a value to 2 decimal places using ROUND_HALF_UP.
 *
 * @param {string|number|Decimal} v
 * @returns {string}
 */
function round2(v) {
  return money(v).toFixed(2);
}

/**
 * Add two values and return rounded 2dp string.
 *
 * @param {string|number|Decimal} a
 * @param {string|number|Decimal} b
 * @returns {string}
 */
function add(a, b) {
  return money(a).plus(money(b)).toFixed(2);
}

/**
 * Subtract b from a and return rounded 2dp string.
 *
 * @param {string|number|Decimal} a
 * @param {string|number|Decimal} b
 * @returns {string}
 */
function sub(a, b) {
  return money(a).minus(money(b)).toFixed(2);
}

/**
 * Multiply two values and return rounded 2dp string.
 *
 * @param {string|number|Decimal} a
 * @param {string|number|Decimal} b
 * @returns {string}
 */
function mul(a, b) {
  return money(a).times(money(b)).toFixed(2);
}

/**
 * Divide a by b and return rounded 2dp string.
 * Throws on division by zero.
 *
 * @param {string|number|Decimal} a
 * @param {string|number|Decimal} b
 * @returns {string}
 */
function div(a, b) {
  const divisor = money(b);
  if (divisor.isZero()) {
    throw new Error('Division by zero in money calculation');
  }
  return money(a).dividedBy(divisor).toFixed(2);
}

/**
 * Check if value is zero.
 *
 * @param {string|number|Decimal} v
 * @returns {boolean}
 */
function isZero(v) {
  return money(v).isZero();
}

/**
 * Check if a == b.
 *
 * @param {string|number|Decimal} a
 * @param {string|number|Decimal} b
 * @returns {boolean}
 */
function eq(a, b) {
  return money(a).equals(money(b));
}

/**
 * Check if a > b.
 *
 * @param {string|number|Decimal} a
 * @param {string|number|Decimal} b
 * @returns {boolean}
 */
function gt(a, b) {
  return money(a).greaterThan(money(b));
}

/**
 * Check if a < b.
 *
 * @param {string|number|Decimal} a
 * @param {string|number|Decimal} b
 * @returns {boolean}
 */
function lt(a, b) {
  return money(a).lessThan(money(b));
}

/**
 * Sum an array of values and return a 2dp string.
 *
 * @param {Array<string|number|Decimal>} arr
 * @returns {string}
 */
function sum(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '0.00';
  const total = arr.reduce((acc, curr) => acc.plus(money(curr)), new Decimal(0));
  return total.toFixed(2);
}

module.exports = {
  Decimal,
  money,
  toDb,
  round2,
  add,
  sub,
  mul,
  div,
  isZero,
  eq,
  gt,
  lt,
  sum,
};
