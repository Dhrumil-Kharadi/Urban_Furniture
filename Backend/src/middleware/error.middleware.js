const logger = require('../utils/logger');
const { AppError } = require('../shared/AppError');

/**
 * Centralized error handling middleware.
 *
 * SECURITY: Never leaks internal implementation details to clients.
 *
 * Handles three categories:
 *   1️⃣ AppError (and subclasses) – intentional errors with proper status, code, message.
 *   2️⃣ Generic errors with an explicit `statusCode` property – e.g., duplicate registration.
 *   3️⃣ Unexpected runtime errors – always 500 with a generic message.
 */

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  // Log the error for auditing/debugging.
  logger.error('Unhandled error', {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  // 1️⃣ AppError (or subclass)
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(Object.keys(err.details || {}).length > 0 ? { details: err.details } : {}),
      },
    });
  }

  // 2️⃣ Generic error with explicit statusCode
  if (typeof err.statusCode === 'number') {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code || 'ERROR',
        message: err.message || 'An error occurred',
      },
    });
  }

  // 3️⃣ Unexpected runtime error
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred.',
    },
  });
}

module.exports = errorMiddleware;
