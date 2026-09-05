/**
 * Reports CSV Exporter
 *
 * Implements P0 Decision 6: Export financial statements to standard CSV.
 */

function escapeCsv(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

function exportBalanceSheetCsv(data) {
  const lines = [];
  lines.push(`"Balance Sheet Statement as of ${data.asOfDate}"`);
  lines.push('');

  lines.push('"Account Code","Account Name","Section","Balance"');

  for (const a of data.assets.lines) {
    lines.push(`${escapeCsv(a.code)},${escapeCsv(a.name)},"Assets",${escapeCsv(a.balance)}`);
  }
  lines.push(`"","Total Assets","Assets",${escapeCsv(data.assets.total)}`);
  lines.push('');

  for (const l of data.liabilities.lines) {
    lines.push(`${escapeCsv(l.code)},${escapeCsv(l.name)},"Liabilities",${escapeCsv(l.balance)}`);
  }
  lines.push(`"","Total Liabilities","Liabilities",${escapeCsv(data.liabilities.total)}`);
  lines.push('');

  for (const c of data.capital.lines) {
    lines.push(`${escapeCsv(c.code)},${escapeCsv(c.name)},"Capital",${escapeCsv(c.balance)}`);
  }
  lines.push(`"","Retained Net Profit","Capital",${escapeCsv(data.capital.netProfit)}`);
  lines.push(`"","Total Capital & Equity","Capital",${escapeCsv(data.capital.total)}`);
  lines.push('');
  lines.push(`"","Total Liabilities & Equity","",${escapeCsv(data.totalLiabilitiesAndEquity)}`);
  lines.push(`"","Balanced Guarantee",,${data.isBalanced ? '"YES"' : '"NO - CHECK ENTRIES"'}`);

  return lines.join('\n');
}

function exportProfitLossCsv(data) {
  const lines = [];
  lines.push(`"Profit & Loss Statement (${data.period.fromDate} to ${data.period.toDate})"`);
  lines.push('');

  lines.push('"Account Code","Account Name","Type","Amount"');

  for (const inc of data.income.lines) {
    lines.push(`${escapeCsv(inc.code)},${escapeCsv(inc.name)},"Income",${escapeCsv(inc.amount)}`);
  }
  lines.push(`"","Total Income","Income",${escapeCsv(data.income.total)}`);
  lines.push('');

  for (const exp of data.expenses.lines) {
    lines.push(`${escapeCsv(exp.code)},${escapeCsv(exp.name)},"Expense",${escapeCsv(exp.amount)}`);
  }
  lines.push(`"","Total Expenses","Expense",${escapeCsv(data.expenses.total)}`);
  lines.push('');
  lines.push(`"","Net Profit / (Loss)","",${escapeCsv(data.netProfit)}`);

  return lines.join('\n');
}

function exportBudgetCsv(data) {
  const lines = [];
  lines.push('"Budget Performance Report"');
  lines.push('');

  lines.push('"Budget Name","Analytic Account","Type","Period Start","Period End","Planned","Actual","Variance","Variance %"');

  for (const b of data.budgets) {
    lines.push(
      `${escapeCsv(b.name)},${escapeCsv(b.analyticAccountName)},${escapeCsv(b.analyticType)},` +
      `${escapeCsv(b.periodStart)},${escapeCsv(b.periodEnd)},${escapeCsv(b.plannedAmount)},` +
      `${escapeCsv(b.actualAmount)},${escapeCsv(b.variance)},${escapeCsv(b.variancePercent + '%')}`
    );
  }

  lines.push('');
  lines.push(
    `"Total Summary",,"",,,${escapeCsv(data.summary.totalPlanned)},` +
    `${escapeCsv(data.summary.totalActual)},${escapeCsv(data.summary.totalVariance)},` +
    `${escapeCsv(data.summary.variancePercent + '%')}`
  );

  return lines.join('\n');
}

module.exports = {
  exportBalanceSheetCsv,
  exportProfitLossCsv,
  exportBudgetCsv,
};
