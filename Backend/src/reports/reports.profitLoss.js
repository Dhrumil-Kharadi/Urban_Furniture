/**
 * Profit & Loss Report Generator
 *
 * Real-time statement of income and expenses over a date range.
 * Reference: project.md §6 · technicalrequirement.md §5.4, §6.13
 *
 * Aggregates movements in income and expense accounts.
 * Provides monthly trend for AreaChart and expense breakdown for DonutChart.
 */

const accountingRepository = require('../accounting/accounting.repository');
const { pool } = require('../config/db');
const { money, toDb } = require('../shared/money');

async function generateProfitLoss(organizationId, fromDate, toDate) {
  const now = new Date();
  const defaultFrom = fromDate || new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const defaultTo = toDate || now.toISOString().slice(0, 10);

  // Single grouped query for account movements in period
  const rows = await accountingRepository.getPeriodMovements(null, organizationId, defaultFrom, defaultTo);

  const income = [];
  const expenses = [];

  let totalIncome = money('0');
  let totalExpenses = money('0');

  for (const row of rows) {
    const mov = money(row.movement || '0');

    if (row.account_type === 'income') {
      income.push({
        accountId: row.account_id,
        code: row.code,
        name: row.name,
        amount: toDb(mov),
        debit: toDb(money(row.total_debit || '0')),
        credit: toDb(money(row.total_credit || '0')),
      });
      totalIncome = totalIncome.plus(mov);
    } else if (row.account_type === 'expense') {
      expenses.push({
        accountId: row.account_id,
        code: row.code,
        name: row.name,
        amount: toDb(mov),
        debit: toDb(money(row.total_debit || '0')),
        credit: toDb(money(row.total_credit || '0')),
      });
      totalExpenses = totalExpenses.plus(mov);
    }
  }

  const netProfit = totalIncome.minus(totalExpenses);

  // ── Monthly trend for AreaChart ──
  const trendRes = await pool.query(
    `SELECT TO_CHAR(e.entry_date, 'YYYY-MM') AS month,
            COALESCE(SUM(CASE WHEN a.account_type = 'income' THEN l.credit - l.debit ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN a.account_type = 'expense' THEN l.debit - l.credit ELSE 0 END), 0) AS expense
       FROM journal_entry_lines l
       JOIN journal_entries e
         ON e.id = l.journal_entry_id AND e.organization_id = l.organization_id
       JOIN accounts a
         ON a.id = l.account_id AND a.organization_id = l.organization_id
      WHERE l.organization_id = $1
        AND e.status = 'posted'
        AND a.account_type IN ('income', 'expense')
        AND e.entry_date BETWEEN $2 AND $3
      GROUP BY TO_CHAR(e.entry_date, 'YYYY-MM')
      ORDER BY month ASC`,
    [organizationId, defaultFrom, defaultTo]
  );

  const trendSeries = trendRes.rows.map((r) => {
    const inc = money(r.income || '0');
    const exp = money(r.expense || '0');
    const net = inc.minus(exp);
    return {
      month: r.month,
      income: toDb(inc),
      expense: toDb(exp),
      netProfit: toDb(net),
    };
  });

  // ── Expense breakdown for DonutChart (top 6 + Other) ──
  const sortedExpenses = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount));
  const top6 = sortedExpenses.slice(0, 6);
  const remaining = sortedExpenses.slice(6);

  const expenseBreakdown = top6.map((e) => ({
    label: e.name,
    value: e.amount,
  }));

  if (remaining.length > 0) {
    const otherTotal = remaining.reduce((acc, r) => acc.plus(money(r.amount)), money('0'));
    expenseBreakdown.push({
      label: 'Other Expenses',
      value: toDb(otherTotal),
    });
  }

  return {
    period: {
      fromDate: defaultFrom,
      toDate: defaultTo,
    },
    income: {
      lines: income,
      total: toDb(totalIncome),
    },
    expenses: {
      lines: expenses,
      total: toDb(totalExpenses),
    },
    netProfit: toDb(netProfit),
    isProfitable: netProfit.greaterThanOrEqualTo(0),
    trendSeries,
    expenseBreakdown,
  };
}

module.exports = { generateProfitLoss };
