const {
  computeLineTotals,
  PURCHASE_CONFIG,
  SALES_CONFIG,
} = require('../src/shared/documentLines');
const salesValidation = require('../src/sales/sales.validation');
const paymentsValidation = require('../src/payments/payments.validation');
const paymentsService = require('../src/payments/payments.service');
const accountingRules = require('../src/accounting/accounting.rules');
const { sum, money } = require('../src/shared/money');

const { statusForBalance, JOURNAL_TYPES_FOR_METHOD } = paymentsService;

/**
 * Phases 9 and 10 — pure unit tests.
 *
 * No database. These cover the line arithmetic both sides share, the posting
 * template shapes, and the validation rules — including the ones that exist to
 * stop money going somewhere it cannot be accounted for.
 *
 * The concurrency guarantee (two parallel payments cannot overpay one invoice)
 * needs real row locks and lives in phase9-10-integration.test.js.
 */

const UUID = (n) => `${n}${'0'.repeat(7)}-0000-4000-8000-000000000000`;
const CUSTOMER = UUID(1);
const INVOICE = UUID(2);
const BILL = UUID(3);
const JOURNAL = UUID(4);
const ACCOUNT = UUID(5);

describe('Phase 9/10 (unit): shared line engine', () => {
  test('untaxed, tax and total are computed per line', () => {
    const { computedLines, untaxed_amount, tax_amount, total_amount } = computeLineTotals(
      [{ quantity: '3', unit_price: '100.00', tax_rate: '18' }],
      SALES_CONFIG,
    );

    expect(computedLines[0].untaxed_amount).toBe('300.00');
    expect(computedLines[0].tax_amount).toBe('54.00');
    expect(computedLines[0].total_amount).toBe('354.00');
    expect(untaxed_amount).toBe('300.00');
    expect(tax_amount).toBe('54.00');
    expect(total_amount).toBe('354.00');
  });

  test('line totals sum EXACTLY to the header total across many lines', () => {
    // Rounding once per line after tax — not on the running total — is what
    // makes this hold. Rounding the sum instead drifts a paisa at a time.
    const lines = Array.from({ length: 37 }, () => ({
      quantity: '3', unit_price: '33.33', tax_rate: '18',
    }));

    const { computedLines, total_amount } = computeLineTotals(lines, SALES_CONFIG);
    const lineSum = sum(computedLines.map((l) => l.total_amount));

    expect(lineSum).toBe(total_amount);
  });

  test('the untaxed and tax columns also sum exactly', () => {
    const lines = [
      { quantity: '1', unit_price: '0.01', tax_rate: '18' },
      { quantity: '7', unit_price: '19.99', tax_rate: '12' },
      { quantity: '2.5', unit_price: '4.44', tax_rate: '5' },
    ];

    const { computedLines, untaxed_amount, tax_amount, total_amount } =
      computeLineTotals(lines, SALES_CONFIG);

    expect(sum(computedLines.map((l) => l.untaxed_amount))).toBe(untaxed_amount);
    expect(sum(computedLines.map((l) => l.tax_amount))).toBe(tax_amount);
    expect(sum([untaxed_amount, tax_amount])).toBe(total_amount);
  });

  test('the same numbers produce the same totals on both sides of the ledger', () => {
    // A purchase bill and a sales invoice for identical figures must agree.
    // Two separate implementations is exactly how they stop agreeing.
    const lines = [{ quantity: '4', unit_price: '249.99', tax_rate: '18' }];

    const purchase = computeLineTotals(lines, PURCHASE_CONFIG);
    const sales = computeLineTotals(lines, SALES_CONFIG);

    expect(purchase.total_amount).toBe(sales.total_amount);
    expect(purchase.tax_amount).toBe(sales.tax_amount);
  });

  test('each side keeps its own posting-account field', () => {
    const purchase = computeLineTotals(
      [{ quantity: '1', unit_price: '10', expense_account_id: ACCOUNT }], PURCHASE_CONFIG,
    );
    const sales = computeLineTotals(
      [{ quantity: '1', unit_price: '10', income_account_id: ACCOUNT }], SALES_CONFIG,
    );

    expect(purchase.computedLines[0].expense_account_id).toBe(ACCOUNT);
    expect(sales.computedLines[0].income_account_id).toBe(ACCOUNT);
    expect(sales.computedLines[0].expense_account_id).toBeUndefined();
  });

  test('a zero tax rate produces no tax', () => {
    const { tax_amount, total_amount } = computeLineTotals(
      [{ quantity: '2', unit_price: '50.00', tax_rate: '0' }], SALES_CONFIG,
    );
    expect(tax_amount).toBe('0.00');
    expect(total_amount).toBe('100.00');
  });

  test('every amount is a string, never a number', () => {
    const { computedLines } = computeLineTotals(
      [{ quantity: '1', unit_price: '10.00', tax_rate: '5' }], SALES_CONFIG,
    );
    for (const field of ['quantity', 'unit_price', 'untaxed_amount', 'tax_amount', 'total_amount']) {
      expect(typeof computedLines[0][field]).toBe('string');
    }
  });
});

describe('Phase 9 (unit): the sales posting template — project.md §5.2.4', () => {
  const DEBTORS = UUID(6);
  const INCOME = UUID(7);
  const OUTPUT_TAX = UUID(8);

  test('Dr Debtors total, Cr Income untaxed, Cr Output Tax — tax NOT in income', () => {
    const lines = accountingRules.customerInvoicePosted({
      lines: [{ income_account_id: INCOME, untaxed_amount: '1000.00', tax_amount: '180.00' }],
      debtorsAccountId: DEBTORS,
      outputTaxAccountId: OUTPUT_TAX,
      contactId: CUSTOMER,
    });

    const debtors = lines.find((l) => l.account_id === DEBTORS);
    const income = lines.find((l) => l.account_id === INCOME);
    const tax = lines.find((l) => l.account_id === OUTPUT_TAX);

    expect(debtors.debit).toBe('1180.00');
    // The critical assertion: income is credited the UNTAXED amount. If tax
    // were folded in this would read 1180.00, overstating revenue and
    // understating the tax liability by the same 180.
    expect(income.credit).toBe('1000.00');
    expect(tax.credit).toBe('180.00');
    expect(tax.account_id).not.toBe(INCOME);

    expect(sum(lines.map((l) => l.debit))).toBe(sum(lines.map((l) => l.credit)));
  });

  test('the entry balances for a multi-line, multi-rate invoice', () => {
    const OTHER_INCOME = UUID(9);
    const lines = accountingRules.customerInvoicePosted({
      lines: [
        { income_account_id: INCOME, untaxed_amount: '500.00', tax_amount: '90.00' },
        { income_account_id: OTHER_INCOME, untaxed_amount: '250.00', tax_amount: '12.50' },
      ],
      debtorsAccountId: DEBTORS,
      outputTaxAccountId: OUTPUT_TAX,
      contactId: CUSTOMER,
    });

    expect(sum(lines.map((l) => l.debit))).toBe(sum(lines.map((l) => l.credit)));
    expect(lines.find((l) => l.account_id === DEBTORS).debit).toBe('852.50');
    expect(lines.find((l) => l.account_id === OUTPUT_TAX).credit).toBe('102.50');
  });
});

describe('Phase 10 (unit): payment posting templates — project.md §5.1.5 / §5.2.5', () => {
  const DEBTORS = UUID(6);
  const CREDITORS = UUID(7);
  const BANK = UUID(8);

  test('receipt: Dr Cash/Bank, Cr Debtors', () => {
    const lines = accountingRules.customerInvoicePaid({
      debtorsAccountId: DEBTORS, cashOrBankAccountId: BANK,
      amount: '1180.00', contactId: CUSTOMER,
    });

    expect(lines.find((l) => l.account_id === BANK).debit).toBe('1180.00');
    expect(lines.find((l) => l.account_id === DEBTORS).credit).toBe('1180.00');
    expect(sum(lines.map((l) => l.debit))).toBe(sum(lines.map((l) => l.credit)));
  });

  test('payment: Dr Creditors, Cr Cash/Bank', () => {
    const lines = accountingRules.vendorBillPaid({
      creditorsAccountId: CREDITORS, cashOrBankAccountId: BANK,
      amount: '750.25', contactId: CUSTOMER,
    });

    expect(lines.find((l) => l.account_id === CREDITORS).debit).toBe('750.25');
    expect(lines.find((l) => l.account_id === BANK).credit).toBe('750.25');
    expect(sum(lines.map((l) => l.debit))).toBe(sum(lines.map((l) => l.credit)));
  });
});

describe('Phase 10 (unit): status rolls forward from the balance', () => {
  test('a zero balance is paid, anything else is partially paid', () => {
    expect(statusForBalance('0.00')).toBe('paid');
    expect(statusForBalance('0.01')).toBe('partially_paid');
    expect(statusForBalance('500.00')).toBe('partially_paid');
  });

  test("'overdue' is never returned — it is derived, not written", () => {
    // technicalrequirement.md §7.8. A status function that could return
    // 'overdue' would be a second definition competing with the SQL predicate.
    for (const balance of ['0.00', '0.01', '1000.00']) {
      expect(statusForBalance(balance)).not.toBe('overdue');
    }
  });

  test('two partials totalling the balance land on paid', () => {
    const total = money('1000.00');
    const afterFirst = total.minus(money('400.00'));
    expect(statusForBalance(afterFirst.toFixed(2))).toBe('partially_paid');

    const afterSecond = afterFirst.minus(money('600.00'));
    expect(statusForBalance(afterSecond.toFixed(2))).toBe('paid');
  });
});

describe('Phase 10 (unit): journal type must match the payment method', () => {
  test('cash pays through a cash journal, bank and card through a bank journal', () => {
    expect(JOURNAL_TYPES_FOR_METHOD.cash).toEqual(['cash']);
    expect(JOURNAL_TYPES_FOR_METHOD.bank).toEqual(['bank']);
    // Card money lands in a gateway clearing account, which is bank-side.
    expect(JOURNAL_TYPES_FOR_METHOD.card).toEqual(['bank']);
  });

  test('cash and bank never share a journal type', () => {
    // Posting cash through a bank journal credits the WRONG ASSET ACCOUNT,
    // and nothing downstream notices until someone reconciles the bank.
    const cash = new Set(JOURNAL_TYPES_FOR_METHOD.cash);
    expect(JOURNAL_TYPES_FOR_METHOD.bank.some((t) => cash.has(t))).toBe(false);
  });
});

describe('Phase 10 (unit): payment validation', () => {
  const VALID = {
    contact_id: CUSTOMER,
    direction: 'inbound',
    method: 'bank',
    payment_date: new Date().toISOString().slice(0, 10),
    amount: '1000.00',
    journal_id: JOURNAL,
    cash_account_id: ACCOUNT,
    allocations: [{ customer_invoice_id: INVOICE, allocated_amount: '1000.00' }],
  };

  test('a well-formed payment passes', () => {
    const result = paymentsValidation.validateCreate(VALID);
    expect(result.isValid).toBe(true);
    expect(typeof result.data.amount).toBe('string');
  });

  test('a future payment date is rejected', () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const result = paymentsValidation.validateCreate({ ...VALID, payment_date: future });
    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/future/i);
  });

  test('a zero or negative amount is rejected', () => {
    for (const amount of ['0', '0.00', '-5.00']) {
      expect(paymentsValidation.validateCreate({ ...VALID, amount }).isValid).toBe(false);
    }
  });

  test('more than two decimal places is rejected', () => {
    expect(paymentsValidation.validateCreate({ ...VALID, amount: '10.001' }).isValid).toBe(false);
  });

  test('an allocation naming BOTH an invoice and a bill is rejected', () => {
    const result = paymentsValidation.validateCreate({
      ...VALID,
      allocations: [{ customer_invoice_id: INVOICE, vendor_bill_id: BILL, allocated_amount: '10.00' }],
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/exactly one/i);
  });

  test('an allocation naming NEITHER is rejected — money with no home', () => {
    const result = paymentsValidation.validateCreate({
      ...VALID, allocations: [{ allocated_amount: '10.00' }],
    });
    expect(result.isValid).toBe(false);
  });

  test('the same document allocated twice in one payment is rejected', () => {
    const result = paymentsValidation.validateCreate({
      ...VALID,
      amount: '20.00',
      allocations: [
        { customer_invoice_id: INVOICE, allocated_amount: '10.00' },
        { customer_invoice_id: INVOICE, allocated_amount: '10.00' },
      ],
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/already allocated/i);
  });

  test('an inbound payment cannot settle a vendor bill, and vice versa', () => {
    expect(paymentsValidation.validateCreate({
      ...VALID,
      allocations: [{ vendor_bill_id: BILL, allocated_amount: '1000.00' }],
    }).isValid).toBe(false);

    expect(paymentsValidation.validateCreate({
      ...VALID,
      direction: 'outbound',
      allocations: [{ customer_invoice_id: INVOICE, allocated_amount: '1000.00' }],
    }).isValid).toBe(false);
  });

  test('at least one allocation is required', () => {
    expect(paymentsValidation.validateCreate({ ...VALID, allocations: [] }).isValid).toBe(false);
  });

  test('an unknown method or direction is rejected', () => {
    expect(paymentsValidation.validateCreate({ ...VALID, method: 'crypto' }).isValid).toBe(false);
    expect(paymentsValidation.validateCreate({ ...VALID, direction: 'sideways' }).isValid).toBe(false);
  });
});

describe('Phase 9 (unit): sales validation', () => {
  const VALID_SO = {
    customer_contact_id: CUSTOMER,
    order_date: '2026-05-14',
    lines: [{ product_id: UUID(7), quantity: '2', unit_price: '100.00' }],
  };

  test('a well-formed sales order passes', () => {
    expect(salesValidation.validateCreateSalesOrder(VALID_SO).isValid).toBe(true);
  });

  test('a zero or negative quantity is rejected', () => {
    for (const quantity of ['0', '0.0000']) {
      const result = salesValidation.validateCreateSalesOrder({
        ...VALID_SO, lines: [{ product_id: UUID(7), quantity, unit_price: '10.00' }],
      });
      expect(result.isValid).toBe(false);
    }
  });

  test('a line with neither product nor description is rejected', () => {
    const result = salesValidation.validateCreateSalesOrder({
      ...VALID_SO, lines: [{ quantity: '1', unit_price: '10.00' }],
    });
    expect(result.isValid).toBe(false);
  });

  test('an impossible calendar date is rejected', () => {
    for (const order_date of ['2026-02-31', '2026-13-01', '14-05-2026']) {
      expect(salesValidation.validateCreateSalesOrder({ ...VALID_SO, order_date }).isValid).toBe(false);
    }
  });

  test('a tax rate above 100 is rejected', () => {
    const result = salesValidation.validateCreateSalesOrder({
      ...VALID_SO,
      lines: [{ product_id: UUID(7), quantity: '1', unit_price: '10.00', tax_rate: '101' }],
    });
    expect(result.isValid).toBe(false);
  });

  test('a due date before the invoice date is rejected', () => {
    const result = salesValidation.validateCreateInvoiceFromSO({
      journal_id: JOURNAL, invoice_date: '2026-05-14', due_date: '2026-05-01',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/before the invoice date/i);
  });

  test('an empty sales order update is rejected rather than silently doing nothing', () => {
    expect(salesValidation.validateUpdateSalesOrder({}).isValid).toBe(false);
  });

  test('client-sent totals are dropped, never echoed back as trusted', () => {
    const result = salesValidation.validateCreateSalesOrder({
      ...VALID_SO, total_amount: '1.00', untaxed_amount: '1.00', tax_amount: '0.00',
    });
    expect(result.isValid).toBe(true);
    expect(result.data.total_amount).toBeUndefined();
    expect(result.data.untaxed_amount).toBeUndefined();
    expect(result.data.tax_amount).toBeUndefined();
  });
});
