'use strict';

const { ANALYTIC_TYPES } = require('../shared/constants');

const VALID_ANALYTIC_TYPES = Object.values(ANALYTIC_TYPES);

/**
 * Validate create analytic account payload.
 */
function validateCreateAnalyticAccount(payload = {}) {
  const errors = [];
  const { name, code, analytic_type, type, department_or_project, department } = payload;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Analytic account name must be at least 2 characters');
  } else if (name.trim().length > 150) {
    errors.push('Analytic account name cannot exceed 150 characters');
  }

  const rawType = analytic_type || type;
  const normalizedType = rawType ? String(rawType).toLowerCase().trim() : '';
  if (!normalizedType || !VALID_ANALYTIC_TYPES.includes(normalizedType)) {
    errors.push(`Analytic type must be one of: ${VALID_ANALYTIC_TYPES.join(', ')}`);
  }

  let validCode = null;
  if (code !== undefined && code !== null && code !== '') {
    if (typeof code !== 'string' || code.trim().length > 50) {
      errors.push('Code cannot exceed 50 characters');
    } else {
      validCode = code.trim();
    }
  }

  const rawDept = department_or_project || department;
  let validDept = null;
  if (rawDept !== undefined && rawDept !== null && rawDept !== '') {
    if (typeof rawDept !== 'string' || rawDept.trim().length > 100) {
      errors.push('Department or project cannot exceed 100 characters');
    } else {
      validDept = rawDept.trim();
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
      code: validCode,
      analytic_type: normalizedType,
      department_or_project: validDept,
    },
  };
}

/**
 * Validate update analytic account payload.
 */
function validateUpdateAnalyticAccount(payload = {}) {
  const errors = [];
  const data = {};

  if (payload.name !== undefined) {
    if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length < 2) {
      errors.push('Analytic account name must be at least 2 characters');
    } else if (payload.name.trim().length > 150) {
      errors.push('Analytic account name cannot exceed 150 characters');
    } else {
      data.name = payload.name.trim();
    }
  }

  const rawType = payload.analytic_type || payload.type;
  if (rawType !== undefined) {
    const normalizedType = String(rawType).toLowerCase().trim();
    if (!VALID_ANALYTIC_TYPES.includes(normalizedType)) {
      errors.push(`Analytic type must be one of: ${VALID_ANALYTIC_TYPES.join(', ')}`);
    } else {
      data.analytic_type = normalizedType;
    }
  }

  if (payload.code !== undefined) {
    if (payload.code === null || payload.code === '') {
      data.code = null;
    } else if (typeof payload.code !== 'string' || payload.code.trim().length > 50) {
      errors.push('Code cannot exceed 50 characters');
    } else {
      data.code = payload.code.trim();
    }
  }

  const rawDept = payload.department_or_project || payload.department;
  if (rawDept !== undefined) {
    if (rawDept === null || rawDept === '') {
      data.department_or_project = null;
    } else if (typeof rawDept !== 'string' || rawDept.trim().length > 100) {
      errors.push('Department or project cannot exceed 100 characters');
    } else {
      data.department_or_project = rawDept.trim();
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], data };
}

module.exports = {
  validateCreateAnalyticAccount,
  validateUpdateAnalyticAccount,
};
