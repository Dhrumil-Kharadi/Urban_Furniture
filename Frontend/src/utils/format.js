/**
 * utils/format.js
 * Locale-aware formatting utilities for money, dates, numbers, and percentages.
 * Adheres strictly to the single currency (INR) and technicalrequirement.md §13.2.
 */

/**
 * Format monetary amount into localized currency string (INR).
 * Defaults to 'en-IN' if locale is not provided.
 *
 * @param {string|number} amount
 * @param {string} [locale='en']
 * @param {string} [currency='INR']
 * @returns {string}
 */
export function formatMoney(amount, locale = 'en', currency = 'INR') {
  if (amount === null || amount === undefined || amount === '') {
    return '—';
  }

  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numeric)) {
    return '—';
  }

  const bcpLocale = locale === 'hi' ? 'hi-IN' : locale === 'gu' ? 'gu-IN' : 'en-IN';

  try {
    return new Intl.NumberFormat(bcpLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `₹${numeric.toFixed(2)}`;
  }
}

/**
 * Format date into localized human-readable string.
 *
 * @param {string|Date} date
 * @param {string} [locale='en']
 * @param {object} [options]
 * @returns {string}
 */
export function formatDate(date, locale = 'en', options = {}) {
  if (!date) return '—';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const bcpLocale = locale === 'hi' ? 'hi-IN' : locale === 'gu' ? 'gu-IN' : 'en-IN';

  const defaultOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(bcpLocale, defaultOptions).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Format plain number with thousand separators.
 *
 * @param {number|string} num
 * @param {string} [locale='en']
 * @returns {string}
 */
export function formatNumber(num, locale = 'en') {
  if (num === null || num === undefined || num === '') return '0';
  const numeric = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(numeric)) return '0';

  const bcpLocale = locale === 'hi' ? 'hi-IN' : locale === 'gu' ? 'gu-IN' : 'en-IN';
  return new Intl.NumberFormat(bcpLocale).format(numeric);
}

/**
 * Format percentage.
 *
 * @param {number|string} rate
 * @param {string} [locale='en']
 * @returns {string}
 */
export function formatPercent(rate, locale = 'en') {
  if (rate === null || rate === undefined || rate === '') return '0%';
  const numeric = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (isNaN(numeric)) return '0%';

  const bcpLocale = locale === 'hi' ? 'hi-IN' : locale === 'gu' ? 'gu-IN' : 'en-IN';
  return new Intl.NumberFormat(bcpLocale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric / 100);
}
