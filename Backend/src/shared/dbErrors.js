'use strict';

/**
 * dbErrors.js — translate PostgreSQL driver errors into AppErrors.
 *
 * Import this wherever a database call might throw a constraint violation
 * that should be surfaced to the client as a structured 4xx response.
 *
 * PostgreSQL error codes used here:
 *   23505 — unique_violation
 *   23503 — foreign_key_violation
 *   23514 — check_violation
 *   23502 — not_null_violation
 *
 * Usage:
 *   try {
 *     await pool.query(sql, params);
 *   } catch (err) {
 *     throw mapDbError(err);
 *   }
 */

const { ConflictError, BadRequestError, AppError } = require('./AppError');

// ─── Human-readable constraint name → message map ────────────────────────────
// Add entries here as new constraints are created in migrations.
const CONSTRAINT_MESSAGES = {
  // organizations
  organizations_slug_key: 'An organisation with that slug already exists.',
  organizations_name_key: 'An organisation with that name already exists.',

  // users
  users_email_key: 'A user with that e-mail already exists.',
  users_username_key: 'A user with that username already exists.',

  // contacts (Phase 6)
  contacts_email_key: 'A contact with that e-mail already exists.',
  contacts_phone_key: 'A contact with that phone number already exists.',

  // accounts (Phase 3)
  accounts_code_org_key: 'An account with that code already exists in this organisation.',

  // taxes (Phase 5)
  taxes_name_org_key: 'A tax with that name already exists in this organisation.',

  // document_sequences (Phase 2)
  document_sequences_pkey: 'Duplicate document sequence entry.',
};

/**
 * Map a raw pg error to an AppError subclass.
 *
 * @param {Error} err - Error thrown by the pg driver.
 * @returns {AppError}
 */
function mapDbError(err) {
  const code = err.code; // pg sets `.code` to the 5-char SQLSTATE

  if (code === '23505') {
    // unique_violation
    const constraint = err.constraint || '';
    const message =
      CONSTRAINT_MESSAGES[constraint] ||
      'A record with those values already exists.';
    return new ConflictError(message, 'UNIQUE_VIOLATION', { constraint });
  }

  if (code === '23503') {
    // foreign_key_violation
    const constraint = err.constraint || '';
    const table = err.table || '';
    return new BadRequestError(
      `Referenced record does not exist (${constraint || table}).`,
      'FOREIGN_KEY_VIOLATION',
      { constraint, table }
    );
  }

  if (code === '23514') {
    // check_violation
    const constraint = err.constraint || '';
    return new BadRequestError(
      `Value violates a database constraint (${constraint}).`,
      'CHECK_VIOLATION',
      { constraint }
    );
  }

  if (code === '23502') {
    // not_null_violation
    const column = err.column || '';
    return new BadRequestError(
      `Required field is missing (${column}).`,
      'NOT_NULL_VIOLATION',
      { column }
    );
  }

  // Unknown / unexpected DB error — rethrow as generic 500
  return new AppError(
    'An unexpected database error occurred.',
    500,
    'DB_ERROR',
    { pgCode: code, detail: err.detail }
  );
}

/**
 * Convenience wrapper — use inside a catch block.
 * Re-throws AppErrors unchanged (they were already handled upstream).
 *
 * @param {Error} err
 * @returns {never}
 */
function rethrowDbError(err) {
  const { AppError: AE } = require('./AppError');
  if (err instanceof AE) throw err;
  throw mapDbError(err);
}

module.exports = { mapDbError, rethrowDbError, CONSTRAINT_MESSAGES };
