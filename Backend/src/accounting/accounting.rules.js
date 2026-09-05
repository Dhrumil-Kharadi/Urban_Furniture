const { money, toDb, sum, isZero } = require('../shared/money');

/**
 * Accounting Rules — the posting templates of technicalrequirement.md §5.3.
 *
 * Each function turns a document into the LINES of its journal entry. None of
 * them touches the database, and none of them posts: they hand the lines to
 * accounting.service.postJournalEntry, which is the only thing that writes.
 *
 * Keeping the templates here rather than inside purchases/ and sales/ is what
 * stops the two from drifting apart. A change to how tax posts is one edit in
 * one file, and both sides of the ledger move together.
 *
 * ANALYTIC TAGGING — project.md §8: a document line's analytic_account_id is
 * carried onto the journal line it produces. Without that the Budget Report
 * has no actuals at all and §8 is unimplementable, so every template below
 * propagates it.
 *
 * MONEY: every amount arrives and leaves as a fixed-2dp STRING. No template
 * does JS number arithmetic.
 */

/** @private */
function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * Group document lines by an account id, summing an amount field.
 *
 * Posting one Purchase Expense line per document line would make a five-line
 * bill produce a ten-line journal entry; grouping keeps the ledger readable
 * while preserving the analytic dimension, which is grouped alongside so two
 * cost centres never collapse into one line.
 *
 * @param {Array} lines
 * @param {string} accountField
 * @param {string} amountField
 * @returns {Array<{ account_id, analytic_account_id, amount }>}
 * @private
 */
function groupByAccountAndAnalytic(lines, accountField, amountField) {
  const groups = new Map();

  for (const line of lines) {
    const accountId = line[accountField];
    if (!accountId) {
      fail(`A document line has no ${accountField.replace(/_/g, ' ')}`);
    }

    const analyticId = line.analytic_account_id || null;
    const key = `${accountId}::${analyticId ?? ''}`;

    const existing = groups.get(key);
    if (existing) {
      existing.amounts.push(line[amountField] ?? '0');
    } else {
      groups.set(key, {
        account_id: accountId,
        analytic_account_id: analyticId,
        amounts: [line[amountField] ?? '0'],
      });
    }
  }

  return [...groups.values()].map((group) => ({
    account_id: group.account_id,
    analytic_account_id: group.analytic_account_id,
    amount: sum(group.amounts),
  }));
}

const accountingRules = {
  /**
   * Vendor Bill posted — project.md §5.1.4.
   *
   *   Dr  Purchase Expense (per line expense_account_id)  untaxed
   *   Dr  Input Tax Credit                                 tax
   *   Cr  Creditors (the vendor's payable)                 total
   *
   * @param {object} params
   * @param {Array}  params.lines - [{ expense_account_id, untaxed_amount,
   *                                   tax_amount, analytic_account_id }]
   * @param {string} params.creditorsAccountId
   * @param {string} [params.inputTaxAccountId] - Required when any tax is present.
   * @param {string} params.contactId - The vendor.
   * @param {string} [params.description]
   * @returns {Array} Journal entry lines.
   */
  vendorBillPosted({
    lines, creditorsAccountId, inputTaxAccountId, contactId, description = null,
  }) {
    if (!Array.isArray(lines) || lines.length === 0) fail('A bill needs at least one line');
    if (!creditorsAccountId) fail('The Creditors account is required to post a bill');

    const entryLines = [];

    // Dr Purchase Expense, one line per (account, analytic) pair.
    for (const group of groupByAccountAndAnalytic(lines, 'expense_account_id', 'untaxed_amount')) {
      if (isZero(group.amount)) continue;
      entryLines.push({
        account_id: group.account_id,
        analytic_account_id: group.analytic_account_id,
        debit: toDb(group.amount),
        credit: '0.00',
        description,
      });
    }

    // Dr Input Tax Credit — Phase 0 Decision 4 puts purchase tax in scope, so
    // it is reclaimable and belongs on an asset account of its own, never
    // buried in the expense.
    const totalTax = sum(lines.map((line) => line.tax_amount ?? '0'));
    if (!isZero(totalTax)) {
      if (!inputTaxAccountId) {
        fail('An Input Tax Credit account is required to post a bill carrying tax');
      }
      entryLines.push({
        account_id: inputTaxAccountId,
        debit: toDb(totalTax),
        credit: '0.00',
        description,
      });
    }

    // Cr Creditors, the whole taxed total, tagged with the vendor so an open-
    // items statement does not have to walk back to the document.
    const totalUntaxed = sum(lines.map((line) => line.untaxed_amount ?? '0'));
    const total = sum([totalUntaxed, totalTax]);

    if (isZero(total)) fail('A bill must have a total greater than zero');

    entryLines.push({
      account_id: creditorsAccountId,
      partner_contact_id: contactId,
      debit: '0.00',
      credit: toDb(total),
      description,
    });

    return entryLines;
  },

  /**
   * Customer Invoice posted — project.md §5.2.4.
   *
   *   Dr  Debtors (the customer's receivable)          total
   *   Cr  Sale Income (per line income_account_id)     untaxed
   *   Cr  Output Tax Payable                            tax
   *
   * project.md §7: TAX POSTS TO ITS OWN ACCOUNT. Folding it into Sale Income
   * would overstate revenue by the tax and understate the liability by the
   * same amount — two wrong reports from one shortcut.
   *
   * @param {object} params
   * @param {Array}  params.lines - [{ income_account_id, untaxed_amount,
   *                                   tax_amount, analytic_account_id }]
   * @param {string} params.debtorsAccountId
   * @param {string} [params.outputTaxAccountId] - Required when any tax is present.
   * @param {string} params.contactId - The customer.
   * @param {string} [params.description]
   * @returns {Array} Journal entry lines.
   */
  customerInvoicePosted({
    lines, debtorsAccountId, outputTaxAccountId, contactId, description = null,
  }) {
    if (!Array.isArray(lines) || lines.length === 0) fail('An invoice needs at least one line');
    if (!debtorsAccountId) fail('The Debtors account is required to post an invoice');

    const totalUntaxed = sum(lines.map((line) => line.untaxed_amount ?? '0'));
    const totalTax = sum(lines.map((line) => line.tax_amount ?? '0'));
    const total = sum([totalUntaxed, totalTax]);

    if (isZero(total)) fail('An invoice must have a total greater than zero');

    const entryLines = [];

    // Dr Debtors for the whole taxed total, tagged with the customer.
    entryLines.push({
      account_id: debtorsAccountId,
      partner_contact_id: contactId,
      debit: toDb(total),
      credit: '0.00',
      description,
    });

    // Cr Sale Income, untaxed only.
    for (const group of groupByAccountAndAnalytic(lines, 'income_account_id', 'untaxed_amount')) {
      if (isZero(group.amount)) continue;
      entryLines.push({
        account_id: group.account_id,
        analytic_account_id: group.analytic_account_id,
        debit: '0.00',
        credit: toDb(group.amount),
        description,
      });
    }

    // Cr Output Tax Payable — its own liability account.
    if (!isZero(totalTax)) {
      if (!outputTaxAccountId) {
        fail('An Output Tax Payable account is required to post an invoice carrying tax');
      }
      entryLines.push({
        account_id: outputTaxAccountId,
        debit: '0.00',
        credit: toDb(totalTax),
        description,
      });
    }

    return entryLines;
  },

  /**
   * Vendor Bill paid — project.md §5.1.5.
   *
   *   Dr  Creditors        amount
   *   Cr  Cash / Bank      amount
   *
   * @param {object} params
   * @returns {Array}
   */
  vendorBillPaid({ creditorsAccountId, cashOrBankAccountId, amount, contactId, description = null }) {
    if (!creditorsAccountId || !cashOrBankAccountId) {
      fail('Both the Creditors and the Cash/Bank account are required to record a payment');
    }
    if (isZero(money(amount))) fail('A payment must be greater than zero');

    return [
      {
        account_id: creditorsAccountId,
        partner_contact_id: contactId,
        debit: toDb(amount),
        credit: '0.00',
        description,
      },
      {
        account_id: cashOrBankAccountId,
        debit: '0.00',
        credit: toDb(amount),
        description,
      },
    ];
  },

  /**
   * Customer Invoice paid by cash or bank — project.md §5.2.5.
   *
   *   Dr  Cash / Bank      amount
   *   Cr  Debtors          amount
   *
   * @param {object} params
   * @returns {Array}
   */
  customerInvoicePaid({ debtorsAccountId, cashOrBankAccountId, amount, contactId, description = null }) {
    if (!debtorsAccountId || !cashOrBankAccountId) {
      fail('Both the Debtors and the Cash/Bank account are required to record a receipt');
    }
    if (isZero(money(amount))) fail('A receipt must be greater than zero');

    return [
      {
        account_id: cashOrBankAccountId,
        debit: toDb(amount),
        credit: '0.00',
        description,
      },
      {
        account_id: debtorsAccountId,
        partner_contact_id: contactId,
        debit: '0.00',
        credit: toDb(amount),
        description,
      },
    ];
  },

  /**
   * Portal card payment — project.md §5.3.5.
   *
   *   Dr  Payment Gateway Clearing   amount
   *   Cr  Debtors                    amount
   *
   * A clearing account rather than Bank, because at that moment the money is
   * with the gateway and not in the bank. Settlement is a later Bank ←
   * Clearing entry, and pretending otherwise makes the bank reconciliation
   * disagree with the ledger for as long as the gateway holds the funds.
   *
   * @param {object} params
   * @returns {Array}
   */
  portalCardPayment({ clearingAccountId, debtorsAccountId, amount, contactId, description = null }) {
    if (!clearingAccountId || !debtorsAccountId) {
      fail('Both the Payment Gateway Clearing and the Debtors account are required');
    }
    if (isZero(money(amount))) fail('A payment must be greater than zero');

    return [
      {
        account_id: clearingAccountId,
        debit: toDb(amount),
        credit: '0.00',
        description,
      },
      {
        account_id: debtorsAccountId,
        partner_contact_id: contactId,
        debit: '0.00',
        credit: toDb(amount),
        description,
      },
    ];
  },

  /**
   * Opening balances — one balancing entry against Opening Balance Equity.
   *
   * Every account's opening_balance is posted on its normal side, and Opening
   * Balance Equity takes whatever makes the entry balance. That is what turns
   * the opening_balance column into real ledger movement instead of a figure
   * every report has to special-case.
   *
   * @param {object} params
   * @param {Array}  params.accounts - [{ id, account_type, opening_balance }]
   * @param {string} params.openingEquityAccountId
   * @param {string} [params.description]
   * @returns {Array|null} Lines, or null when every opening balance is zero.
   */
  openingBalances({ accounts, openingEquityAccountId, description = null }) {
    if (!openingEquityAccountId) {
      fail('The Opening Balance Equity account is required to post opening balances');
    }

    const entryLines = [];
    const debits = [];
    const credits = [];

    for (const account of accounts) {
      const balance = money(account.opening_balance ?? 0);
      if (balance.isZero()) continue;

      // The equity account is the balancing side, so it never posts its own
      // opening balance here — that would double-count it.
      if (account.id === openingEquityAccountId) continue;

      // Assets and expenses are debit-positive; everything else is
      // credit-positive. A negative opening balance simply lands on the
      // other side rather than being posted as a negative amount, which the
      // line CHECK constraint forbids outright.
      const debitNormal = account.account_type === 'asset' || account.account_type === 'expense';
      const positive = !balance.isNegative();
      const onDebitSide = debitNormal === positive;
      const magnitude = toDb(balance.abs());

      entryLines.push({
        account_id: account.id,
        debit: onDebitSide ? magnitude : '0.00',
        credit: onDebitSide ? '0.00' : magnitude,
        description,
      });

      if (onDebitSide) debits.push(magnitude);
      else credits.push(magnitude);
    }

    if (entryLines.length === 0) return null;

    const totalDebit = money(sum(debits));
    const totalCredit = money(sum(credits));
    const difference = totalDebit.minus(totalCredit);

    if (!difference.isZero()) {
      // Opening Balance Equity absorbs the difference, which is exactly what
      // it is for.
      entryLines.push({
        account_id: openingEquityAccountId,
        debit: difference.isNegative() ? toDb(difference.abs()) : '0.00',
        credit: difference.isNegative() ? '0.00' : toDb(difference),
        description,
      });
    }

    // A single opening line that happened to balance on its own would leave a
    // one-line entry, which is not a double entry.
    if (entryLines.length < 2) return null;

    return entryLines;
  },
};

module.exports = accountingRules;
module.exports.groupByAccountAndAnalytic = groupByAccountAndAnalytic;
