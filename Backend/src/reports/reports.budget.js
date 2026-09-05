/**
 * Budget Report Generator
 *
 * Compares planned budget targets with dynamic actuals derived from posted
 * journal_entry_lines tagged with the corresponding analytic account.
 * Reference: project.md §8 · technicalrequirement.md §6.7
 */

const { pool } = require('../config/db');
const budgetsRepository = require('../budgets/budgets.repository');
const { money, toDb } = require('../shared/money');

async function generateBudgetReport(organizationId, options = {}) {
  const { budgetId, fromDate, toDate } = options;

  let query = { limit: 100 };
  if (fromDate) query.dateFrom = fromDate;
  if (toDate) query.dateTo = toDate;

  let items = [];

  if (budgetId) {
    const single = await budgetsRepository.findBudgetById(null, organizationId, budgetId);
    if (single) {
      // Find actuals for this single budget
      const actualsRes = await pool.query(
        `SELECT
           CASE
             WHEN an.analytic_type = 'expense'
               THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
             ELSE
               COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
           END AS actual
           FROM analytic_accounts an
           LEFT JOIN journal_entry_lines l
             ON l.analytic_account_id = an.id AND l.organization_id = an.organization_id
           LEFT JOIN journal_entries e
             ON e.id = l.journal_entry_id AND e.organization_id = l.organization_id
          WHERE an.organization_id = $1
            AND an.id = $2
            AND e.status = 'posted'
            AND e.entry_date BETWEEN $3 AND $4
          GROUP BY an.id, an.analytic_type`,
        [organizationId, single.analytic_account_id, single.period_start, single.period_end]
      );

      single.raw_actual = actualsRes.rows[0]?.actual || '0';
      items = [single];
    }
  } else {
    const list = await budgetsRepository.listBudgets(null, organizationId, query);
    items = list.items;
  }

  let grandPlanned = money('0');
  let grandActual = money('0');

  const budgetLines = items.map((b) => {
    const planned = money(b.planned_amount || '0');
    const actual = money(b.raw_actual || '0');
    const variance = planned.minus(actual);

    let variancePercent = '0.00';
    let consumptionPercent = '0.00';

    if (!planned.isZero()) {
      variancePercent = variance.dividedBy(planned).times(100).toFixed(2);
      consumptionPercent = actual.dividedBy(planned).times(100).toFixed(2);
    }

    grandPlanned = grandPlanned.plus(planned);
    grandActual = grandActual.plus(actual);

    return {
      id: b.id,
      name: b.name,
      periodStart: b.period_start,
      periodEnd: b.period_end,
      analyticAccountName: b.analytic_account_name,
      analyticType: b.analytic_type,
      plannedAmount: toDb(planned),
      actualAmount: toDb(actual),
      variance: toDb(variance),
      variancePercent,
      consumptionPercent,
      isOverBudget: actual.greaterThan(planned),
    };
  });

  const grandVariance = grandPlanned.minus(grandActual);
  let grandVariancePercent = '0.00';
  if (!grandPlanned.isZero()) {
    grandVariancePercent = grandVariance.dividedBy(grandPlanned).times(100).toFixed(2);
  }

  // Chart data for GroupedBarChart (Planned vs Actual per budget)
  const chartData = budgetLines.slice(0, 10).map((b) => ({
    label: b.name.length > 18 ? b.name.slice(0, 16) + '...' : b.name,
    series: [
      { name: 'Planned', value: Number(b.plannedAmount) },
      { name: 'Actual', value: Number(b.actualAmount) },
    ],
  }));

  return {
    budgets: budgetLines,
    summary: {
      totalPlanned: toDb(grandPlanned),
      totalActual: toDb(grandActual),
      totalVariance: toDb(grandVariance),
      variancePercent: grandVariancePercent,
      isOverBudget: grandActual.greaterThan(grandPlanned),
    },
    chartData,
  };
}

module.exports = { generateBudgetReport };
