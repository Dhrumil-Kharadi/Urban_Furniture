/**
 * Contacts Validation
 *
 * Pure functions. No I/O, no database, no req/res.
 * Every one returns { isValid, errors, data? } so controllers read identically
 * across the codebase.
 */

const { CONTACT_TYPE, CONTACT_STATUS } = require('../shared/constants');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Indian postal codes are six digits and never start with zero.
 * ASSUMPTION — project.md §4.1 lists a "Pincode" field and §7 establishes the
 * India context, but never states the format. Flagged to the product owner.
 */
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/** Mobile numbers are stored as entered; only obvious junk is rejected. */
const MOBILE_REGEX = /^[+]?[0-9][0-9\s-]{5,19}$/;

const CONTACT_TYPES = Object.values(CONTACT_TYPE);
const CONTACT_STATUSES = Object.values(CONTACT_STATUS);

/**
 * Normalise an optional free-text field: trimmed, or null when blank.
 * @private
 */
function optionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Shared field rules for create and update.
 * `partial` skips the presence checks so PATCH can send a single field.
 * @private
 */
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

  // ── contact_type ──
  if (body.contact_type !== undefined || !partial) {
    if (!CONTACT_TYPES.includes(body.contact_type)) {
      errors.push(`Type is required and must be one of: ${CONTACT_TYPES.join(', ')}`);
    } else {
      data.contact_type = body.contact_type;
    }
  }

  // ── email ── optional: a walk-in customer may have none.
  if (body.email !== undefined) {
    const email = optionalText(body.email);
    if (email === null) {
      data.email = null;
    } else {
      const normalized = email.toLowerCase();
      if (!EMAIL_REGEX.test(normalized) || normalized.length > 255) {
        errors.push('Please provide a valid email address');
      } else {
        data.email = normalized;
      }
    }
  }

  // ── mobile ──
  if (body.mobile !== undefined) {
    const mobile = optionalText(body.mobile);
    if (mobile === null) {
      data.mobile = null;
    } else if (!MOBILE_REGEX.test(mobile) || mobile.length > 20) {
      errors.push('Please provide a valid mobile number');
    } else {
      data.mobile = mobile;
    }
  }

  // ── city / state ──
  for (const field of ['city', 'state']) {
    if (body[field] !== undefined) {
      const value = optionalText(body[field]);
      if (value !== null && value.length > 100) {
        errors.push(`${field === 'city' ? 'City' : 'State'} must not exceed 100 characters`);
      } else {
        data[field] = value;
      }
    }
  }

  // ── pincode ──
  if (body.pincode !== undefined) {
    const pincode = optionalText(body.pincode);
    if (pincode === null) {
      data.pincode = null;
    } else if (!PINCODE_REGEX.test(pincode)) {
      errors.push('Pincode must be 6 digits');
    } else {
      data.pincode = pincode;
    }
  }

  // ── portal_access_enabled ──
  // Accepted at create; on update it is ignored, because enabling or revoking
  // a login is a privileged act with side effects (a user row, an invite mail,
  // a token-version bump) and so lives on its own endpoint.
  if (body.portal_access_enabled !== undefined) {
    if (typeof body.portal_access_enabled !== 'boolean') {
      errors.push('Portal access must be true or false');
    } else {
      data.portal_access_enabled = body.portal_access_enabled;
    }
  }

  return data;
}

const contactsValidation = {
  /**
   * Validate a contact creation payload.
   *
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
        contact_type: data.contact_type,
        email: data.email ?? null,
        mobile: data.mobile ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        pincode: data.pincode ?? null,
        // Phase 0 Decision 2 wants a login for every contact reachable by
        // email; §2.2 wants the operator able to opt out. Defaulting the
        // toggle on whenever an email is present satisfies both, and an
        // explicit false still wins.
        portal_access_enabled:
          data.portal_access_enabled !== undefined
            ? data.portal_access_enabled
            : Boolean(data.email),
      },
    };
  },

  /**
   * Validate a contact update payload. At least one known field must be sent.
   *
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateUpdate(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];
    const data = checkFields(body, errors, true);

    // portal_access_enabled is never changed through the generic update path.
    delete data.portal_access_enabled;

    if (errors.length === 0 && Object.keys(data).length === 0) {
      errors.push('No updatable fields were provided');
    }

    if (errors.length > 0) return { isValid: false, errors };

    return { isValid: true, errors: [], data };
  },

  /**
   * Validate the portal-access toggle payload.
   *
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: { enabled: boolean } }}
   */
  validatePortalAccess(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    if (typeof body.enabled !== 'boolean') {
      return { isValid: false, errors: ['enabled is required and must be true or false'] };
    }

    return { isValid: true, errors: [], data: { enabled: body.enabled } };
  },

  /**
   * Validate the list filters that the shared pagination and sort helpers do
   * not already cover.
   *
   * @param {object} query
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateListQuery(query = {}) {
    const errors = [];

    if (query.status !== undefined && query.status !== '' && !CONTACT_STATUSES.includes(query.status)) {
      errors.push(`Status filter must be one of: ${CONTACT_STATUSES.join(', ')}`);
    }

    if (query.type !== undefined && query.type !== '' && !CONTACT_TYPES.includes(query.type)) {
      errors.push(`Type filter must be one of: ${CONTACT_TYPES.join(', ')}`);
    }

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: {
        status: query.status || null,
        type: query.type || null,
      },
    };
  },
};

module.exports = contactsValidation;
