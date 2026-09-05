/**
 * Product Categories Validation
 *
 * Pure functions returning { isValid, errors, data? }.
 */

const { PRODUCT_CATEGORY_STATUS } = require('../shared/constants');

const STATUSES = Object.values(PRODUCT_CATEGORY_STATUS);

/** @private */
function optionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

/** @private */
function checkFields(body, errors, partial) {
  const data = {};

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

  if (body.description !== undefined) {
    const description = optionalText(body.description);
    if (description !== null && description.length > 500) {
      errors.push('Description must not exceed 500 characters');
    } else {
      data.description = description;
    }
  }

  return data;
}

const productCategoriesValidation = {
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
      data: { name: data.name, description: data.description ?? null },
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

    if (errors.length > 0) return { isValid: false, errors };

    return { isValid: true, errors: [], data: { status: query.status || null } };
  },
};

module.exports = productCategoriesValidation;
