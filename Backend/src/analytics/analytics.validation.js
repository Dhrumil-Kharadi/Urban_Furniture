/**
 * Analytic Accounts Validation
 *
 * Pure functions returning { isValid, errors, data? }.
 */

const { ANALYTIC_TYPES, ANALYTIC_STATUS } = require('../shared/constants');

const TYPES = Object.values(ANALYTIC_TYPES);
const STATUSES = Object.values(ANALYTIC_STATUS);

/** Codes are short handles: letters, digits and dot/dash separators. */
const CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9.-]{0,49}$/;

/** @private */
function optionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

/** @private */
function checkFields(body, errors, partial) {
  const data = {};

  // ── name ──
  if (body.name !== undefined || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      errors.push('Name is required');
    } else if (name.length < 2 || name.length > 150) {
      errors.push('Name must be between 2 and 150 characters');
    } else {
      data.name = name;
    }
  }

  // ── analytic_type ──
  if (body.analytic_type !== undefined || !partial) {
    if (!TYPES.includes(body.analytic_type)) {
      errors.push(`Type is required and must be one of: ${TYPES.join(', ')}`);
    } else {
      data.analytic_type = body.analytic_type;
    }
  }

  // ── code ──
  if (body.code !== undefined) {
    const code = optionalText(body.code);
    if (code === null) {
      data.code = null;
    } else if (!CODE_REGEX.test(code)) {
      errors.push('Code may contain only letters, digits, dot and dash');
    } else {
      data.code = code.toUpperCase();
    }
  }

  // ── department ── the optional descriptive field of project.md §4.6
  if (body.department !== undefined) {
    const department = optionalText(body.department);
    if (department !== null && department.length > 150) {
      errors.push('Department must not exceed 150 characters');
    } else {
      data.department = department;
    }
  }

  return data;
}

const analyticsValidation = {
  /**
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
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
        analytic_type: data.analytic_type,
        code: data.code ?? null,
        department: data.department ?? null,
      },
    };
  },

  /**
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
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

  /**
   * @param {object} query
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateListQuery(query = {}) {
    const errors = [];

    if (query.status !== undefined && query.status !== '' && !STATUSES.includes(query.status)) {
      errors.push(`Status filter must be one of: ${STATUSES.join(', ')}`);
    }

    if (query.type !== undefined && query.type !== '' && !TYPES.includes(query.type)) {
      errors.push(`Type filter must be one of: ${TYPES.join(', ')}`);
    }

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: { status: query.status || null, type: query.type || null },
    };
  },
};

module.exports = analyticsValidation;
