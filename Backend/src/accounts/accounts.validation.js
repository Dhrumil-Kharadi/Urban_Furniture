'use strict';

const { ACCOUNT_TYPES } = require('../shared/constants');

const VALID_TYPES = Object.values(ACCOUNT_TYPES);

/**
 * Validate create account payload.
 *
 * @param {object} payload
 * @returns {{ isValid: boolean, errors: string[], data?: object }}
 */
function validateCreateAccount(payload = {}) {
  const errors = [];
  const { code, name, account_type, parent_account_id, opening_balance, description } = payload;

  if (!code || typeof code !== 'string' || !code.trim()) {
    errors.push('Account code is required');
  } else if (code.trim().length > 50) {
    errors.push('Account code cannot exceed 50 characters');
  }

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Account name must be at least 2 characters');
  } else if (name.trim().length > 150) {
    errors.push('Account name cannot exceed 150 characters');
  }

  const normalizedType = account_type ? String(account_type).toLowerCase().trim() : '';
  if (!normalizedType || !VALID_TYPES.includes(normalizedType)) {
    errors.push(`Account type must be one of: ${[...new Set(VALID_TYPES)].join(', ')}`);
  }

  let validParentId = null;
  if (parent_account_id !== undefined && parent_account_id !== null && parent_account_id !== '') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(parent_account_id)) {
      errors.push('Parent account ID must be a valid UUID');
    } else {
      validParentId = parent_account_id;
    }
  }

  let validOpeningBalance = '0.00';
  if (opening_balance !== undefined && opening_balance !== null && opening_balance !== '') {
    const num = Number(opening_balance);
    if (isNaN(num)) {
      errors.push('Opening balance must be a valid number');
    } else {
      validOpeningBalance = Number(opening_balance).toFixed(2);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      code: code.trim(),
      name: name.trim(),
      account_type: normalizedType === 'equity' ? 'capital' : normalizedType,
      parent_account_id: validParentId,
      opening_balance: validOpeningBalance,
      description: description ? String(description).trim() : null,
    },
  };
}

/**
 * Validate update account payload.
 *
 * @param {object} payload
 * @returns {{ isValid: boolean, errors: string[], data?: object }}
 */
function validateUpdateAccount(payload = {}) {
  const errors = [];
  const data = {};

  if (payload.code !== undefined) {
    if (!payload.code || typeof payload.code !== 'string' || !payload.code.trim()) {
      errors.push('Account code cannot be empty');
    } else if (payload.code.trim().length > 50) {
      errors.push('Account code cannot exceed 50 characters');
    } else {
      data.code = payload.code.trim();
    }
  }

  if (payload.name !== undefined) {
    if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length < 2) {
      errors.push('Account name must be at least 2 characters');
    } else if (payload.name.trim().length > 150) {
      errors.push('Account name cannot exceed 150 characters');
    } else {
      data.name = payload.name.trim();
    }
  }

  if (payload.account_type !== undefined) {
    const normalizedType = String(payload.account_type).toLowerCase().trim();
    if (!VALID_TYPES.includes(normalizedType)) {
      errors.push(`Account type must be one of: ${[...new Set(VALID_TYPES)].join(', ')}`);
    } else {
      data.account_type = normalizedType === 'equity' ? 'capital' : normalizedType;
    }
  }

  if (payload.parent_account_id !== undefined) {
    if (payload.parent_account_id === null || payload.parent_account_id === '') {
      data.parent_account_id = null;
    } else {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(payload.parent_account_id)) {
        errors.push('Parent account ID must be a valid UUID');
      } else {
        data.parent_account_id = payload.parent_account_id;
      }
    }
  }

  if (payload.opening_balance !== undefined) {
    const num = Number(payload.opening_balance);
    if (isNaN(num)) {
      errors.push('Opening balance must be a valid number');
    } else {
      data.opening_balance = Number(payload.opening_balance).toFixed(2);
    }
  }

  if (payload.description !== undefined) {
    data.description = payload.description ? String(payload.description).trim() : null;
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], data };
}

module.exports = {
  validateCreateAccount,
  validateUpdateAccount,
};
