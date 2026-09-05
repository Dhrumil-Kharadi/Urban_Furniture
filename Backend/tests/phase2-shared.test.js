'use strict';

/**
 * Phase 2 — Shared Infrastructure Test Suite
 *
 * Covers:
 *  - money.js           arithmetic, rounding, type safety
 *  - pagination.js      parse/clamp, buildMeta, buildOrderBy
 *  - validate.js        required, optional, type rules, oneOf, email, uuid
 *  - AppError.js        subclass hierarchy, toJSON, status codes
 *  - dbErrors.js        mapDbError for codes 23505 / 23503 / 23514 / 23502
 *  - constants.js       shape / freeze sanity
 *  - withTransaction.js commit on success, rollback on error (uses real DB)
 *  - sequence.service.js generates sequential numbers under concurrent load
 */

const { money, toDb, add, sub, mul, div, round2, eq, gt, lt, isZero, sum } = require('../src/shared/money');
const { parse, buildMeta, buildOrderBy } = require('../src/shared/pagination');
const { validate } = require('../src/shared/validate');
const {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} = require('../src/shared/AppError');
const { mapDbError, CONSTRAINT_MESSAGES } = require('../src/shared/dbErrors');
const constants = require('../src/shared/constants');
const { withTransaction } = require('../src/shared/withTransaction');
const sequenceService = require('../src/shared/sequence.service');
const { nextDocumentNumber } = sequenceService;
const { pool, closePool } = require('../src/config/db');

// ─── money.js ─────────────────────────────────────────────────────────────────

describe('money.js', () => {
  describe('money()', () => {
    it('wraps an integer', () => expect(money(5).toFixed(2)).toBe('5.00'));
    it('wraps a string returned by pg', () => expect(money('12.34').toFixed(2)).toBe('12.34'));
    it('wraps a float', () => expect(money(1.005).toFixed(2)).toBe('1.01')); // ROUND_HALF_UP
  });

  describe('toDb()', () => {
    it('returns a 2dp string', () => expect(toDb(money('9.999'))).toBe('10.00'));
    it('handles zero', () => expect(toDb(money(0))).toBe('0.00'));
  });

  describe('arithmetic', () => {
    it('add', () => expect(toDb(add(money('1.10'), money('2.20')))).toBe('3.30'));
    it('sub', () => expect(toDb(sub(money('5.00'), money('1.50')))).toBe('3.50'));
    it('mul — rounds HALF_UP', () => expect(toDb(mul(money('10.00'), money('0.18')))).toBe('1.80'));
    it('div', () => expect(toDb(div(money('7.00'), money('2')))).toBe('3.50'));
  });

  describe('comparisons', () => {
    it('eq', () => expect(eq(money('1.00'), money('1.00'))).toBe(true));
    it('gt', () => expect(gt(money('2'), money('1'))).toBe(true));
    it('lt', () => expect(lt(money('1'), money('2'))).toBe(true));
    it('isZero', () => expect(isZero(money(0))).toBe(true));
    it('isZero false', () => expect(isZero(money('0.01'))).toBe(false));
  });

  describe('sum()', () => {
    it('sums an array', () =>
      expect(toDb(sum([money('1.00'), money('2.00'), money('3.00')]))).toBe('6.00'));
    it('sums empty array to zero', () => expect(toDb(sum([]))).toBe('0.00'));
  });

  describe('round2()', () => {
    it('rounds half-up', () => expect(toDb(round2(money('2.345')))).toBe('2.35'));
    it('rounds down', () => expect(toDb(round2(money('2.344')))).toBe('2.34'));
  });
});

// ─── pagination.js ────────────────────────────────────────────────────────────

describe('pagination.js — parse()', () => {
  it('defaults when empty', () => {
    const r = parse({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
    expect(r.offset).toBe(0);
  });

  it('computes offset', () => {
    const r = parse({ page: '3', limit: '10' });
    expect(r.offset).toBe(20);
  });

  it('clamps limit to MAX_LIMIT (100)', () => {
    expect(parse({ limit: '999' }).limit).toBe(100);
  });

  it('clamps page to 1 when < 1', () => {
    expect(parse({ page: '0' }).page).toBe(1);
  });

  it('falls back to defaults for NaN', () => {
    const r = parse({ page: 'abc', limit: 'xyz' });
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });
});

describe('pagination.js — buildMeta()', () => {
  it('correct totalPages and flags', () => {
    const m = buildMeta(2, 10, 35);
    expect(m.totalPages).toBe(4);
    expect(m.hasNext).toBe(true);
    expect(m.hasPrev).toBe(true);
  });

  it('last page has no next', () => {
    const m = buildMeta(4, 10, 35);
    expect(m.hasNext).toBe(false);
  });

  it('first page has no prev', () => {
    const m = buildMeta(1, 10, 35);
    expect(m.hasPrev).toBe(false);
  });

  it('zero total', () => {
    const m = buildMeta(1, 20, 0);
    expect(m.total).toBe(0);
    expect(m.totalPages).toBe(0);
  });
});

describe('pagination.js — buildOrderBy()', () => {
  const allow = ['name', 'created_at', 'amount'];

  it('returns default when no param', () => {
    expect(buildOrderBy(undefined, allow, 'created_at')).toBe('"created_at" ASC');
  });

  it('ascending sort', () => {
    expect(buildOrderBy('name', allow, 'created_at')).toBe('"name" ASC');
  });

  it('descending sort with leading dash', () => {
    expect(buildOrderBy('-amount', allow, 'created_at')).toBe('"amount" DESC');
  });

  it('falls back to default for unknown column', () => {
    expect(buildOrderBy('password', allow, 'created_at')).toBe('"created_at" ASC');
  });
});

// ─── validate.js ──────────────────────────────────────────────────────────────

describe('validate.js', () => {
  describe('required()', () => {
    it('throws when field is missing', () => {
      expect(() =>
        validate({}).field('name', v => v.required()).run()
      ).toThrow(ValidationError);
    });

    it('throws when field is empty string', () => {
      expect(() =>
        validate({ name: '' }).field('name', v => v.required()).run()
      ).toThrow(ValidationError);
    });

    it('passes when field is present', () => {
      expect(() =>
        validate({ name: 'Acme' }).field('name', v => v.required()).run()
      ).not.toThrow();
    });
  });

  describe('optional()', () => {
    it('skips all rules when absent', () => {
      expect(() =>
        validate({}).field('phone', v => v.optional().string().maxLength(5)).run()
      ).not.toThrow();
    });

    it('applies rules when present', () => {
      expect(() =>
        validate({ phone: 'toolongvalue' })
          .field('phone', v => v.optional().string().maxLength(5))
          .run()
      ).toThrow(ValidationError);
    });
  });

  describe('email()', () => {
    it('accepts valid email', () => {
      expect(() =>
        validate({ email: 'user@example.com' }).field('email', v => v.required().email()).run()
      ).not.toThrow();
    });

    it('rejects bad email', () => {
      expect(() =>
        validate({ email: 'not-an-email' }).field('email', v => v.required().email()).run()
      ).toThrow(ValidationError);
    });
  });

  describe('oneOf()', () => {
    it('accepts valid option', () => {
      expect(() =>
        validate({ role: 'business_owner' }).field('role', v => v.required().oneOf(['business_owner', 'accountant'])).run()
      ).not.toThrow();
    });

    it('rejects invalid option', () => {
      expect(() =>
        validate({ role: 'superuser' }).field('role', v => v.required().oneOf(['business_owner', 'accountant'])).run()
      ).toThrow(ValidationError);
    });
  });

  describe('uuid()', () => {
    it('accepts valid UUID v4', () => {
      expect(() =>
        validate({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
          .field('id', v => v.required().uuid())
          .run()
      ).not.toThrow();
    });

    it('rejects non-UUID', () => {
      expect(() =>
        validate({ id: '1234' }).field('id', v => v.required().uuid()).run()
      ).toThrow(ValidationError);
    });
  });

  describe('multiple fields — accumulates errors', () => {
    it('error.details.fields contains all failing fields', () => {
      let err;
      try {
        validate({})
          .field('name', v => v.required())
          .field('email', v => v.required().email())
          .run();
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details.fields).toHaveProperty('name');
      expect(err.details.fields).toHaveProperty('email');
    });
  });
});

// ─── AppError.js ──────────────────────────────────────────────────────────────

describe('AppError.js', () => {
  it('base AppError has correct status and code', () => {
    const e = new AppError('Oops', 500, 'INTERNAL_ERROR');
    expect(e.status).toBe(500);
    expect(e.code).toBe('INTERNAL_ERROR');
    expect(e instanceof Error).toBe(true);
  });

  it('toJSON returns structured payload', () => {
    const e = new AppError('Oops', 400, 'BAD', { field: 'x' });
    const j = e.toJSON();
    expect(j.error.code).toBe('BAD');
    expect(j.error.details.field).toBe('x');
  });

  it('BadRequestError — 400', () => expect(new BadRequestError().status).toBe(400));
  it('UnauthorizedError — 401', () => expect(new UnauthorizedError().status).toBe(401));
  it('ForbiddenError — 403', () => expect(new ForbiddenError().status).toBe(403));
  it('NotFoundError — 404', () => expect(new NotFoundError().status).toBe(404));
  it('ConflictError — 409', () => expect(new ConflictError().status).toBe(409));
  it('ValidationError — 422 with fields', () => {
    const e = new ValidationError('failed', { email: 'invalid' });
    expect(e.status).toBe(422);
    expect(e.fields.email).toBe('invalid');
  });

  it('instanceof AppError works for all subclasses', () => {
    expect(new NotFoundError() instanceof AppError).toBe(true);
    expect(new ValidationError() instanceof AppError).toBe(true);
  });
});

// ─── dbErrors.js ─────────────────────────────────────────────────────────────

describe('dbErrors.js — mapDbError()', () => {
  function pgErr(code, constraint, extra = {}) {
    const e = new Error('pg error');
    e.code = code;
    e.constraint = constraint;
    return Object.assign(e, extra);
  }

  it('23505 → ConflictError with known message', () => {
    const err = mapDbError(pgErr('23505', 'users_email_key'));
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.status).toBe(409);
    expect(err.message).toContain('e-mail');
  });

  it('23505 → ConflictError with generic message for unknown constraint', () => {
    const err = mapDbError(pgErr('23505', 'unknown_constraint'));
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.message).toContain('already exists');
  });

  it('23503 → BadRequestError', () => {
    const err = mapDbError(pgErr('23503', 'some_fk'));
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.status).toBe(400);
  });

  it('23514 → BadRequestError', () => {
    const err = mapDbError(pgErr('23514', 'status_check'));
    expect(err).toBeInstanceOf(BadRequestError);
  });

  it('23502 → BadRequestError', () => {
    const err = mapDbError(pgErr('23502', undefined, { column: 'name' }));
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.message).toContain('name');
  });

  it('unknown code → generic AppError 500', () => {
    const err = mapDbError(pgErr('99999', undefined));
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(500);
  });
});

// ─── constants.js ─────────────────────────────────────────────────────────────

describe('constants.js', () => {
  it('ROLES contains business_owner, accountant, customer, vendor', () => {
    expect(Object.values(constants.ROLES)).toEqual(
      expect.arrayContaining(['business_owner', 'accountant', 'customer', 'vendor'])
    );
  });

  it('ROLES is frozen', () => {
    expect(Object.isFrozen(constants.ROLES)).toBe(true);
  });

  it('DOC_TYPES contains SI and PI', () => {
    expect(constants.DOC_TYPES.SALES_INVOICE).toBe('SI');
    expect(constants.DOC_TYPES.PURCHASE_INVOICE).toBe('PI');
  });

  it('CURRENCIES is INR only', () => {
    expect(constants.CURRENCIES).toContain('INR');
    expect(constants.CURRENCIES.length).toBe(1);
  });

  it('PAGINATION.MAX_LIMIT is 100', () => {
    expect(constants.PAGINATION.MAX_LIMIT).toBe(100);
  });
});

// ─── withTransaction.js ───────────────────────────────────────────────────────

describe('withTransaction.js', () => {
  it('commits on success and the value is returned', async () => {
    const result = await withTransaction(async (client) => {
      const r = await client.query('SELECT 1 + 1 AS two');
      return r.rows[0].two;
    });
    expect(result).toBe(2);
  });

  it('rolls back and rethrows on error', async () => {
    await expect(
      withTransaction(async () => {
        throw new Error('deliberate failure');
      })
    ).rejects.toThrow('deliberate failure');
  });
});

// ─── sequence.service.js ──────────────────────────────────────────────────────

describe('sequence.service.js', () => {
  const TEST_ORG_ID = '00000000-0000-4000-8000-000000000099';
  const DOC_TYPE = 'SI';
  const FISCAL_YEAR = 2025;

  beforeAll(async () => {
    // Insert a minimal test organisation so the FK on document_sequences is satisfied
    await pool.query(
      `INSERT INTO organizations (id, name, slug, currency_code, fiscal_year_start_month, status)
       VALUES ($1, 'Phase2 Test Org', 'phase2-test-org', 'INR', 4, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TEST_ORG_ID]
    );
  });

  afterAll(async () => {
    // Tidy up in FK-safe order: sequences first, then org
    await pool.query(
      `DELETE FROM document_sequences
       WHERE organization_id = $1 AND doc_type = $2 AND fiscal_year = $3`,
      [TEST_ORG_ID, DOC_TYPE, FISCAL_YEAR]
    );
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [TEST_ORG_ID]);
    await closePool();
  });

  it('generates sequential numbers and each is strictly greater than the previous', async () => {
    const n1 = await withTransaction(c =>
      nextDocumentNumber(c, TEST_ORG_ID, DOC_TYPE, FISCAL_YEAR)
    );
    const n2 = await withTransaction(c =>
      nextDocumentNumber(c, TEST_ORG_ID, DOC_TYPE, FISCAL_YEAR)
    );
    // Both are formatted strings e.g. "SI/2025/00001"
    expect(typeof n1).toBe('string');
    expect(typeof n2).toBe('string');
    // Extract the trailing counter and confirm it incremented
    const num1 = parseInt(n1.split('/').pop(), 10);
    const num2 = parseInt(n2.split('/').pop(), 10);
    expect(num2).toBe(num1 + 1);
  });

  it('returns a formatted string with prefix and fiscal year', async () => {
    const n = await withTransaction(c =>
      nextDocumentNumber(c, TEST_ORG_ID, DOC_TYPE, FISCAL_YEAR)
    );
    expect(typeof n).toBe('string');
    expect(n).toMatch(new RegExp(`^${DOC_TYPE}/${FISCAL_YEAR}/\\d+$`));
  });

  it('concurrent calls produce unique numbers', async () => {
    const calls = Array.from({ length: 5 }, () =>
      withTransaction(c => nextDocumentNumber(c, TEST_ORG_ID, DOC_TYPE, FISCAL_YEAR))
    );
    const results = await Promise.all(calls);
    const unique = new Set(results);
    expect(unique.size).toBe(5);
  });
});
