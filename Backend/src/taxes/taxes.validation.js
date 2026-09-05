'use strict';

const { TAX_SCOPE, TAX_COMPUTATION } = require('../shared/constants');

const VALID_SCOPES = Object.values(TAX_SCOPE);
const VALID_COMPUTATIONS = Object.values(TAX_COMPUTATION);

/**
 * Validate create tax payload.
 */
function validateCreateTax(payload = {}) {
  const errors = [];
  const {
    name,
    rate,
    tax_scope,
    computation,
    collected_account_id,
    paid_account_id,
  } = payload;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Tax name must be at least 2 characters');
  } else if (name.trim().length > 100) {
    errors.push('Tax name cannot exceed 100 characters');
  }

  if (rate === undefined || rate === null || rate === '') {
    errors.push('Tax rate is required');
  } else {
    const numRate = Number(rate);
    if (isNaN(numRate)) {
      errors.push('Tax rate must be a valid number');
    } else if (numRate < 0 || numRate > 100) {
      errors.push('Tax rate must be between 0 and 100');
    }
  }

  const normalizedScope = tax_scope ? String(tax_scope).toLowerCase().trim() : 'both';
  if (!VALID_SCOPES.includes(normalizedScope)) {
    errors.push(`Tax scope must be one of: ${VALID_SCOPES.join(', ')}`);
  }

  const normalizedComputation = computation ? String(computation).toLowerCase().trim() : 'percentage';
  if (!VALID_COMPUTATIONS.includes(normalizedComputation)) {
    errors.push(`Computation must be one of: ${VALID_COMPUTATIONS.join(', ')}`);
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let validCollectedAcc = null;
  if (collected_account_id !== undefined && collected_account_id !== null && collected_account_id !== '') {
    if (!uuidRegex.test(collected_account_id)) {
      errors.push('Collected tax account ID (Output) must be a valid UUID');
    } else {
      validCollectedAcc = collected_account_id;
    }
  }

  let validPaidAcc = null;
  if (paid_account_id !== undefined && paid_account_id !== null && paid_account_id !== '') {
    if (!uuidRegex.test(paid_account_id)) {
      errors.push('Paid tax account ID (Input) must be a valid UUID');
    } else {
      validPaidAcc = paid_account_id;
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      name: name.trim(),
      rate: Number(rate).toFixed(4),
      tax_scope: normalizedScope,
      computation: normalizedComputation,
      collected_account_id: validCollectedAcc,
      paid_account_id: validPaidAcc,
    },
  };
}

/**
 * Validate update tax payload.
 */
function validateUpdateTax(payload = {}) {
  const errors = [];
  const data = {};
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (payload.name !== undefined) {
    if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length < 2) {
      errors.push('Tax name must be at least 2 characters');
    } else if (payload.name.trim().length > 100) {
      errors.push('Tax name cannot exceed 100 characters');
    } else {
      data.name = payload.name.trim();
    }
  }

  if (payload.rate !== undefined) {
    const numRate = Number(payload.rate);
    if (isNaN(numRate)) {
      errors.push('Tax rate must be a valid number');
    } else if (numRate < 0 || numRate > 100) {
      errors.push('Tax rate must be between 0 and 100');
    } else {
      data.rate = numRate.toFixed(4);
    }
  }

  if (payload.tax_scope !== undefined) {
    const normalizedScope = String(payload.tax_scope).toLowerCase().trim();
    if (!VALID_SCOPES.includes(normalizedScope)) {
      errors.push(`Tax scope must be one of: ${VALID_SCOPES.join(', ')}`);
    } else {
      data.tax_scope = normalizedScope;
    }
  }

  if (payload.computation !== undefined) {
    const normalizedComp = String(payload.computation).toLowerCase().trim();
    if (!VALID_COMPUTATIONS.includes(normalizedComp)) {
      errors.push(`Computation must be one of: ${VALID_COMPUTATIONS.join(', ')}`);
    } else {
      data.computation = normalizedComp;
    }
  }

  if (payload.collected_account_id !== undefined) {
    if (payload.collected_account_id === null || payload.collected_account_id === '') {
      data.collected_account_id = null;
    } else if (!uuidRegex.test(payload.collected_account_id)) {
      errors.push('Collected tax account ID must be a valid UUID');
    } else {
      data.collected_account_id = payload.collected_account_id;
    }
  }

  if (payload.paid_account_id !== undefined) {
    if (payload.paid_account_id === null || payload.paid_account_id === '') {
      data.paid_account_id = null;
    } else if (!uuidRegex.test(payload.paid_account_id)) {
      errors.push('Paid tax account ID must be a valid UUID');
    } else {
      data.paid_account_id = payload.paid_account_id;
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], data };
}

module.exports = {
  validateCreateTax,
  validateUpdateTax,
};
