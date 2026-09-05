// ============================================================
// FILE: src/lib/minorUnits.js
//
// Exact money arithmetic on the client, without a dependency.
//
// The manual entry form has to tell the operator whether their entry balances
// BEFORE they submit it. Doing that with `Number(a) + Number(b)` would be the
// one place a float creeps into an otherwise decimal-clean system, and it
// would be wrong in exactly the cases that matter: 0.1 + 0.2 !== 0.3, so a
// genuinely balanced entry could be shown as off by a hundredth.
//
// So amounts are converted to integer PAISE (hundredths), summed as integers,
// and formatted back. Every value here is an exact integer; nothing rounds.
//
// This is a display aid only. THE SERVER REMAINS THE AUTHORITY — it re-checks
// through decimal.js, and the database re-checks again in a trigger.
// ============================================================

/** Amounts the NUMERIC(15,2) column can hold, as typed by a person. */
const AMOUNT_PATTERN = /^-?\d{0,13}(\.\d{0,2})?$/;

/**
 * Convert a decimal string to integer hundredths.
 *
 * @param {string|number|null} value
 * @returns {number} Paise. 0 for anything unparseable, so a half-typed field
 *   reads as zero rather than NaN-poisoning the whole total.
 */
export function toMinorUnits(value) {
  if (value === null || value === undefined || value === '') return 0;

  const raw = String(value).trim();
  if (!AMOUNT_PATTERN.test(raw)) return 0;

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole = '0', fraction = ''] = unsigned.split('.');

  // Pad or trim to exactly two decimal places without touching a float.
  const paise = `${fraction}00`.slice(0, 2);
  const magnitude = Number(`${whole || '0'}${paise}`);

  if (!Number.isSafeInteger(magnitude)) return 0;
  return negative ? -magnitude : magnitude;
}

/**
 * Format integer hundredths back to a 2dp decimal string.
 *
 * @param {number} minor
 * @returns {string} e.g. '1234.56'
 */
export function fromMinorUnits(minor) {
  const negative = minor < 0;
  const magnitude = Math.abs(Math.trunc(minor));
  const whole = Math.floor(magnitude / 100);
  const paise = String(magnitude % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${paise}`;
}

/**
 * Sum a list of decimal strings exactly.
 *
 * @param {Array<string|number>} values
 * @returns {number} Total in paise.
 */
export function sumMinorUnits(values) {
  return values.reduce((total, value) => total + toMinorUnits(value), 0);
}

/**
 * Whether a string is a shape the amount inputs should accept while typing.
 * Deliberately permissive about a trailing dot so '12.' is not rejected
 * mid-keystroke.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isAmountInput(value) {
  return value === '' || /^\d{0,13}(\.\d{0,2})?$/.test(String(value));
}
