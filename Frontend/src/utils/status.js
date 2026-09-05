/**
 * utils/status.js
 * Maps document and entity status strings to tone styles and i18n keys.
 */

/**
 * Maps status string to design tone.
 * Tones: 'draft' | 'posted' | 'paid' | 'cancelled' | 'overdue' | 'active' | 'neutral'
 *
 * @param {string} status
 * @returns {string}
 */
export function statusToTone(status) {
  if (!status) return 'neutral';
  const s = String(status).toLowerCase().trim();

  switch (s) {
    case 'draft':
      return 'draft';
    case 'posted':
    case 'confirmed':
      return 'posted';
    case 'paid':
    case 'active':
      return 'paid';
    case 'partial':
    case 'partially_paid':
      return 'partial';
    case 'cancelled':
    case 'inactive':
    case 'archived':
      return 'cancelled';
    case 'overdue':
      return 'overdue';
    case 'open':
      return 'posted';
    case 'closed':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/**
 * Maps status to translation key inside `common.status`.
 *
 * @param {string} status
 * @returns {string}
 */
export function statusToLabelKey(status) {
  if (!status) return 'draft';
  const s = String(status).toLowerCase().trim();

  switch (s) {
    case 'draft':
      return 'draft';
    case 'posted':
      return 'posted';
    case 'cancelled':
      return 'cancelled';
    case 'unpaid':
      return 'unpaid';
    case 'partial':
    case 'partially_paid':
      return 'partiallyPaid';
    case 'paid':
      return 'paid';
    case 'overdue':
      return 'overdue';
    case 'active':
      return 'active';
    case 'inactive':
      return 'inactive';
    case 'archived':
      return 'archived';
    case 'open':
      return 'open';
    case 'closed':
      return 'closed';
    case 'pending':
      return 'pending';
    case 'confirmed':
      return 'confirmed';
    default:
      return s;
  }
}
