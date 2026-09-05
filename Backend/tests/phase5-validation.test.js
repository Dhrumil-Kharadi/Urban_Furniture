const accountsValidation = require('../src/accounts/accounts.validation');
const journalsValidation = require('../src/journals/journals.validation');
const taxesValidation = require('../src/taxes/taxes.validation');
const analyticsValidation = require('../src/analytics/analytics.validation');
const { buildTree } = require('../src/accounts/accounts.service');
const { ACCOUNT_TYPES, TAX_SCOPE, JOURNAL_TYPES } = require('../src/shared/constants');

/**
 * Phase 5 — pure unit tests.
 *
 * No database. These cover what can be decided from the input alone: field
 * validation, money and rate normalisation, and the in-memory tree assembly.
 */

describe('Phase 5 (unit): chart of accounts validation', () => {
  test('accepts the five types project.md §4.3 names, including capital', () => {
    expect(Object.values(ACCOUNT_TYPES).sort()).toEqual(
      ['asset', 'capital', 'expense', 'income', 'liability'],
    );

    for (const type of Object.values(ACCOUNT_TYPES)) {
      const result = accountsValidation.validateCreate({
        code: '1234', name: 'Test Account', account_type: type,
      });
      expect(result.isValid).toBe(true);
      expect(result.data.account_type).toBe(type);
    }
  });

  test("rejects 'equity' — the column's CHECK constraint says 'capital'", () => {
    const result = accountsValidation.validateCreate({
      code: '3020', name: 'Retained Earnings', account_type: 'equity',
    });
    expect(result.isValid).toBe(false);
  });

  test('normalises opening balance to a fixed-2dp string, never a number', () => {
    const result = accountsValidation.validateCreate({
      code: '1010', name: 'Cash', account_type: 'asset', opening_balance: '2500.5',
    });
    expect(result.data.opening_balance).toBe('2500.50');
    expect(typeof result.data.opening_balance).toBe('string');
  });

  test('allows a negative opening balance but rejects non-decimal forms', () => {
    expect(
      accountsValidation.validateCreate({
        code: '1010', name: 'Cash', account_type: 'asset', opening_balance: '-500',
      }).data.opening_balance,
    ).toBe('-500.00');

    for (const bad of ['1e5', '0x20', 'abc', '10.00.00']) {
      const result = accountsValidation.validateCreate({
        code: '1010', name: 'Cash', account_type: 'asset', opening_balance: bad,
      });
      expect(result.isValid).toBe(false);
    }
  });

  test('rejects a parent id that is not a UUID', () => {
    const result = accountsValidation.validateCreate({
      code: '1011', name: 'Petty Cash', account_type: 'asset',
      parent_account_id: "1' OR '1'='1",
    });
    expect(result.isValid).toBe(false);
  });

  test('code and name are both required on create', () => {
    expect(accountsValidation.validateCreate({ name: 'X', account_type: 'asset' }).isValid).toBe(false);
    expect(accountsValidation.validateCreate({ code: '1', account_type: 'asset' }).isValid).toBe(false);
  });
});

describe('Phase 5 (unit): account tree assembly', () => {
  const rows = [
    { id: 'a', code: '1000', name: 'Assets', parent_account_id: null },
    { id: 'b', code: '1010', name: 'Cash', parent_account_id: 'a' },
    { id: 'c', code: '1011', name: 'Petty Cash', parent_account_id: 'b' },
    { id: 'd', code: '4000', name: 'Income', parent_account_id: null },
  ];

  test('nests children under their parent', () => {
    const tree = buildTree(rows);
    expect(tree.map((n) => n.id).sort()).toEqual(['a', 'd']);

    const assets = tree.find((n) => n.id === 'a');
    expect(assets.children.map((n) => n.id)).toEqual(['b']);
    expect(assets.children[0].children.map((n) => n.id)).toEqual(['c']);
  });

  test('surfaces an orphan at the root rather than dropping it', () => {
    // 'c' points at a parent that is not in the set — archived and filtered
    // out, say. Losing it silently would understate the Balance Sheet.
    const tree = buildTree([rows[0], rows[2]]);
    expect(tree.map((n) => n.id).sort()).toEqual(['a', 'c']);
  });

  test('an empty set yields an empty tree', () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe('Phase 5 (unit): tax validation', () => {
  test('normalises the rate to the column\'s 4dp scale, as a string', () => {
    const result = taxesValidation.validateCreate({ name: 'GST 18%', rate: '18' });
    expect(result.isValid).toBe(true);
    expect(result.data.rate).toBe('18.0000');
    expect(typeof result.data.rate).toBe('string');
  });

  test('rejects a rate outside 0–100', () => {
    for (const rate of ['-1', '101', '999']) {
      expect(taxesValidation.validateCreate({ name: 'Bad', rate }).isValid).toBe(false);
    }
    expect(taxesValidation.validateCreate({ name: 'Zero', rate: '0' }).isValid).toBe(true);
    expect(taxesValidation.validateCreate({ name: 'Full', rate: '100' }).isValid).toBe(true);
  });

  test('defaults scope to both — Phase 0 Decision 4 taxes purchases as well', () => {
    const result = taxesValidation.validateCreate({ name: 'GST 12%', rate: '12' });
    expect(result.data.tax_scope).toBe(TAX_SCOPE.BOTH);
  });

  test("accepts the singular 'purchase', matching the CHECK constraint", () => {
    expect(TAX_SCOPE.PURCHASE).toBe('purchase');
    const result = taxesValidation.validateCreate({
      name: 'Input GST', rate: '5', tax_scope: 'purchase',
    });
    expect(result.isValid).toBe(true);
  });

  test('rate is required', () => {
    expect(taxesValidation.validateCreate({ name: 'No rate' }).isValid).toBe(false);
  });
});

describe('Phase 5 (unit): journal validation', () => {
  test('accepts the five types project.md §4.4 names', () => {
    expect(Object.values(JOURNAL_TYPES).sort()).toEqual(
      ['bank', 'cash', 'general', 'purchase', 'sales'],
    );

    for (const type of Object.values(JOURNAL_TYPES)) {
      const result = journalsValidation.validateCreate({ name: 'Book', journal_type: type });
      expect(result.isValid).toBe(true);
    }
  });

  test('upper-cases the sequence prefix and bounds its length', () => {
    expect(
      journalsValidation.validateCreate({
        name: 'Sales', journal_type: 'sales', sequence_prefix: 'inv',
      }).data.sequence_prefix,
    ).toBe('INV');

    expect(
      journalsValidation.validateCreate({
        name: 'Sales', journal_type: 'sales', sequence_prefix: 'WAYTOOLONGPREFIX',
      }).isValid,
    ).toBe(false);
  });

  test('rejects a default account that is not a UUID', () => {
    const result = journalsValidation.validateCreate({
      name: 'Sales', journal_type: 'sales', default_debit_account_id: 'not-a-uuid',
    });
    expect(result.isValid).toBe(false);
  });
});

describe('Phase 5 (unit): analytic account validation', () => {
  test('requires a name and an income/expense type', () => {
    expect(
      analyticsValidation.validateCreate({ name: 'Retail Store - Ahmedabad', analytic_type: 'income' }).isValid,
    ).toBe(true);

    expect(analyticsValidation.validateCreate({ name: 'No type' }).isValid).toBe(false);
    expect(
      analyticsValidation.validateCreate({ name: 'Bad type', analytic_type: 'asset' }).isValid,
    ).toBe(false);
  });

  test('carries the optional department field of §4.6', () => {
    const result = analyticsValidation.validateCreate({
      name: 'Online Sales', analytic_type: 'income', department: 'E-commerce',
    });
    expect(result.data.department).toBe('E-commerce');
  });

  test('an empty update is rejected rather than silently doing nothing', () => {
    expect(analyticsValidation.validateUpdate({}).isValid).toBe(false);
  });
});
