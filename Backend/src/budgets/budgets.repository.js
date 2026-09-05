/**
 * Budgets Repository
 *
 * Parameterised SQL only. All queries filter by organization_id.
 *
 * Actual amounts are calculated dynamically from journal_entry_lines on read,
 * NEVER stored, ensuring that changes to journal entries immediately reflect in budgets.
 */

const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, searchTerm, listResult } = require('../shared/listQuery');

const ALLOWED_SORT_COLUMNS = ['name', 'period_start', 'period_end', 'planned_amount', 'status', 'created_at'];

const budgetsRepository = {
  /**
   * Insert a new budget.
   */
  async insertBudget(client, payload) {
    const db = client || pool;
    const res = await db.query(
      `INSERT INTO budgets (
         organization_id, name, period_start, period_end,
         responsible_user_id, analytic_account_id, planned_amount,
         status, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING id, organization_id, name, period_start, period_end,
                 responsible_user_id, analytic_account_id, planned_amount,
                 status, created_at, updated_at`,
      [
        payload.organization_id,
        payload.name,
        payload.period_start,
        payload.period_end,
        payload.responsible_user_id,
        payload.analytic_account_id,
        payload.planned_amount,
        payload.status || 'active',
        payload.actor_user_id,
      ]
    );
    return res.rows[0];
  },

  /**
   * Update a budget.
   */
  async updateBudget(client, organizationId, id, payload, actorUserId) {
    const db = client || pool;
    const sets = [];
    const params = [id, organizationId];

    const allowed = ['name', 'period_start', 'period_end', 'responsible_user_id', 'analytic_account_id', 'planned_amount', 'status'];
    for (const key of allowed) {
      if (payload[key] !== undefined) {
        params.push(payload[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }

    if (sets.length === 0) return this.findBudgetById(db, organizationId, id);

    params.push(actorUserId);
    sets.push(`updated_by = $${params.length}`);
    sets.push(`updated_at = NOW()`);

    const res = await db.query(
      `UPDATE budgets
          SET ${sets.join(', ')}
        WHERE id = $1 AND organization_id = $2
        RETURNING id, organization_id, name, period_start, period_end,
                  responsible_user_id, analytic_account_id, planned_amount,
                  status, created_at, updated_at`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * Find a budget by ID with basic relations.
   */
  async findBudgetById(client, organizationId, id) {
    const db = client || pool;
    const res = await db.query(
      `SELECT b.*,
              an.name AS analytic_account_name,
              an.analytic_type,
              u.name AS responsible_user_name,
              u.email AS responsible_user_email
         FROM budgets b
         JOIN analytic_accounts an
           ON an.id = b.analytic_account_id AND an.organization_id = b.organization_id
         LEFT JOIN users u
           ON u.id = b.responsible_user_id
        WHERE b.id = $1 AND b.organization_id = $2`,
      [id, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * List budgets with dynamic actuals aggregation.
   *
   * Exact algorithm from project.md §8:
   * - posted parent entries only
   * - signed by analytic type:
   *     expense: SUM(debit) - SUM(credit)
   *     income:  SUM(credit) - SUM(debit)
   */
  async listBudgets(client, organizationId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['b.organization_id = $1'];
    const params = [organizationId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`b.status = $${params.length}`);
    }

    if (query.analytic_account_id) {
      params.push(query.analytic_account_id);
      conditions.push(`b.analytic_account_id = $${params.length}`);
    }

    if (query.dateFrom) {
      params.push(query.dateFrom);
      conditions.push(`b.period_end >= $${params.length}`);
    }

    if (query.dateTo) {
      params.push(query.dateTo);
      conditions.push(`b.period_start <= $${params.length}`);
    }

    const search = searchTerm(query);
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(b.name ILIKE $${idx} OR an.name ILIKE $${idx} OR u.name ILIKE $${idx})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total
         FROM budgets b
         JOIN analytic_accounts an ON an.id = b.analytic_account_id AND an.organization_id = b.organization_id
         LEFT JOIN users u ON u.id = b.responsible_user_id
       ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const sortParams = query.sortBy ? query : { ...query, sortBy: 'period_start', sortOrder: 'desc' };
    const orderBy = buildSort(sortParams, ALLOWED_SORT_COLUMNS, 'period_start').replace(/^"/, 'b."');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT b.id,
              b.organization_id,
              b.name,
              b.period_start,
              b.period_end,
              b.planned_amount,
              b.status,
              b.created_at,
              b.updated_at,
              an.id AS analytic_account_id,
              an.name AS analytic_account_name,
              an.analytic_type,
              u.id AS responsible_user_id,
              u.name AS responsible_user_name,
              u.email AS responsible_user_email,
              COALESCE(actuals.raw_actual, 0) AS raw_actual
         FROM budgets b
         JOIN analytic_accounts an
           ON an.id = b.analytic_account_id AND an.organization_id = b.organization_id
         LEFT JOIN users u
           ON u.id = b.responsible_user_id
         LEFT JOIN LATERAL (
           SELECT
             CASE
               WHEN an.analytic_type = 'expense'
                 THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
               ELSE
                 COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
             END AS raw_actual
             FROM journal_entry_lines l
             JOIN journal_entries e
               ON e.id = l.journal_entry_id AND e.organization_id = l.organization_id
            WHERE l.organization_id = b.organization_id
              AND l.analytic_account_id = b.analytic_account_id
              AND e.status = 'posted'
              AND e.entry_date BETWEEN b.period_start AND b.period_end
         ) actuals ON true
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return listResult(dataRes.rows, page, limit, total);
  },

  /**
   * Contributing journal lines for budget auditability.
   */
  async findContributingLines(client, organizationId, analyticAccountId, fromDate, toDate, options = {}) {
    const db = client || pool;
    const { limit = 100, offset = 0 } = options;

    const res = await db.query(
      `SELECT l.id AS line_id,
              l.line_no,
              l.debit,
              l.credit,
              l.description AS line_description,
              e.id AS journal_entry_id,
              e.entry_number,
              e.entry_date,
              e.reference,
              e.source_type,
              e.source_id,
              a.id AS account_id,
              a.code AS account_code,
              a.name AS account_name,
              c.name AS partner_name
         FROM journal_entry_lines l
         JOIN journal_entries e
           ON e.id = l.journal_entry_id AND e.organization_id = l.organization_id
         JOIN accounts a
           ON a.id = l.account_id AND a.organization_id = l.organization_id
         LEFT JOIN contacts c
           ON c.id = l.partner_contact_id AND c.organization_id = l.organization_id
        WHERE l.organization_id = $1
          AND l.analytic_account_id = $2
          AND e.status = 'posted'
          AND e.entry_date BETWEEN $3 AND $4
        ORDER BY e.entry_date DESC, e.entry_number DESC, l.line_no ASC
        LIMIT $5 OFFSET $6`,
      [organizationId, analyticAccountId, fromDate, toDate, limit, offset]
    );

    return res.rows;
  },

  /**
   * Monthly breakdown of actuals for GroupedBarChart.
   */
  async getMonthlyBreakdown(client, organizationId, analyticAccountId, analyticType, fromDate, toDate) {
    const db = client || pool;
    const res = await db.query(
      `SELECT TO_CHAR(e.entry_date, 'YYYY-MM') AS month,
              CASE
                WHEN $3 = 'expense'
                  THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                ELSE
                  COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
              END AS actual
         FROM journal_entry_lines l
         JOIN journal_entries e
           ON e.id = l.journal_entry_id AND e.organization_id = l.organization_id
        WHERE l.organization_id = $1
          AND l.analytic_account_id = $2
          AND e.status = 'posted'
          AND e.entry_date BETWEEN $4 AND $5
        GROUP BY TO_CHAR(e.entry_date, 'YYYY-MM')
        ORDER BY month ASC`,
      [organizationId, analyticAccountId, analyticType, fromDate, toDate]
    );
    return res.rows;
  },
};

module.exports = budgetsRepository;
