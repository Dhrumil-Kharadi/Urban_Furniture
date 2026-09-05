/**
 * Budgets Service
 *
 * Orchestration and business rules for budgets.
 * Reference: project.md §4.7, §8 · technicalrequirement.md §6.7
 */

const budgetsRepository = require('./budgets.repository');
const analyticsRepository = require('../analytics/analytics.repository');
const { withTransaction } = require('../shared/withTransaction');
const { recordAudit } = require('../shared/audit.service');
const { money, toDb, isZero } = require('../shared/money');

function computeMetrics(plannedStr, actualStr) {
  const planned = money(plannedStr || '0');
  const actual = money(actualStr || '0');

  // variance = planned - actual
  const variance = planned.minus(actual);

  // variancePercent = variance / planned * 100, guarding planned = 0
  let variancePercent = '0.00';
  let consumptionPercent = '0.00';

  if (!planned.isZero()) {
    variancePercent = variance.dividedBy(planned).times(100).toFixed(2);
    consumptionPercent = actual.dividedBy(planned).times(100).toFixed(2);
  }

  return {
    plannedAmount: toDb(planned),
    actualAmount: toDb(actual),
    variance: toDb(variance),
    variancePercent,
    consumptionPercent,
    isOverBudget: actual.greaterThan(planned),
  };
}

const budgetsService = {
  /**
   * Create a new budget.
   */
  async createBudget(organizationId, payload, actorUserId) {
    return withTransaction(async (client) => {
      // Confirm analytic account is active and same-org
      const analytic = await analyticsRepository.findByIdAndOrg(client, organizationId, payload.analytic_account_id);
      if (!analytic || analytic.status !== 'active') {
        const err = new Error('Analytic account not found or is archived');
        err.statusCode = 400;
        throw err;
      }

      const budget = await budgetsRepository.insertBudget(client, {
        organization_id: organizationId,
        ...payload,
        actor_user_id: actorUserId,
      });

      await recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'CREATE',
        entityType: 'budget',
        entityId: budget.id,
        before: null,
        after: budget,
      });

      return budget;
    });
  },

  /**
   * Update a budget.
   */
  async updateBudget(organizationId, id, payload, actorUserId) {
    return withTransaction(async (client) => {
      const existing = await budgetsRepository.findBudgetById(client, organizationId, id);
      if (!existing) {
        const err = new Error('Budget not found');
        err.statusCode = 404;
        throw err;
      }

      if (payload.analytic_account_id && payload.analytic_account_id !== existing.analytic_account_id) {
        const analytic = await analyticsRepository.findByIdAndOrg(client, organizationId, payload.analytic_account_id);
        if (!analytic || analytic.status !== 'active') {
          const err = new Error('Analytic account not found or is archived');
          err.statusCode = 400;
          throw err;
        }
      }

      const updated = await budgetsRepository.updateBudget(client, organizationId, id, payload, actorUserId);

      await recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'UPDATE',
        entityType: 'budget',
        entityId: id,
        before: existing,
        after: updated,
      });

      return updated;
    });
  },

  /**
   * List budgets with calculated actuals and variances.
   */
  async listBudgets(organizationId, query = {}) {
    const result = await budgetsRepository.listBudgets(null, organizationId, query);

    const items = result.items.map((b) => {
      const metrics = computeMetrics(b.planned_amount, b.raw_actual);
      return {
        id: b.id,
        name: b.name,
        periodStart: b.period_start,
        periodEnd: b.period_end,
        status: b.status,
        analyticAccount: {
          id: b.analytic_account_id,
          name: b.analytic_account_name,
          analyticType: b.analytic_type,
        },
        responsibleUser: b.responsible_user_id
          ? {
              id: b.responsible_user_id,
              name: b.responsible_user_name,
              email: b.responsible_user_email,
            }
          : null,
        ...metrics,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      };
    });

    return {
      items,
      pagination: result.pagination,
    };
  },

  /**
   * Get single budget detail with monthly trend and contributing lines.
   */
  async getBudgetDetail(organizationId, id) {
    const budget = await budgetsRepository.findBudgetById(null, organizationId, id);
    if (!budget) {
      const err = new Error('Budget not found');
      err.statusCode = 404;
      throw err;
    }

    // Get contributing lines
    const lines = await budgetsRepository.findContributingLines(
      null,
      organizationId,
      budget.analytic_account_id,
      budget.period_start,
      budget.period_end,
      { limit: 100 }
    );

    // Get monthly breakdown
    const monthlyData = await budgetsRepository.getMonthlyBreakdown(
      null,
      organizationId,
      budget.analytic_account_id,
      budget.analytic_type,
      budget.period_start,
      budget.period_end
    );

    // Sum actuals from lines
    let totalActual = '0.00';
    if (lines.length > 0) {
      const isExpense = budget.analytic_type === 'expense';
      const net = lines.reduce((acc, l) => {
        const d = money(l.debit || '0');
        const c = money(l.credit || '0');
        return isExpense ? acc.plus(d.minus(c)) : acc.plus(c.minus(d));
      }, money('0'));
      totalActual = toDb(net);
    }

    const metrics = computeMetrics(budget.planned_amount, totalActual);

    return {
      id: budget.id,
      name: budget.name,
      periodStart: budget.period_start,
      periodEnd: budget.period_end,
      status: budget.status,
      analyticAccount: {
        id: budget.analytic_account_id,
        name: budget.analytic_account_name,
        analyticType: budget.analytic_type,
      },
      responsibleUser: budget.responsible_user_id
        ? {
            id: budget.responsible_user_id,
            name: budget.responsible_user_name,
            email: budget.responsible_user_email,
          }
        : null,
      ...metrics,
      monthlyBreakdown: monthlyData.map((m) => ({
        month: m.month,
        actual: toDb(money(m.actual || '0')),
      })),
      contributingLines: lines.map((l) => ({
        id: l.line_id,
        lineNo: l.line_no,
        entryNumber: l.entry_number,
        entryDate: l.entry_date,
        reference: l.reference,
        accountCode: l.account_code,
        accountName: l.account_name,
        partnerName: l.partner_name,
        debit: toDb(money(l.debit || '0')),
        credit: toDb(money(l.credit || '0')),
        description: l.line_description,
      })),
      createdAt: budget.created_at,
      updatedAt: budget.updated_at,
    };
  },

  /**
   * Archive a budget.
   */
  async archiveBudget(organizationId, id, actorUserId) {
    return this.updateBudget(organizationId, id, { status: 'archived' }, actorUserId);
  },
};

module.exports = budgetsService;
