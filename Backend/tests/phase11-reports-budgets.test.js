const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/app');
const authSession = require('../src/auth/auth.session');
const { seedOrganizationMasterData } = require('../src/organizations/organizations.seed');
const accountingService = require('../src/accounting/accounting.service');

jest.setTimeout(60000);

const suffix = Date.now();

describe('Phase 11: Budgets & Financial Reports', () => {
  let orgId;
  let adminId;
  let managerId;
  let contactUserId;
  let adminSid;
  let managerSid;
  let userToken;

  let analyticDeptA;
  let analyticIncomeB;
  let salesJournal;
  let bankAccount;
  let salesIncomeAccount;
  let expenseAccount;

  const asAdmin = (req) => req.set('Cookie', [`sid=${adminSid}`]);
  const asManager = (req) => req.set('Cookie', [`sid=${managerSid}`]);
  const asUser = (req) => req.set('Authorization', `Bearer ${userToken}`);

  beforeAll(async () => {
    // 1. Create Org
    const orgRes = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Phase11 Org ${suffix}`, `phase11-org-${suffix}`]
    );
    orgId = orgRes.rows[0].id;

    // 2. Create users
    const adminRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', 'admin', true, $3) RETURNING id`,
      ['Admin P11', `admin_p11_${suffix}@test.com`, orgId]
    );
    adminId = adminRes.rows[0].id;

    const mgrRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', 'manager', true, $3) RETURNING id`,
      ['Manager P11', `mgr_p11_${suffix}@test.com`, orgId]
    );
    managerId = mgrRes.rows[0].id;

    // Contact user
    const contactRes = await pool.query(
      `INSERT INTO contacts (organization_id, name, contact_type, email, portal_access_enabled)
       VALUES ($1, 'Customer P11', 'customer', $2, true) RETURNING id`,
      [orgId, `contact_p11_${suffix}@test.com`]
    );
    const contactId = contactRes.rows[0].id;

    const userRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id, contact_id)
       VALUES ($1, $2, 'hash', 'user', true, $3, $4) RETURNING id`,
      ['User P11', `user_p11_${suffix}@test.com`, orgId, contactId]
    );
    contactUserId = userRes.rows[0].id;

    // Sessions
    adminSid = authSession.createSession(adminId, 'admin', false).sessionId;
    managerSid = authSession.createSession(managerId, 'manager', false).sessionId;

    // JWT for user
    const authJwt = require('../src/auth/auth.jwt');
    userToken = authJwt.generateToken({
      id: contactUserId,
      role: 'user',
      token_version: 1,
    });

    // Seed master accounts and journals
    const seedClient = await pool.connect();
    try {
      await seedClient.query('BEGIN');
      await seedOrganizationMasterData(seedClient, orgId, adminId);
      await seedClient.query('COMMIT');
    } finally {
      seedClient.release();
    }

    // Analytic accounts
    const anRes1 = await pool.query(
      `INSERT INTO analytic_accounts (organization_id, name, analytic_type)
       VALUES ($1, 'Store Operations', 'expense') RETURNING id`,
      [orgId]
    );
    analyticDeptA = anRes1.rows[0].id;

    const anRes2 = await pool.query(
      `INSERT INTO analytic_accounts (organization_id, name, analytic_type)
       VALUES ($1, 'Online Revenue', 'income') RETURNING id`,
      [orgId]
    );
    analyticIncomeB = anRes2.rows[0].id;

    // Retrieve accounts
    const accRes = await pool.query(
      `SELECT id, code, account_type FROM accounts WHERE organization_id = $1`,
      [orgId]
    );
    bankAccount = accRes.rows.find((a) => a.code === '1020')?.id; // Bank
    salesIncomeAccount = accRes.rows.find((a) => a.code === '4010')?.id; // Sale Income
    expenseAccount = accRes.rows.find((a) => a.code === '5010')?.id; // Purchase Expense

    const jRes = await pool.query(
      `SELECT id FROM journals WHERE organization_id = $1 AND journal_type = 'sales'`,
      [orgId]
    );
    salesJournal = jRes.rows[0].id;

    // Post a real journal entry so we have non-zero ledger data
    const { withTransaction } = require('../src/shared/withTransaction');
    await withTransaction(async (txClient) => {
      await accountingService.postJournalEntry(txClient, {
        organizationId: orgId,
        journalId: salesJournal,
        entryDate: '2026-06-15',
        lines: [
          { account_id: bankAccount, debit: '10000.00', credit: '0.00', description: 'Receipt' },
          {
            account_id: salesIncomeAccount,
            debit: '0.00',
            credit: '10000.00',
            analytic_account_id: analyticIncomeB,
            description: 'Sales Income',
          },
        ],
        reference: 'TEST-SALES-1',
        actorUserId: adminId,
      });
    });
  });



  describe('Budget Management (/api/budgets)', () => {
    let createdBudgetId;

    it('creates a budget with valid planned amount and analytic account', async () => {
      const res = await asManager(
        request(app)
          .post('/api/budgets')
          .send({
            name: 'Q3 Store Budget',
            period_start: '2026-06-01',
            period_end: '2026-08-31',
            analytic_account_id: analyticDeptA,
            planned_amount: '50000.00',
          })
      );

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Q3 Store Budget');
      expect(res.body.data.planned_amount).toBe('50000.00');
      createdBudgetId = res.body.data.id;
    });

    it('rejects period_end < period_start', async () => {
      const res = await asAdmin(
        request(app)
          .post('/api/budgets')
          .send({
            name: 'Invalid Budget',
            period_start: '2026-09-30',
            period_end: '2026-09-01',
            analytic_account_id: analyticDeptA,
            planned_amount: '10000.00',
          })
      );

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.join(' ')).toContain('cannot be earlier');
    });

    it('lists budgets and includes dynamically computed actuals and variance', async () => {
      const res = await asManager(request(app).get('/api/budgets'));
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);

      const item = res.body.data.items.find((b) => b.id === createdBudgetId);
      expect(item).toBeDefined();
      expect(item.plannedAmount).toBe('50000.00');
      expect(item.actualAmount).toBe('0.00');
      expect(item.variance).toBe('50000.00');
    });

    it('handles planned_amount = 0 without division by zero', async () => {
      const res = await asAdmin(
        request(app)
          .post('/api/budgets')
          .send({
            name: 'Zero Planned Budget',
            period_start: '2026-01-01',
            period_end: '2026-12-31',
            analytic_account_id: analyticIncomeB,
            planned_amount: '0.00',
          })
      );

      expect(res.status).toBe(201);

      const listRes = await asAdmin(request(app).get('/api/budgets'));
      const zeroBudget = listRes.body.data.items.find((b) => b.id === res.body.data.id);
      expect(zeroBudget.variancePercent).toBe('0.00');
      expect(zeroBudget.consumptionPercent).toBe('0.00');
    });

    it('fetches budget detail with contributing lines array and monthly breakdown', async () => {
      const res = await asManager(request(app).get(`/api/budgets/${createdBudgetId}`));
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdBudgetId);
      expect(Array.isArray(res.body.data.contributingLines)).toBe(true);
      expect(Array.isArray(res.body.data.monthlyBreakdown)).toBe(true);
    });

    it('allows admin to modify a budget but rejects manager', async () => {
      const mgrEdit = await asManager(
        request(app)
          .patch(`/api/budgets/${createdBudgetId}`)
          .send({ planned_amount: '60000.00' })
      );
      expect(mgrEdit.status).toBe(403);

      const adminEdit = await asAdmin(
        request(app)
          .patch(`/api/budgets/${createdBudgetId}`)
          .send({ planned_amount: '60000.00' })
      );
      expect(adminEdit.status).toBe(200);
      expect(adminEdit.body.data.planned_amount).toBe('60000.00');
    });
  });

  describe('Financial Reports (/api/reports)', () => {
    it('generates real-time Balance Sheet and guarantees balance (Assets = Liabilities + Equity)', async () => {
      const res = await asManager(
        request(app).get('/api/reports/balance-sheet?asOfDate=2026-12-31')
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isBalanced).toBe(true);
      expect(res.body.data.discrepancy).toBe('0.00');
      expect(Number(res.body.data.assets.total)).toBeGreaterThan(0);
    });

    it('generates Profit & Loss report matching income minus expenses', async () => {
      const res = await asManager(
        request(app).get('/api/reports/profit-loss?fromDate=2026-01-01&toDate=2026-12-31')
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.income.total).toBe('10000.00');
      expect(res.body.data.netProfit).toBe('10000.00');
      expect(Array.isArray(res.body.data.trendSeries)).toBe(true);
      expect(Array.isArray(res.body.data.expenseBreakdown)).toBe(true);
    });

    it('generates Budget Report with grand summary and chartData', async () => {
      const res = await asManager(request(app).get('/api/reports/budget'));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(Array.isArray(res.body.data.chartData)).toBe(true);
    });

    it('exports Balance Sheet to valid CSV format', async () => {
      const res = await asAdmin(
        request(app).get('/api/reports/balance-sheet/export')
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('"Balance Sheet Statement');
      expect(res.text).toContain('"Total Assets"');
    });

    it('denies contact (role user) access to reports with 403', async () => {
      const res = await asUser(request(app).get('/api/reports/balance-sheet'));
      expect(res.status).toBe(403);
    });
  });
});
