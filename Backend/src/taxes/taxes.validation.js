/**
 * Taxes Validation
 *
 * Pure functions returning { isValid, errors, data? }.
 *
 * RATE: NUMERIC(7,4), carried as a STRING. A rate is arithmetic input to every
 * invoice line, so it never becomes a JS float on the way in.
 */

const { TAX_SCOPE, TAX_STATUS } = require('../shared/constants');
const { money } = require('../shared/money');

const SCOPES = Object.values(TAX_SCOPE);
const STATUSES = Object.values(TAX_STATUS);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @private */
function optionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Validate the rate and normalise it to the column's 4dp scale.
 * @private
 */
function checkRate(value, errors, data, required) {
  if (value === undefined) {
    if (required) errors.push('Rate is required');
    return;
  }

  if (value === null || value === '') {
    errors.push('Rate is required');
    return;
  }

  // Plain decimal only — Decimal would otherwise accept hex and exponent forms.
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(String(value).trim())) {
    errors.push('Rate must be a decimal percentage');
    return;
  }

  const rate = money(value);

  if (rate.isNegative() || rate.greaterThan(money('100'))) {
    errors.push('Rate must be between 0 and 100');
    return;
  }

  data.rate = rate.toFixed(4);
}

/** @private */
function checkFields(body, errors, partial) {
  const data = {};

  // ── name ──
  if (body.name !== undefined || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      errors.push('Name is required');
    } else if (name.length < 2 || name.length > 100) {
      errors.push('Name must be between 2 and 100 characters');
    } else {
      data.name = name;
    }
  }

  checkRate(body.rate, errors, data, !partial);

  // ── tax_scope ──
  if (body.tax_scope !== undefined) {
    if (!SCOPES.includes(body.tax_scope)) {
      errors.push(`Scope must be one of: ${SCOPES.join(', ')}`);
    } else {
      data.tax_scope = body.tax_scope;
    }
  }

  // ── tax_account_id ──
  // That the account is a liability or an asset is checked in the service,
  // where the account can actually be loaded.
  if (body.tax_account_id !== undefined) {
    const accountId = optionalText(body.tax_account_id);
    if (accountId === null) {
      data.tax_account_id = null;
    } else if (!UUID_REGEX.test(accountId)) {
      errors.push('Tax account must be a valid id');
    } else {
      data.tax_account_id = accountId;
    }
  }

  return data;
}

const taxesValidation = {
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
        rate: data.rate,
        // Phase 0 Decision 4 puts tax on both sides, so 'both' is the default
        // rather than a choice the operator has to remember to make.
        tax_scope: data.tax_scope ?? TAX_SCOPE.BOTH,
        tax_account_id: data.tax_account_id ?? null,
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

    if (query.scope !== undefined && query.scope !== '' && !SCOPES.includes(query.scope)) {
      errors.push(`Scope filter must be one of: ${SCOPES.join(', ')}`);
    }

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: { status: query.status || null, scope: query.scope || null },
    };
  },
};

module.exports = taxesValidation;
