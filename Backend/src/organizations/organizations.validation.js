/**
 * Validation for Organizations module.
 *
 * Follows the pure-function contract:
 * returns { isValid: boolean, errors: string[], data?: any }
 *
 * SECURITY: Strips organization_id if supplied in body so callers cannot override tenant context.
 */

/**
 * Validate organization update payload.
 *
 * @param {object} payload
 * @returns {{ isValid: boolean, errors: string[], data?: object }}
 */
function validateUpdateOrganization(payload = {}) {
  const errors = [];
  const data = {};

  // Strip organization_id / id if present
  const { organization_id, id, ...safePayload } = payload;

  if (safePayload.name !== undefined) {
    if (typeof safePayload.name !== 'string' || safePayload.name.trim().length === 0) {
      errors.push('Organization name cannot be empty');
    } else if (safePayload.name.trim().length > 150) {
      errors.push('Organization name cannot exceed 150 characters');
    } else {
      data.name = safePayload.name.trim();
    }
  }

  const currency = safePayload.currency || safePayload.currency_code;
  if (currency !== undefined) {
    if (typeof currency !== 'string' || currency.trim().length !== 3) {
      errors.push('Currency code must be a 3-character ISO code (e.g. INR)');
    } else {
      data.currency_code = currency.trim().toUpperCase();
    }
  }

  const fyMonth = safePayload.fiscalYearStartMonth !== undefined
    ? safePayload.fiscalYearStartMonth
    : safePayload.fiscal_year_start_month;

  if (fyMonth !== undefined) {
    const monthNum = Number(fyMonth);
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      errors.push('Fiscal year start month must be an integer between 1 and 12');
    } else {
      data.fiscal_year_start_month = monthNum;
    }
  }

  if (Object.keys(data).length === 0 && errors.length === 0) {
    errors.push('At least one field (name, currency, fiscalYearStartMonth) must be provided for update');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined,
  };
}

/**
 * Validate organization creation payload (used during bootstrap/signup).
 *
 * @param {object} payload
 * @returns {{ isValid: boolean, errors: string[], data?: object }}
 */
function validateCreateOrganization(payload = {}) {
  const errors = [];
  const data = {};

  // Strip organization_id / id
  const { organization_id, id, ...safePayload } = payload;

  if (!safePayload.name || typeof safePayload.name !== 'string' || safePayload.name.trim().length === 0) {
    errors.push('Organization name is required');
  } else if (safePayload.name.trim().length > 150) {
    errors.push('Organization name cannot exceed 150 characters');
  } else {
    data.name = safePayload.name.trim();
  }

  const currency = safePayload.currency || safePayload.currency_code || 'INR';
  if (typeof currency !== 'string' || currency.trim().length !== 3) {
    errors.push('Currency code must be a 3-character ISO code (e.g. INR)');
  } else {
    data.currency_code = currency.trim().toUpperCase();
  }

  const fyMonth = safePayload.fiscalYearStartMonth !== undefined
    ? safePayload.fiscalYearStartMonth
    : (safePayload.fiscal_year_start_month !== undefined ? safePayload.fiscal_year_start_month : 4);

  const monthNum = Number(fyMonth);
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    errors.push('Fiscal year start month must be an integer between 1 and 12');
  } else {
    data.fiscal_year_start_month = monthNum;
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined,
  };
}

module.exports = {
  validateUpdateOrganization,
  validateCreateOrganization,
};
