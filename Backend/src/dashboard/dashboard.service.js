/**
 * Dashboard Service
 *
 * Aggregates all KPI metrics, charts, and activity into a single unified summary response.
 * Reference: project.md §9 · phase.md Phase 13
 */

const dashboardRepository = require('./dashboard.repository');
const { money, toDb } = require('../shared/money');

function resolveDateRange(period, customFrom, customTo) {
  const now = new Date();

  if (customFrom && customTo) {
    return { fromDate: customFrom, toDate: customTo };
  }

  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case 'this_month': {
      const from = new Date(y, m, 1).toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      return { fromDate: from, toDate: to };
    }
    case 'this_quarter': {
      const qStartMonth = Math.floor(m / 3) * 3;
      const from = new Date(y, qStartMonth, 1).toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      return { fromDate: from, toDate: to };
    }
    case 'this_year':
    default: {
      const from = new Date(y, 0, 1).toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      return { fromDate: from, toDate: to };
    }
  }
}

const dashboardService = {
  /**
   * Complete unified dashboard summary.
   */
  async getSummary(organizationId, query = {}) {
    const { fromDate, toDate } = resolveDateRange(query.period, query.fromDate, query.toDate);

    const [
      outstanding,
      incomeExpense,
      monthlySeries,
      topCustomers,
      aging,
      cashTrend,
      expenseBreakdown,
      recentActivity,
    ] = await Promise.all([
      dashboardRepository.getOutstandingTotals(null, organizationId),
      dashboardRepository.getIncomeExpenseTotals(null, organizationId, fromDate, toDate),
      dashboardRepository.getMonthlySeries(null, organizationId, fromDate, toDate),
      dashboardRepository.getTopCustomers(null, organizationId, fromDate, toDate),
      dashboardRepository.getReceivableAging(null, organizationId),
      dashboardRepository.getCashTrend(null, organizationId),
      dashboardRepository.getExpenseBreakdown(null, organizationId, fromDate, toDate),
      dashboardRepository.getRecentActivity(null, organizationId),
    ]);

    const inc = money(incomeExpense.totalIncome);
    const exp = money(incomeExpense.totalExpenses);
    const net = inc.minus(exp);

    return {
      period: {
        type: query.period || 'this_year',
        fromDate,
        toDate,
      },
      kpis: {
        totalReceivable: toDb(money(outstanding.totalReceivable)),
        totalPayable: toDb(money(outstanding.totalPayable)),
        totalIncome: toDb(inc),
        totalExpenses: toDb(exp),
        netProfit: toDb(net),
        overdueCount: outstanding.overdueCount,
      },
      series: {
        monthlyIncomeExpense: monthlySeries.map((s) => ({
          month: s.month,
          income: toDb(money(s.income)),
          expense: toDb(money(s.expense)),
          netProfit: toDb(money(s.income).minus(money(s.expense))),
        })),
        topCustomers: topCustomers.map((c) => ({
          id: c.id,
          name: c.name,
          totalSales: toDb(money(c.total_sales)),
        })),
        receivableAging: aging.map((a) => ({
          bucket: a.bucket,
          amount: toDb(money(a.amount)),
        })),
        cashTrend: cashTrend.map((c) => ({
          month: c.month,
          netMovement: toDb(money(c.net_cash_movement)),
        })),
        expenseBreakdown: expenseBreakdown.map((e) => ({
          label: e.label,
          value: toDb(money(e.value)),
        })),
      },
      recentActivity,
    };
  },
};

module.exports = dashboardService;
