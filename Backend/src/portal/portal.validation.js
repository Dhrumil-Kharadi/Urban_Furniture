/**
 * Portal Validation
 *
 * Pure functions returning { isValid, errors, data? }.
 * Reference: project.md §5.3 · technicalrequirement.md §6.12
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

function isDate(val) {
  if (typeof val !== 'string' || !DATE_REGEX.test(val)) return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
}

const portalValidation = {
  validateListQuery(query = {}) {
    const errors = [];
    if (query.dateFrom && !isDate(query.dateFrom)) {
      errors.push('dateFrom must be a valid date (YYYY-MM-DD)');
    }
    if (query.dateTo && !isDate(query.dateTo)) {
      errors.push('dateTo must be a valid date (YYYY-MM-DD)');
    }
    if (query.dateFrom && query.dateTo && query.dateTo < query.dateFrom) {
      errors.push('dateTo cannot be earlier than dateFrom');
    }

    if (errors.length > 0) return { isValid: false, errors };
    return { isValid: true, errors: [], data: query };
  },

  validatePayIntent(params) {
    const errors = [];
    if (!params.id || !isUuid(params.id)) {
      errors.push('Valid invoice UUID is required');
    }
    if (errors.length > 0) return { isValid: false, errors };
    return { isValid: true, errors: [], data: { invoiceId: params.id } };
  },

  validateVerifyPayment(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];
    const { invoiceId, orderId, paymentId, signature } = body;

    if (!invoiceId || !isUuid(invoiceId)) {
      errors.push('Valid invoiceId UUID is required');
    }
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      errors.push('Valid orderId is required');
    }
    if (!paymentId || typeof paymentId !== 'string' || !paymentId.trim()) {
      errors.push('Valid paymentId is required');
    }
    if (!signature || typeof signature !== 'string' || !signature.trim()) {
      errors.push('Valid gateway signature is required');
    }

    if (errors.length > 0) return { isValid: false, errors };
    return {
      isValid: true,
      errors: [],
      data: {
        invoiceId,
        orderId: orderId.trim(),
        paymentId: paymentId.trim(),
        signature: signature.trim(),
      },
    };
  },
};

module.exports = portalValidation;
