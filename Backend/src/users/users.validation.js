/**
 * Users Validation
 *
 * Input validation for user management endpoints.
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const usersValidation = {
  /**
   * Validate invite payload.
   *
   * Security rules:
   * - Only manager role is allowed to be invited (Admin cannot mint another Admin).
   * - name and email are required.
   *
   * @param {Object} body
   * @returns {{ isValid: boolean, errors: string[], data?: { name: string, email: string, role: string } }}
   */
  validateInvite(body) {
    const errors = [];

    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const { name, email, role } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push('Name is required');
    } else if (name.trim().length < 2 || name.trim().length > 100) {
      errors.push('Name must be between 2 and 100 characters');
    }

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      errors.push('Email is required');
    } else {
      const sanitizedEmail = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(sanitizedEmail) || sanitizedEmail.length > 255) {
        errors.push('Please provide a valid email address');
      }
    }

    // Role restriction: Admin may only invite role='accountant'
    if (role && role !== 'accountant') {
      errors.push('Only manager accounts can be created via invite');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'accountant',
      },
    };
  },

  /**
   * Validate user status update payload.
   *
   * @param {Object} body
   * @returns {{ isValid: boolean, errors: string[], data?: { status: string } }}
   */
  validateStatusUpdate(body) {
    const errors = [];

    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const { status } = body;
    const allowedStatuses = ['active', 'inactive'];

    if (!status || !allowedStatuses.includes(status)) {
      errors.push(`Status is required and must be one of: ${allowedStatuses.join(', ')}`);
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      data: { status },
    };
  },
};

module.exports = usersValidation;
