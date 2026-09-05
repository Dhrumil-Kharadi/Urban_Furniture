/**
 * Journals Validation
 *
 * Pure functions returning { isValid, errors, data? }.
 */

const { JOURNAL_TYPES, JOURNAL_STATUS } = require('../shared/constants');

const TYPES = Object.values(JOURNAL_TYPES);
const STATUSES = Object.values(JOURNAL_STATUS);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Sequence prefixes appear in document numbers, so they stay short and plain. */
const PREFIX_REGEX = /^[A-Za-z0-9-]{1,10}$/;

/** @private */
function optionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Validate an optional default-account reference. Existence, tenancy and
 * active status are the service's job; only the shape is decided here.
 * @private
 */
function checkAccountRef(field, label, value, errors, data) {
  if (value === undefined) return;

  const id = optionalText(value);
  if (id === null) {
    data[field] = null;
    return;
  }

  if (!UUID_REGEX.test(id)) {
    errors.push(`${label} must be a valid id`);
    return;
  }

  data[field] = id;
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

  // ── journal_type ──
  if (body.journal_type !== undefined || !partial) {
    if (!TYPES.includes(body.journal_type)) {
      errors.push(`Type is required and must be one of: ${TYPES.join(', ')}`);
    } else {
      data.journal_type = body.journal_type;
    }
  }

  // ── sequence_prefix ──
  if (body.sequence_prefix !== undefined) {
    const prefix = optionalText(body.sequence_prefix);
    if (prefix === null) {
      data.sequence_prefix = null;
    } else if (!PREFIX_REGEX.test(prefix)) {
      errors.push('Sequence prefix may contain up to 10 letters, digits or dashes');
    } else {
      data.sequence_prefix = prefix.toUpperCase();
    }
  }

  checkAccountRef(
    'default_debit_account_id', 'Default debit account', body.default_debit_account_id, errors, data
  );
  checkAccountRef(
    'default_credit_account_id', 'Default credit account', body.default_credit_account_id, errors, data
  );

  return data;
}

const journalsValidation = {
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
        journal_type: data.journal_type,
        sequence_prefix: data.sequence_prefix ?? null,
        default_debit_account_id: data.default_debit_account_id ?? null,
        default_credit_account_id: data.default_credit_account_id ?? null,
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

module.exports = journalsValidation;
