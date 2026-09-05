/**
 * Dashboard Repository
 *
 * Parameterized, single-grouped queries for dashboard summary.
 * Every query is strictly scoped by organization_id.
 * Reference: project.md §9 · phase.md Phase 13
 */

const { pool } = require('../config/db');

const dashboardRepository = {
  /**
   * Outstanding totals for receivables and payables.
   */
  async getOutstandingTotals(client, organizationId) {
    const db = client || pool;

    const [recRes, payRes, overdueRes] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(amount_due), 0) AS total_receivable
           FROM customer_invoices
          WHERE organization_id = $1 AND status IN ('posted', 'partially_paid')`,
        [organizationId]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount_due), 0) AS total_payable
           FROM vendor_bills
          WHERE organization_id = $1 AND status IN ('posted', 'partially_paid')`,
        [organizationId]
      ),
      db.query(
        `SELECT
           (SELECT COUNT(*)::integer FROM customer_invoices
             WHERE organization_id = $1 AND status IN ('posted', 'partially_paid') AND due_date < CURRENT_DATE)
           +
           (SELECT COUNT(*)::integer FROM vendor_bills
             WHERE organization_id = $1 AND status IN ('posted', 'partially_paid') AND due_date < CURRENT_DATE)
           AS total_overdue_count`,
        [organizationId]
      ),
    ]);

    return {
      totalReceivable: recRes.rows[0]?.total_receivable || '0.00',
      totalPayable: payRes.rows[0]?.total_payable || '0.00',
      overdueCount: overdueRes.rows[0]?.total_overdue_count || 0,
    };
  },

  /**
   * Income and Expense totals for the selected period from posted journal lines.
   */
  async getIncomeExpenseTotals(client, organizationId, fromDate, toDate) {
    const db = client || pool;

    const res = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN a.account_type = 'income' THEN l.credit - l.debit ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN a.account_type = 'expense' THEN l.debit - l.credit ELSE 0 END), 0) AS total_expenses
        FROM journal_entry_lines l
        JOIN journal_entries e ON e.id = l.journal_entry_id AND e.organization_id = l.organization_id
        JOIN accounts a ON a.id = l.account_id AND a.organization_id = l.organization_id
       WHERE l.organization_id = $1
         AND e.status = 'posted'
         AND a.account_type IN ('income', 'expense')
         AND e.entry_date BETWEEN $2 AND $3`,
      [organizationId, fromDate, toDate]
    );

    return {
      totalIncome: res.rows[0]?.total_income || '0.00',
      totalExpenses: res.rows[0]?.total_expenses || '0.00',
    };
  },

  /**
   * Monthly breakdown series of Income vs Expense.
   */
  async getMonthlySeries(client, organizationId, fromDate, toDate) {
    const db = client || pool;

    const res = await db.query(
      `SELECT TO_CHAR(e.entry_date, 'YYYY-MM') AS month,
              COALESCE(SUM(CASE WHEN a.account_type = 'income' THEN l.credit - l.debit ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN a.account_type = 'expense' THEN l.debit - l.credit ELSE 0 END), 0) AS expense
         FROM journal_entry_lines l
         JOIN journal_entries e ON e.id = l.journal_entry_id AND e.organization_id = l.organization_id
         JOIN accounts a ON a.id = l.account_id AND a.organization_id = l.organization_id
        WHERE l.organization_id = $1
          AND e.status = 'posted'
          AND a.account_type IN ('income', 'expense')
          AND e.entry_date BETWEEN $2 AND $3
        GROUP BY TO_CHAR(e.entry_date, 'YYYY-MM')
        ORDER BY month ASC`,
      [organizationId, fromDate, toDate]
    );

    return res.rows;
  },

  /**
   * Top 5 customers by sales total in the period.
   */
  async getTopCustomers(client, organizationId, fromDate, toDate) {
    const db = client || pool;

    const res = await db.query(
      `SELECT c.id, c.name,
              COALESCE(SUM(i.total_amount), 0) AS total_sales
         FROM customer_invoices i
         JOIN contacts c ON c.id = i.customer_contact_id AND c.organization_id = i.organization_id
        WHERE i.organization_id = $1
          AND i.status IN ('posted', 'partially_paid', 'paid')
          AND i.invoice_date BETWEEN $2 AND $3
        GROUP BY c.id, c.name
        ORDER BY total_sales DESC
        LIMIT 5`,
      [organizationId, fromDate, toDate]
    );

    return res.rows;
  },

  /**
   * Accounts receivable aging buckets.
   */
  async getReceivableAging(client, organizationId) {
    const db = client || pool;

    const res = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date <= 30 THEN amount_due ELSE 0 END), 0) AS bucket_0_30,
         COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN amount_due ELSE 0 END), 0) AS bucket_31_60,
         COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN amount_due ELSE 0 END), 0) AS bucket_61_90,
         COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date > 90 THEN amount_due ELSE 0 END), 0) AS bucket_90_plus
        FROM customer_invoices
       WHERE organization_id = $1
         AND status IN ('posted', 'partially_paid')`,
      [organizationId]
    );

    const r = res.rows[0] || {};
    return [
      { bucket: '0-30 days', amount: r.bucket_0_30 || '0.00' },
      { bucket: '31-60 days', amount: r.bucket_31_60 || '0.00' },
      { bucket: '61-90 days', amount: r.bucket_61_90 || '0.00' },
      { bucket: '90+ days', amount: r.bucket_90_plus || '0.00' },
    ];
  },

  /**
   * Cash and bank balance trend for Sparkline.
   */
  async getCashTrend(client, organizationId) {
    const db = client || pool;

    const res = await db.query(
      `SELECT TO_CHAR(e.entry_date, 'YYYY-MM') AS month,
              COALESCE(SUM(l.debit - l.credit), 0) AS net_cash_movement
         FROM journal_entry_lines l
         JOIN journal_entries e ON e.id = l.journal_entry_id AND e.organization_id = l.organization_id
         JOIN accounts a ON a.id = l.account_id AND a.organization_id = l.organization_id
        WHERE l.organization_id = $1
          AND e.status = 'posted'
          AND a.code IN ('1010', '1020')
        GROUP BY TO_CHAR(e.entry_date, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 6`,
      [organizationId]
    );

    return res.rows.reverse();
  },

  /**
   * Top 5 expense breakdown for DonutChart.
   */
  async getExpenseBreakdown(client, organizationId, fromDate, toDate) {
    const db = client || pool;

    const res = await db.query(
      `SELECT a.name AS label,
              COALESCE(SUM(l.debit - l.credit), 0) AS value
         FROM journal_entry_lines l
         JOIN journal_entries e ON e.id = l.journal_entry_id AND e.organization_id = l.organization_id
         JOIN accounts a ON a.id = l.account_id AND a.organization_id = l.organization_id
        WHERE l.organization_id = $1
          AND e.status = 'posted'
          AND a.account_type = 'expense'
          AND e.entry_date BETWEEN $2 AND $3
        GROUP BY a.id, a.name
        ORDER BY value DESC
        LIMIT 6`,
      [organizationId, fromDate, toDate]
    );

    return res.rows;
  },

  /**
   * Recent activity logs for organization.
   */
  async getRecentActivity(client, organizationId) {
    const db = client || pool;

    const res = await db.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at,
              u.name AS actor_name, u.email AS actor_email
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.organization_id = $1
        ORDER BY a.created_at DESC
        LIMIT 10`,
      [organizationId]
    );

    return res.rows;
  },
};

module.exports = dashboardRepository;
