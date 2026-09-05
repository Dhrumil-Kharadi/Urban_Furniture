'use strict';

/**
 * validate.js — lightweight, chainable field validation library.
 *
 * Design goals:
 *  - No external runtime deps (pure JS).
 *  - Synchronous — all checks happen in memory.
 *  - Throws a ValidationError (AppError 422) with a field-keyed `fields` map
 *    so the client always knows WHICH field failed and WHY.
 *  - Single entry point: validate(data).field(rules...).run()
 *
 * Usage:
 *   const { validate } = require('../shared/validate');
 *
 *   validate(req.body)
 *     .field('name',     v => v.required().string().maxLength(150))
 *     .field('email',    v => v.required().email())
 *     .field('role',     v => v.required().oneOf(['admin','manager','user']))
 *     .field('phone',    v => v.optional().string().maxLength(20))
 *     .run();   // ← throws ValidationError if anything failed
 */

const { ValidationError } = require('./AppError');

// ─── FieldValidator ───────────────────────────────────────────────────────────

class FieldValidator {
  /**
   * @param {string} name  - Field name (used in error map key).
   * @param {*}      value - Raw value from the request body.
   */
  constructor(name, value) {
    this._name = name;
    this._value = value;
    this._error = null;   // first failing rule wins
    this._optional = false;
    this._skip = false;   // set when field is optional AND absent
  }

  // ── Presence ──────────────────────────────────────────────────────────────

  /** Mark the field as optional — all subsequent rules are skipped when absent. */
  optional() {
    this._optional = true;
    const absent = this._value === undefined || this._value === null || this._value === '';
    if (absent) this._skip = true;
    return this;
  }

  /** Field must be present and non-empty. */
  required(message) {
    if (this._skip) return this;
    const absent = this._value === undefined || this._value === null || this._value === '';
    if (absent) this._fail(message || `${this._name} is required.`);
    return this;
  }

  // ── Type checks ───────────────────────────────────────────────────────────

  /** Value must be (or coerce to) a non-empty string. */
  string(message) {
    if (this._skip || this._error) return this;
    if (typeof this._value !== 'string') {
      this._fail(message || `${this._name} must be a string.`);
    }
    return this;
  }

  /** Value must be (or coerce to) a finite number. */
  number(message) {
    if (this._skip || this._error) return this;
    const n = Number(this._value);
    if (!Number.isFinite(n)) {
      this._fail(message || `${this._name} must be a number.`);
    }
    return this;
  }

  /** Value must be a boolean or the strings 'true'/'false'. */
  boolean(message) {
    if (this._skip || this._error) return this;
    if (this._value !== true && this._value !== false &&
        this._value !== 'true' && this._value !== 'false') {
      this._fail(message || `${this._name} must be a boolean.`);
    }
    return this;
  }

  // ── String rules (apply after .string()) ──────────────────────────────────

  /** Enforce maximum string length. */
  maxLength(max, message) {
    if (this._skip || this._error) return this;
    if (typeof this._value === 'string' && this._value.length > max) {
      this._fail(message || `${this._name} must not exceed ${max} characters.`);
    }
    return this;
  }

  /** Enforce minimum string length. */
  minLength(min, message) {
    if (this._skip || this._error) return this;
    if (typeof this._value === 'string' && this._value.trim().length < min) {
      this._fail(message || `${this._name} must be at least ${min} characters.`);
    }
    return this;
  }

  /** Basic RFC-5322–ish e-mail check. */
  email(message) {
    if (this._skip || this._error) return this;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof this._value !== 'string' || !re.test(this._value.trim())) {
      this._fail(message || `${this._name} must be a valid e-mail address.`);
    }
    return this;
  }

  /** Value must match the given regex. */
  matches(regex, message) {
    if (this._skip || this._error) return this;
    if (!regex.test(String(this._value))) {
      this._fail(message || `${this._name} has an invalid format.`);
    }
    return this;
  }

  // ── Enum / range ──────────────────────────────────────────────────────────

  /** Value must be one of the provided options. */
  oneOf(options, message) {
    if (this._skip || this._error) return this;
    if (!options.includes(this._value)) {
      this._fail(
        message ||
        `${this._name} must be one of: ${options.join(', ')}.`
      );
    }
    return this;
  }

  /** Numeric value must be ≥ min. */
  min(min, message) {
    if (this._skip || this._error) return this;
    if (Number(this._value) < min) {
      this._fail(message || `${this._name} must be at least ${min}.`);
    }
    return this;
  }

  /** Numeric value must be ≤ max. */
  max(max, message) {
    if (this._skip || this._error) return this;
    if (Number(this._value) > max) {
      this._fail(message || `${this._name} must be at most ${max}.`);
    }
    return this;
  }

  // ── UUID ──────────────────────────────────────────────────────────────────

  /** Value must be a valid UUID v4. */
  uuid(message) {
    if (this._skip || this._error) return this;
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!re.test(String(this._value))) {
      this._fail(message || `${this._name} must be a valid UUID.`);
    }
    return this;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _fail(msg) {
    if (!this._error) this._error = msg;
  }

  /** Returns the error string or null. */
  _getError() {
    return this._error;
  }
}

// ─── Validator (fluent builder) ───────────────────────────────────────────────

class Validator {
  constructor(data) {
    this._data = data || {};
    this._fields = []; // [{ name, fn }]
  }

  /**
   * Register a field for validation.
   *
   * @param {string}   name - Key in the data object.
   * @param {Function} fn   - Receives a FieldValidator, must return it.
   * @returns {Validator}
   */
  field(name, fn) {
    this._fields.push({ name, fn });
    return this;
  }

  /**
   * Execute all registered rules.
   * Throws a ValidationError if any field fails.
   * Returns the Validator instance (allows chaining after run() if needed).
   *
   * @throws {ValidationError}
   */
  run() {
    const errors = {};

    for (const { name, fn } of this._fields) {
      const fv = new FieldValidator(name, this._data[name]);
      fn(fv);
      const err = fv._getError();
      if (err) errors[name] = err;
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Validation failed.', errors);
    }

    return this;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Entry point.
 * @param {object} data - Typically req.body
 * @returns {Validator}
 */
function validate(data) {
  return new Validator(data);
}

module.exports = { validate, Validator, FieldValidator };
