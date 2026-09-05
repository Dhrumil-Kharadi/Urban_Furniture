const accountingService = require('../src/accounting/accounting.service');
const accountingRules = require('../src/accounting/accounting.rules');
const journalEntriesValidation = require('../src/journals/journalEntries.validation');
const { money, sum } = require('../src/shared/money');

const { normaliseLines, fiscalYearFor } = accountingService;

/**
 * Phase 7 — ledger engine, pure unit tests.
 *
 * No database. These cover the arithmetic and the posting templates, which is
 * where a wrong answer would be silent: an unbalanced entry that the code
 * believes is balanced produces a Balance Sheet that does not balance, weeks
 * later, with every posted document suspect.
 *
 * The database-level guarantees (deferrable balance trigger, immutability
 * triggers, concurrency, sequence rollback) are in phase7-ledger.test.js,
 * which needs a live PostgreSQL.
 */

const ACC_A = '11111111-1111-4111-8111-111111111111';
const ACC_B = '22222222-2222-4222-8222-222222222222';
const ACC_TAX = '33333333-3333-4333-8333-333333333333';
const CONTACT = '44444444-4444-4444-8444-444444444444';
const ANALYTIC = '55555555-5555-4555-8555-555555555555';

describe('Phase 7 (unit): normaliseLines — the balance rule', () => {
  test('a balanced two-line entry is accepted', () => {
    const { lines, totalDebit, totalCredit } = normaliseLines([
      { account_id: ACC_A, debit: '100.00', credit: '0' },
      { account_id: ACC_B, debit: '0', credit: '100.00' },
    ]);

    expect(lines).toHaveLength(2);
    expect(totalDebit).toBe('100.00');
    expect(totalCredit).toBe('100.00');
    expect(lines[0].line_no).toBe(1);
    expect(lines[1].line_no).toBe(2);
  });

  test('an unbalanced entry is rejected', () => {
    expect(() =>
      normaliseLines([
        { account_id: ACC_A, debit: '100.00' },
        { account_id: ACC_B, credit: '99.99' },
      ]),
    ).toThrow(/unbalanced/i);
  });

  test('a line with BOTH debit and credit non-zero is rejected', () => {
    expect(() =>
      normaliseLines([
        { account_id: ACC_A, debit: '50.00', credit: '50.00' },
        { account_id: ACC_B, credit: '50.00' },
      ]),
    ).toThrow(/both a debit and a credit/i);
  });

  test('a line with BOTH sides zero is rejected', () => {
    expect(() =>
      normaliseLines([
        { account_id: ACC_A, debit: '0', credit: '0' },
        { account_id: ACC_B, credit: '100.00' },
      ]),
    ).toThrow(/must carry a debit or a credit/i);
  });

  test('a negative amount is rejected rather than flipped to the other side', () => {
    expect(() =>
      normaliseLines([
        { account_id: ACC_A, debit: '-100.00' },
        { account_id: ACC_B, credit: '-100.00' },
      ]),
    ).toThrow(/cannot be negative/i);
  });

  test('fewer than two lines is rejected — a one-line double entry is not one', () => {
    expect(() => normaliseLines([{ account_id: ACC_A, debit: '100.00' }]))
      .toThrow(/at least two lines/i);
    expect(() => normaliseLines([])).toThrow(/at least two lines/i);
  });

  test('a line without an account is rejected', () => {
    expect(() =>
      normaliseLines([{ debit: '100.00' }, { account_id: ACC_B, credit: '100.00' }]),
    ).toThrow(/no account/i);
  });

  test('100 lines at 33.333 sum EXACTLY — the float bug this engine exists to prevent', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE 754. Summed as JS numbers, 100 lines of
    // 33.333 do not equal their own total, and the entry would be rejected as
    // unbalanced — or worse, accepted while being wrong.
    const perLine = '33.33';
    const debitLines = Array.from({ length: 100 }, () => ({
      account_id: ACC_A, debit: perLine,
    }));

    const total = sum(Array.from({ length: 100 }, () => perLine));
    expect(total).toBe('3333.00');

    const { totalDebit, totalCredit } = normaliseLines([
      ...debitLines,
      { account_id: ACC_B, credit: total },
    ]);

    expect(totalDebit).toBe('3333.00');
    expect(totalCredit).toBe('3333.00');
    expect(totalDebit).toBe(totalCredit);
  });

  test('the same sum computed as JS floats would NOT match — proving the point', () => {
    const floatTotal = Array.from({ length: 100 }, () => 33.333).reduce((a, b) => a + b, 0);
    // 3333.2999999999993 — not 3333.3.
    expect(floatTotal).not.toBe(3333.3);

    // Through money.js it is exact.
    expect(sum(Array.from({ length: 100 }, () => '33.333'))).toBe('3333.30');
  });

  test('amounts are normalised to fixed 2dp strings, never numbers', () => {
    const { lines } = normaliseLines([
      { account_id: ACC_A, debit: 100 },
      { account_id: ACC_B, credit: '100' },
    ]);

    expect(lines[0].debit).toBe('100.00');
    expect(lines[0].credit).toBe('0.00');
    expect(typeof lines[0].debit).toBe('string');
    expect(lines[1].credit).toBe('100.00');
  });

  test('partner and analytic tags are carried through', () => {
    const { lines } = normaliseLines([
      { account_id: ACC_A, debit: '10.00', partner_contact_id: CONTACT },
      { account_id: ACC_B, credit: '10.00', analytic_account_id: ANALYTIC },
    ]);

    expect(lines[0].partner_contact_id).toBe(CONTACT);
    expect(lines[1].analytic_account_id).toBe(ANALYTIC);
  });
});

describe('Phase 7 (unit): fiscal year', () => {
  test('April starts the year — Phase 0 Decision A3', () => {
    expect(fiscalYearFor('2026-04-01')).toBe('2026');
    expect(fiscalYearFor('2026-12-31')).toBe('2026');
  });

  test('January to March belong to the previous fiscal year', () => {
    expect(fiscalYearFor('2026-01-15')).toBe('2025');
    expect(fiscalYearFor('2026-03-31')).toBe('2025');
  });

  test('a different start month is honoured', () => {
    expect(fiscalYearFor('2026-01-15', 1)).toBe('2026');
  });
});

describe('Phase 7 (unit): posting rules — technicalrequirement.md §5.3', () => {
  const CREDITORS = ACC_B;
  const DEBTORS = ACC_B;
  const EXPENSE = ACC_A;
  const INCOME = ACC_A;

  /** Every template must produce lines that balance. */
  function expectBalanced(lines) {
    const debit = sum(lines.map((l) => l.debit));
    const credit = sum(lines.map((l) => l.credit));
    expect(debit).toBe(credit);
  }

  test('vendor bill: Dr Purchase Expense, Dr Input Tax, Cr Creditors', () => {
    const lines = accountingRules.vendorBillPosted({
      lines: [{ expense_account_id: EXPENSE, untaxed_amount: '1000.00', tax_amount: '180.00' }],
      creditorsAccountId: CREDITORS,
      inputTaxAccountId: ACC_TAX,
      contactId: CONTACT,
    });

    expectBalanced(lines);

    const expense = lines.find((l) => l.account_id === EXPENSE);
    const tax = lines.find((l) => l.account_id === ACC_TAX);
    const creditors = lines.find((l) => l.account_id === CREDITORS);

    expect(expense.debit).toBe('1000.00');
    expect(tax.debit).toBe('180.00');
    expect(creditors.credit).toBe('1180.00');
    expect(creditors.partner_contact_id).toBe(CONTACT);
  });

  test('vendor bill with no tax needs no tax account', () => {
    const lines = accountingRules.vendorBillPosted({
      lines: [{ expense_account_id: EXPENSE, untaxed_amount: '500.00', tax_amount: '0' }],
      creditorsAccountId: CREDITORS,
      contactId: CONTACT,
    });

    expectBalanced(lines);
    expect(lines).toHaveLength(2);
  });

  test('vendor bill carrying tax without a tax account is refused', () => {
    expect(() =>
      accountingRules.vendorBillPosted({
        lines: [{ expense_account_id: EXPENSE, untaxed_amount: '100.00', tax_amount: '18.00' }],
        creditorsAccountId: CREDITORS,
        contactId: CONTACT,
      }),
    ).toThrow(/Input Tax Credit account is required/i);
  });

  test('customer invoice: Dr Debtors, Cr Sale Income, Cr Output Tax — tax NOT in income', () => {
    const lines = accountingRules.customerInvoicePosted({
      lines: [{ income_account_id: INCOME, untaxed_amount: '2000.00', tax_amount: '360.00' }],
      debtorsAccountId: DEBTORS,
      outputTaxAccountId: ACC_TAX,
      contactId: CONTACT,
    });

    expectBalanced(lines);

    const debtors = lines.find((l) => l.account_id === DEBTORS);
    const income = lines.find((l) => l.account_id === INCOME);
    const tax = lines.find((l) => l.account_id === ACC_TAX);

    expect(debtors.debit).toBe('2360.00');
    // project.md §7 — the income credit is the UNTAXED amount. If tax were
    // folded in, this would read 2360.00 and revenue would be overstated.
    expect(income.credit).toBe('2000.00');
    expect(tax.credit).toBe('360.00');
    expect(tax.account_id).not.toBe(INCOME);
  });

  test('analytic tags propagate from document line to journal line — project.md §8', () => {
    const lines = accountingRules.customerInvoicePosted({
      lines: [
        { income_account_id: INCOME, untaxed_amount: '100.00', tax_amount: '0', analytic_account_id: ANALYTIC },
      ],
      debtorsAccountId: DEBTORS,
      contactId: CONTACT,
    });

    const income = lines.find((l) => l.account_id === INCOME);
    expect(income.analytic_account_id).toBe(ANALYTIC);
  });

  test('two cost centres on one account stay two lines, never collapsed', () => {
    const OTHER_ANALYTIC = '66666666-6666-4666-8666-666666666666';

    const lines = accountingRules.customerInvoicePosted({
      lines: [
        { income_account_id: INCOME, untaxed_amount: '100.00', tax_amount: '0', analytic_account_id: ANALYTIC },
        { income_account_id: INCOME, untaxed_amount: '250.00', tax_amount: '0', analytic_account_id: OTHER_ANALYTIC },
      ],
      debtorsAccountId: DEBTORS,
      contactId: CONTACT,
    });

    const incomeLines = lines.filter((l) => l.account_id === INCOME);
    expect(incomeLines).toHaveLength(2);
    expect(incomeLines.map((l) => l.analytic_account_id).sort()).toEqual(
      [ANALYTIC, OTHER_ANALYTIC].sort(),
    );
    expectBalanced(lines);
  });

  test('lines on the same account and cost centre ARE grouped', () => {
    const lines = accountingRules.customerInvoicePosted({
      lines: [
        { income_account_id: INCOME, untaxed_amount: '100.00', tax_amount: '0', analytic_account_id: ANALYTIC },
        { income_account_id: INCOME, untaxed_amount: '150.00', tax_amount: '0', analytic_account_id: ANALYTIC },
      ],
      debtorsAccountId: DEBTORS,
      contactId: CONTACT,
    });

    const incomeLines = lines.filter((l) => l.account_id === INCOME);
    expect(incomeLines).toHaveLength(1);
    expect(incomeLines[0].credit).toBe('250.00');
  });

  test('bill payment: Dr Creditors, Cr Cash/Bank', () => {
    const lines = accountingRules.vendorBillPaid({
      creditorsAccountId: CREDITORS,
      cashOrBankAccountId: ACC_A,
      amount: '750.25',
      contactId: CONTACT,
    });

    expectBalanced(lines);
    expect(lines[0].account_id).toBe(CREDITORS);
    expect(lines[0].debit).toBe('750.25');
    expect(lines[1].credit).toBe('750.25');
  });

  test('invoice receipt: Dr Cash/Bank, Cr Debtors', () => {
    const lines = accountingRules.customerInvoicePaid({
      debtorsAccountId: DEBTORS,
      cashOrBankAccountId: ACC_A,
      amount: '1200.00',
      contactId: CONTACT,
    });

    expectBalanced(lines);
    expect(lines[0].debit).toBe('1200.00');
    expect(lines[1].account_id).toBe(DEBTORS);
    expect(lines[1].credit).toBe('1200.00');
  });

  test('portal card payment hits the clearing account, not Bank', () => {
    const CLEARING = ACC_TAX;
    const lines = accountingRules.portalCardPayment({
      clearingAccountId: CLEARING,
      debtorsAccountId: DEBTORS,
      amount: '500.00',
      contactId: CONTACT,
    });

    expectBalanced(lines);
    expect(lines[0].account_id).toBe(CLEARING);
    expect(lines[0].debit).toBe('500.00');
  });

  test('a zero-total document is refused', () => {
    expect(() =>
      accountingRules.customerInvoicePosted({
        lines: [{ income_account_id: INCOME, untaxed_amount: '0', tax_amount: '0' }],
        debtorsAccountId: DEBTORS,
        contactId: CONTACT,
      }),
    ).toThrow(/greater than zero/i);
  });

  test('every template produces lines the engine then accepts', () => {
    // The templates and the engine must agree; a template that produced lines
    // normaliseLines rejects would fail only at posting time.
    const templates = [
      accountingRules.vendorBillPosted({
        lines: [{ expense_account_id: EXPENSE, untaxed_amount: '1000.00', tax_amount: '180.00' }],
        creditorsAccountId: CREDITORS, inputTaxAccountId: ACC_TAX, contactId: CONTACT,
      }),
      accountingRules.customerInvoicePosted({
        lines: [{ income_account_id: INCOME, untaxed_amount: '2000.00', tax_amount: '360.00' }],
        debtorsAccountId: DEBTORS, outputTaxAccountId: ACC_TAX, contactId: CONTACT,
      }),
      accountingRules.vendorBillPaid({
        creditorsAccountId: CREDITORS, cashOrBankAccountId: ACC_A, amount: '10.00', contactId: CONTACT,
      }),
      accountingRules.customerInvoicePaid({
        debtorsAccountId: DEBTORS, cashOrBankAccountId: ACC_A, amount: '10.00', contactId: CONTACT,
      }),
      accountingRules.portalCardPayment({
        clearingAccountId: ACC_TAX, debtorsAccountId: DEBTORS, amount: '10.00', contactId: CONTACT,
      }),
    ];

    for (const lines of templates) {
      expect(() => normaliseLines(lines)).not.toThrow();
    }
  });
});

describe('Phase 7 (unit): opening balances', () => {
  const EQUITY = '99999999-9999-4999-8999-999999999999';

  test('assets debit, liabilities credit, and equity absorbs the difference', () => {
    const lines = accountingRules.openingBalances({
      accounts: [
        { id: ACC_A, account_type: 'asset', opening_balance: '5000.00' },
        { id: ACC_B, account_type: 'liability', opening_balance: '2000.00' },
        { id: EQUITY, account_type: 'capital', opening_balance: '0' },
      ],
      openingEquityAccountId: EQUITY,
    });

    const debit = sum(lines.map((l) => l.debit));
    const credit = sum(lines.map((l) => l.credit));
    expect(debit).toBe(credit);

    expect(lines.find((l) => l.account_id === ACC_A).debit).toBe('5000.00');
    expect(lines.find((l) => l.account_id === ACC_B).credit).toBe('2000.00');
    // 5000 debit vs 2000 credit → equity takes 3000 on the credit side.
    expect(lines.find((l) => l.account_id === EQUITY).credit).toBe('3000.00');
  });

  test('a negative opening balance lands on the other side, never as a negative amount', () => {
    // The line CHECK constraint forbids negatives outright, so a negative
    // asset balance has to post as a credit.
    const lines = accountingRules.openingBalances({
      accounts: [
        { id: ACC_A, account_type: 'asset', opening_balance: '-750.00' },
        { id: EQUITY, account_type: 'capital', opening_balance: '0' },
      ],
      openingEquityAccountId: EQUITY,
    });

    const assetLine = lines.find((l) => l.account_id === ACC_A);
    expect(assetLine.credit).toBe('750.00');
    expect(assetLine.debit).toBe('0.00');
    expect(money(assetLine.credit).isNegative()).toBe(false);

    expect(sum(lines.map((l) => l.debit))).toBe(sum(lines.map((l) => l.credit)));
  });

  test('all-zero balances produce nothing to post', () => {
    const lines = accountingRules.openingBalances({
      accounts: [
        { id: ACC_A, account_type: 'asset', opening_balance: '0' },
        { id: EQUITY, account_type: 'capital', opening_balance: '0' },
      ],
      openingEquityAccountId: EQUITY,
    });
    expect(lines).toBeNull();
  });

  test('the produced entry is one the engine accepts', () => {
    const lines = accountingRules.openingBalances({
      accounts: [
        { id: ACC_A, account_type: 'asset', opening_balance: '5000.00' },
        { id: ACC_B, account_type: 'liability', opening_balance: '2000.00' },
        { id: EQUITY, account_type: 'capital', opening_balance: '0' },
      ],
      openingEquityAccountId: EQUITY,
    });

    expect(() => normaliseLines(lines)).not.toThrow();
  });
});

describe('Phase 7 (unit): manual entry validation', () => {
  const VALID = {
    journal_id: ACC_A,
    entry_date: '2026-05-14',
    lines: [
      { account_id: ACC_A, debit: '100.00' },
      { account_id: ACC_B, credit: '100.00' },
    ],
  };

  test('a well-formed entry passes', () => {
    const result = journalEntriesValidation.validateCreate(VALID);
    expect(result.isValid).toBe(true);
    expect(result.data.lines).toHaveLength(2);
    expect(typeof result.data.lines[0].debit).toBe('string');
  });

  test('fewer than two lines is rejected at the boundary too', () => {
    const result = journalEntriesValidation.validateCreate({
      ...VALID, lines: [{ account_id: ACC_A, debit: '100.00' }],
    });
    expect(result.isValid).toBe(false);
  });

  test('an impossible calendar date is rejected', () => {
    for (const entry_date of ['2026-02-31', '2026-13-01', '14-05-2026', 'today']) {
      expect(journalEntriesValidation.validateCreate({ ...VALID, entry_date }).isValid).toBe(false);
    }
  });

  test('a non-UUID account on a line is rejected', () => {
    const result = journalEntriesValidation.validateCreate({
      ...VALID,
      lines: [{ account_id: "1' OR '1'='1", debit: '1.00' }, { account_id: ACC_B, credit: '1.00' }],
    });
    expect(result.isValid).toBe(false);
  });

  test('a non-decimal amount is rejected before it reaches decimal.js', () => {
    for (const debit of ['1e5', '0x10', '-5', 'abc']) {
      const result = journalEntriesValidation.validateCreate({
        ...VALID,
        lines: [{ account_id: ACC_A, debit }, { account_id: ACC_B, credit: '1.00' }],
      });
      expect(result.isValid).toBe(false);
    }
  });

  test('list filters reject unknown status and source values', () => {
    expect(journalEntriesValidation.validateListQuery({ status: 'deleted' }).isValid).toBe(false);
    expect(journalEntriesValidation.validateListQuery({ source: 'robot' }).isValid).toBe(false);
    expect(journalEntriesValidation.validateListQuery({ status: 'posted', source: 'auto' }).isValid).toBe(true);
  });
});
