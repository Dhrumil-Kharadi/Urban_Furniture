/**
 * Accounts Validation (Chart of Accounts)
 *
 * Pure functions returning { isValid, errors, data? }.
 *
 * MONEY: opening_balance is validated through shared/money.js and carried as a
 * fixed-2dp STRING. It is never parsed into a JS number.
 */

const { ACCOUNT_TYPES, ACCOUNT_STATUS } = require('../shared/constants');
const { money, toDb } = require('../shared/money');

const TYPES = Object.values(ACCOUNT_TYPES);
const STATUSES = Object.values(ACCOUNT_STATUS);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Account codes are short handles: digits, letters and dot/dash separators. */
const CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9.-]{0,49}$/;

/** Widest value NUMERIC(15,2) can hold. An opening balance may be negative. */
const MAX_BALANCE = '9999999999999.99';

/** @private */
function optionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Validate the opening balance and normalise it to a 2dp string.
 *
 * A plain-decimal shape check runs before decimal.js sees the value: Decimal
 * accepts hex and exponent forms that have no business being a balance.
 * @private
 */
function checkOpeningBalance(value, errors, data) {
  if (value === undefined) return;

  if (value === null || value === '') {
    data.opening_balance = '0.00';
    return;
  }

  if (!/^-?\d{1,13}(\.\d{1,4})?$/.test(String(value).trim())) {
    errors.push('Opening balance must be a decimal amount');
    return;
  }

  const amount = money(value);

  if (amount.abs().greaterThan(money(MAX_BALANCE))) {
    errors.push('Opening balance is too large');
    return;
  }

  data.opening_balance = toDb(amount);
}

/** @private */
function checkFields(body, errors, partial) {
  const data = {};

  // ── code ──
  if (body.code !== undefined || !partial) {
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!code) {
      errors.push('Code is required');
    } else if (!CODE_REGEX.test(code)) {
      errors.push('Code may contain only letters, digits, dot and dash');
    } else {
      data.code = code;
    }
  }

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

  // ── account_type ──
  if (body.account_type !== undefined || !partial) {
    if (!TYPES.includes(body.account_type)) {
      errors.push(`Type is required and must be one of: ${TYPES.join(', ')}`);
    } else {
      data.account_type = body.account_type;
    }
  }

  // ── parent_account_id ──
  // Existence, tenancy, type agreement and cycle-freedom are the service's
  // job; only the shape is decided here.
  if (body.parent_account_id !== undefined) {
    const parent = optionalText(body.parent_account_id);
    if (parent === null) {
      data.parent_account_id = null;
    } else if (!UUID_REGEX.test(parent)) {
      errors.push('Parent account must be a valid id');
    } else {
      data.parent_account_id = parent;
    }
  }

  checkOpeningBalance(body.opening_balance, errors, data);

  return data;
}

const accountsValidation = {
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
        code: data.code,
        name: data.name,
        account_type: data.account_type,
        parent_account_id: data.parent_account_id ?? null,
        opening_balance: data.opening_balance ?? '0.00',
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

module.exports = accountsValidation;
