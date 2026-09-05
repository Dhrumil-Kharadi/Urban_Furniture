'use strict';

/**
 * AppError — typed application error.
 *
 * All intentional error responses thrown by service/route code should use
 * this class (or a subclass) so that the global error handler can distinguish
 * them from unexpected runtime errors and respond with the correct HTTP status.
 *
 * Usage:
 *   throw new AppError('Resource not found', 404, 'NOT_FOUND');
 *   throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', { fields });
 */
class AppError extends Error {
  /**
   * @param {string}  message   - Human-readable message sent to the client.
   * @param {number}  [status=500] - HTTP status code.
   * @param {string}  [code='INTERNAL_ERROR'] - Machine-readable error code.
   * @param {object}  [details={}] - Optional extra payload (field errors, etc.).
   */
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.details = details;
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Serialise the error for a JSON API response body.
   * @returns {{ error: { code: string, message: string, details: object } }}
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

// ─── Convenience subclasses ───────────────────────────────────────────────────

/** 400 Bad Request — malformed input */
class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details = {}) {
    super(message, 400, code, details);
    this.name = 'BadRequestError';
  }
}

/** 401 Unauthorised — missing / invalid credentials */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED', details = {}) {
    super(message, 401, code, details);
    this.name = 'UnauthorizedError';
  }
}

/** 403 Forbidden — authenticated but not permitted */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN', details = {}) {
    super(message, 403, code, details);
    this.name = 'ForbiddenError';
  }
}

/** 404 Not Found */
class NotFoundError extends AppError {
  constructor(message = 'Not found', code = 'NOT_FOUND', details = {}) {
    super(message, 404, code, details);
    this.name = 'NotFoundError';
  }
}

/** 409 Conflict — unique / FK violation surfaced to user */
class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT', details = {}) {
    super(message, 409, code, details);
    this.name = 'ConflictError';
  }
}

/** 422 Unprocessable Entity — field-level validation failure */
class ValidationError extends AppError {
  /**
   * @param {string}  message
   * @param {object}  [fields={}] - Map of fieldName → error string.
   */
  constructor(message = 'Validation failed', fields = {}) {
    super(message, 422, 'VALIDATION_ERROR', { fields });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

module.exports = AppError;
module.exports.AppError = AppError;
module.exports.BadRequestError = BadRequestError;
module.exports.UnauthorizedError = UnauthorizedError;
module.exports.ForbiddenError = ForbiddenError;
module.exports.NotFoundError = NotFoundError;
module.exports.ConflictError = ConflictError;
module.exports.ValidationError = ValidationError;
