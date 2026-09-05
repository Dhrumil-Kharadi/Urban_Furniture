/**
 * Balance Sheet Report Generator
 *
 * Real-time balance sheet statement as of a given date.
 * Reference: project.md §6 · technicalrequirement.md §5.4, §6.13
 *
 * CRITICAL REQUIREMENTS:
 * 1. Single grouped query via accountingRepository.getAccountBalances.
 * 2. Posted entries only.
 * 3. Normal-side balance signing:
 *    - Assets & Expenses: debit-positive
 *    - Liabilities, Capital & Income: credit-positive
 * 4. Net Profit for the period folds into Capital, ensuring:
 *    Assets = Liabilities + Capital + Net Profit
 * 5. isBalanced boolean asserted with Decimal precision via money.js.
 *    If false, UI displays a warning rather than a silently incorrect report.
 * 6. NO caching (real-time snapshot).
 */

const accountingRepository = require('../accounting/accounting.repository');
const { money, toDb } = require('../shared/money');

async function generateBalanceSheet(organizationId, asOfDate) {
  const targetDate = asOfDate || new Date().toISOString().slice(0, 10);

  // Single grouped query over all accounts with movements up to asOfDate
  const accountRows = await accountingRepository.getAccountBalances(null, organizationId, targetDate);

  const assets = [];
  const liabilities = [];
  const capital = [];
  let incomeTotal = money('0');
  let expenseTotal = money('0');

  let assetsTotal = money('0');
  let liabilitiesTotal = money('0');
  let capitalTotal = money('0');

  for (const row of accountRows) {
    const bal = money(row.balance || '0');

    if (row.account_type === 'asset') {
      assets.push({
        accountId: row.account_id,
        code: row.code,
        name: row.name,
        balance: toDb(bal),
        debit: toDb(money(row.total_debit || '0')),
        credit: toDb(money(row.total_credit || '0')),
      });
      assetsTotal = assetsTotal.plus(bal);
    } else if (row.account_type === 'liability') {
      liabilities.push({
        accountId: row.account_id,
        code: row.code,
        name: row.name,
        balance: toDb(bal),
        debit: toDb(money(row.total_debit || '0')),
        credit: toDb(money(row.total_credit || '0')),
      });
      liabilitiesTotal = liabilitiesTotal.plus(bal);
    } else if (row.account_type === 'capital') {
      capital.push({
        accountId: row.account_id,
        code: row.code,
        name: row.name,
        balance: toDb(bal),
        debit: toDb(money(row.total_debit || '0')),
        credit: toDb(money(row.total_credit || '0')),
      });
      capitalTotal = capitalTotal.plus(bal);
    } else if (row.account_type === 'income') {
      incomeTotal = incomeTotal.plus(bal);
    } else if (row.account_type === 'expense') {
      expenseTotal = expenseTotal.plus(bal);
    }
  }

  // Net profit = Total Income - Total Expense up to asOfDate
  const netProfit = incomeTotal.minus(expenseTotal);

  // Capital with Net Profit folded in
  const totalCapitalWithProfit = capitalTotal.plus(netProfit);
  const totalLiabilitiesAndEquity = liabilitiesTotal.plus(totalCapitalWithProfit);

  // Equation: Assets === Liabilities + Capital + Net Profit
  const isBalanced = assetsTotal.equals(totalLiabilitiesAndEquity);

  // StackedBarChart data formatting for UI
  const chartData = [
    {
      category: 'Assets',
      total: toDb(assetsTotal),
      segments: assets.slice(0, 5).map((a) => ({ label: a.name, value: a.balance })),
    },
    {
      category: 'Liabilities & Equity',
      total: toDb(totalLiabilitiesAndEquity),
      segments: [
        { label: 'Liabilities', value: toDb(liabilitiesTotal) },
        { label: 'Capital', value: toDb(capitalTotal) },
        { label: 'Retained Net Profit', value: toDb(netProfit) },
      ],
    },
  ];

  return {
    asOfDate: targetDate,
    assets: {
      lines: assets,
      total: toDb(assetsTotal),
    },
    liabilities: {
      lines: liabilities,
      total: toDb(liabilitiesTotal),
    },
    capital: {
      lines: capital,
      subtotal: toDb(capitalTotal),
      netProfit: toDb(netProfit),
      total: toDb(totalCapitalWithProfit),
    },
    totalLiabilitiesAndEquity: toDb(totalLiabilitiesAndEquity),
    isBalanced,
    discrepancy: toDb(assetsTotal.minus(totalLiabilitiesAndEquity)),
    chartData,
  };
}

module.exports = { generateBalanceSheet };
