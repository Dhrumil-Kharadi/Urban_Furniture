'use strict';

const { JOURNAL_TYPES } = require('../shared/constants');

const VALID_TYPES = Object.values(JOURNAL_TYPES);

/**
 * Validate create journal payload.
 */
function validateCreateJournal(payload = {}) {
  const errors = [];
  const {
    name,
    journal_type,
    default_debit_account_id,
    default_credit_account_id,
    sequence_prefix,
  } = payload;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Journal name must be at least 2 characters');
  } else if (name.trim().length > 100) {
    errors.push('Journal name cannot exceed 100 characters');
  }

  const normalizedType = journal_type ? String(journal_type).toLowerCase().trim() : '';
  if (!normalizedType || !VALID_TYPES.includes(normalizedType)) {
    errors.push(`Journal type must be one of: ${VALID_TYPES.join(', ')}`);
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let validDebitAcc = null;
  if (default_debit_account_id !== undefined && default_debit_account_id !== null && default_debit_account_id !== '') {
    if (!uuidRegex.test(default_debit_account_id)) {
      errors.push('Default debit account ID must be a valid UUID');
    } else {
      validDebitAcc = default_debit_account_id;
    }
  }

  let validCreditAcc = null;
  if (default_credit_account_id !== undefined && default_credit_account_id !== null && default_credit_account_id !== '') {
    if (!uuidRegex.test(default_credit_account_id)) {
      errors.push('Default credit account ID must be a valid UUID');
    } else {
      validCreditAcc = default_credit_account_id;
    }
  }

  let validPrefix = null;
  if (sequence_prefix !== undefined && sequence_prefix !== null && sequence_prefix !== '') {
    if (typeof sequence_prefix !== 'string' || sequence_prefix.trim().length > 10) {
      errors.push('Sequence prefix cannot exceed 10 characters');
    } else {
      validPrefix = sequence_prefix.trim().toUpperCase();
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
      journal_type: normalizedType,
      default_debit_account_id: validDebitAcc,
      default_credit_account_id: validCreditAcc,
      sequence_prefix: validPrefix,
    },
  };
}

/**
 * Validate update journal payload.
 */
function validateUpdateJournal(payload = {}) {
  const errors = [];
  const data = {};
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (payload.name !== undefined) {
    if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length < 2) {
      errors.push('Journal name must be at least 2 characters');
    } else if (payload.name.trim().length > 100) {
      errors.push('Journal name cannot exceed 100 characters');
    } else {
      data.name = payload.name.trim();
    }
  }

  if (payload.journal_type !== undefined) {
    const normalizedType = String(payload.journal_type).toLowerCase().trim();
    if (!VALID_TYPES.includes(normalizedType)) {
      errors.push(`Journal type must be one of: ${VALID_TYPES.join(', ')}`);
    } else {
      data.journal_type = normalizedType;
    }
  }

  if (payload.default_debit_account_id !== undefined) {
    if (payload.default_debit_account_id === null || payload.default_debit_account_id === '') {
      data.default_debit_account_id = null;
    } else if (!uuidRegex.test(payload.default_debit_account_id)) {
      errors.push('Default debit account ID must be a valid UUID');
    } else {
      data.default_debit_account_id = payload.default_debit_account_id;
    }
  }

  if (payload.default_credit_account_id !== undefined) {
    if (payload.default_credit_account_id === null || payload.default_credit_account_id === '') {
      data.default_credit_account_id = null;
    } else if (!uuidRegex.test(payload.default_credit_account_id)) {
      errors.push('Default credit account ID must be a valid UUID');
    } else {
      data.default_credit_account_id = payload.default_credit_account_id;
    }
  }

  if (payload.sequence_prefix !== undefined) {
    if (payload.sequence_prefix === null || payload.sequence_prefix === '') {
      data.sequence_prefix = null;
    } else if (typeof payload.sequence_prefix !== 'string' || payload.sequence_prefix.trim().length > 10) {
      errors.push('Sequence prefix cannot exceed 10 characters');
    } else {
      data.sequence_prefix = payload.sequence_prefix.trim().toUpperCase();
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], data };
}

module.exports = {
  validateCreateJournal,
  validateUpdateJournal,
};
