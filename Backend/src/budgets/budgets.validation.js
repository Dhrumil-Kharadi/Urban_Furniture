/**
 * Budgets Validation
 *
 * Pure functions returning { isValid, errors, data? }.
 * Reference: project.md §4.7, §8 · technicalrequirement.md §6.7
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

const BUDGET_STATUSES = ['active', 'archived', 'closed'];

/** @private */
function checkFields(body, errors, partial = false) {
  const data = {};

  // ── name ──
  if (body.name !== undefined || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      errors.push('Budget name is required');
    } else if (name.length < 2 || name.length > 150) {
      errors.push('Budget name must be between 2 and 150 characters');
    } else {
      data.name = name;
    }
  }

  // ── period_start & period_end ──
  if (body.period_start !== undefined || !partial) {
    if (!body.period_start || !isDate(body.period_start)) {
      errors.push('Valid period start date (YYYY-MM-DD) is required');
    } else {
      data.period_start = String(body.period_start).slice(0, 10);
    }
  }

  if (body.period_end !== undefined || !partial) {
    if (!body.period_end || !isDate(body.period_end)) {
      errors.push('Valid period end date (YYYY-MM-DD) is required');
    } else {
      data.period_end = String(body.period_end).slice(0, 10);
    }
  }

  // Date range order check
  if (data.period_start && data.period_end && data.period_end < data.period_start) {
    errors.push('Period end date cannot be earlier than period start date');
  }

  // ── analytic_account_id ──
  if (body.analytic_account_id !== undefined || !partial) {
    if (!body.analytic_account_id || !isUuid(body.analytic_account_id)) {
      errors.push('Valid analytic account ID is required');
    } else {
      data.analytic_account_id = body.analytic_account_id;
    }
  }

  // ── responsible_user_id ──
  if (body.responsible_user_id !== undefined) {
    if (body.responsible_user_id === null || body.responsible_user_id === '') {
      data.responsible_user_id = null;
    } else if (!isUuid(body.responsible_user_id)) {
      errors.push('Responsible user ID must be a valid UUID');
    } else {
      data.responsible_user_id = body.responsible_user_id;
    }
  }

  // ── planned_amount ──
  if (body.planned_amount !== undefined || !partial) {
    const rawAmount = String(body.planned_amount ?? '').trim();
    if (!rawAmount || isNaN(Number(rawAmount)) || Number(rawAmount) < 0) {
      errors.push('Planned amount must be a positive number or zero');
    } else {
      data.planned_amount = Number(rawAmount).toFixed(2);
    }
  }

  // ── status ──
  if (body.status !== undefined) {
    if (!BUDGET_STATUSES.includes(body.status)) {
      errors.push(`Status must be one of: ${BUDGET_STATUSES.join(', ')}`);
    } else {
      data.status = body.status;
    }
  }

  return data;
}

const budgetsValidation = {
  validateCreate(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];
    const data = checkFields(body, errors, false);

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: {
        name: data.name,
        period_start: data.period_start,
        period_end: data.period_end,
        analytic_account_id: data.analytic_account_id,
        responsible_user_id: data.responsible_user_id ?? null,
        planned_amount: data.planned_amount,
        status: data.status || 'active',
      },
    };
  },

  validateUpdate(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];
    const data = checkFields(body, errors, true);

    if (errors.length === 0 && Object.keys(data).length === 0) {
      errors.push('No updatable fields were provided');
    }

    if (errors.length > 0) return { isValid: false, errors };

    return { isValid: true, errors: [], data };
  },

  validateListQuery(query = {}) {
    const errors = [];
    if (query.status && !BUDGET_STATUSES.includes(query.status)) {
      errors.push(`Status filter must be one of: ${BUDGET_STATUSES.join(', ')}`);
    }
    if (query.analytic_account_id && !isUuid(query.analytic_account_id)) {
      errors.push('analytic_account_id must be a valid UUID');
    }
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
};

module.exports = budgetsValidation;
