const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/app');
const authSession = require('../src/auth/auth.session');

jest.setTimeout(30000);

describe('Phase 5: Master Data A — Accounting Core Integration & Security Suite', () => {
  const ts = Date.now();

  let orgAId, orgBId;
  let adminAId, adminASessionId;
  let managerAId, managerASessionId;
  let adminBId, adminBSessionId;

  let liabilityAccId, assetAccId, expenseAccId;

  beforeAll(async () => {
    // 1. Create Org A
    const orgARes = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Org A ${ts}`, `org-a-${ts}`]
    );
    orgAId = orgARes.rows[0].id;

    // Create Org A Admin
    const adminARes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', 'admin', true, $3) RETURNING id`,
      ['Admin A', `admin_a_${ts}@example.com`, orgAId]
    );
    adminAId = adminARes.rows[0].id;
    adminASessionId = authSession.createSession(adminAId, 'admin', false).sessionId;

    // Create Org A Manager (Accountant)
    const managerARes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', 'manager', true, $3) RETURNING id`,
      ['Manager A', `manager_a_${ts}@example.com`, orgAId]
    );
    managerAId = managerARes.rows[0].id;
    managerASessionId = authSession.createSession(managerAId, 'manager', false).sessionId;

    // 2. Create Org B
    const orgBRes = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Org B ${ts}`, `org-b-${ts}`]
    );
    orgBId = orgBRes.rows[0].id;

    // Create Org B Admin
    const adminBRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', 'admin', true, $3) RETURNING id`,
      ['Admin B', `admin_b_${ts}@example.com`, orgBId]
    );
    adminBId = adminBRes.rows[0].id;
    adminBSessionId = authSession.createSession(adminBId, 'admin', false).sessionId;

    // 3. Seed basic accounts in Org A for testing relationships
    const lRes = await pool.query(
      `INSERT INTO accounts (organization_id, code, name, account_type, is_system, status)
       VALUES ($1, '2000', 'Test Output Tax Liability', 'liability', false, 'active') RETURNING id`,
      [orgAId]
    );
    liabilityAccId = lRes.rows[0].id;

    const aRes = await pool.query(
      `INSERT INTO accounts (organization_id, code, name, account_type, is_system, status)
       VALUES ($1, '1000', 'Test Input Tax Asset', 'asset', false, 'active') RETURNING id`,
      [orgAId]
    );
    assetAccId = aRes.rows[0].id;

    const eRes = await pool.query(
      `INSERT INTO accounts (organization_id, code, name, account_type, is_system, status)
       VALUES ($1, '5000', 'Test General Expense', 'expense', false, 'active') RETURNING id`,
      [orgAId]
    );
    expenseAccId = eRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    for (const orgId of [orgAId, orgBId]) {
      if (orgId) {
        await pool.query('DELETE FROM taxes WHERE organization_id = $1', [orgId]);
        await pool.query('DELETE FROM journals WHERE organization_id = $1', [orgId]);
        await pool.query('DELETE FROM analytic_accounts WHERE organization_id = $1', [orgId]);
        await pool.query('DELETE FROM accounts WHERE organization_id = $1', [orgId]);
        await pool.query('DELETE FROM users WHERE organization_id = $1', [orgId]);
        await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
      }
    }
    await pool.end();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CHART OF ACCOUNTS (CoA) TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Chart of Accounts (/api/accounts)', () => {
    let createdAccId;
    let parentAccId;

    test('Admin creates parent account successfully', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          code: '1100',
          name: 'Current Assets Parent',
          account_type: 'asset',
          opening_balance: '1500.50',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('1100');
      expect(res.body.data.account_type).toBe('asset');
      expect(res.body.data.is_system).toBe(false);
      parentAccId = res.body.data.id;
    });

    test('Manager (Accountant) can also create a child account', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Cookie', [`sid=${managerASessionId}`])
        .send({
          code: '1110',
          name: 'Petty Cash Child',
          account_type: 'asset',
          parent_account_id: parentAccId,
          opening_balance: '250.00',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.parent_account_id).toBe(parentAccId);
      createdAccId = res.body.data.id;
    });

    test('Reject parent account with DIFFERENT account_type', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          code: '5110',
          name: 'Mismatched Child',
          account_type: 'expense',
          parent_account_id: parentAccId, // parent is 'asset'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Parent account must share the same account type/i);
    });

    test('Reject circular reference / ancestor cycle', async () => {
      // Trying to make parentAccId child of its own child createdAccId
      const res = await request(app)
        .patch(`/api/accounts/${parentAccId}`)
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          parent_account_id: createdAccId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/circular reference/i);
    });

    test('Reject setting account as its own parent', async () => {
      const res = await request(app)
        .patch(`/api/accounts/${parentAccId}`)
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          parent_account_id: parentAccId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot be its own parent/i);
    });

    test('System accounts CANNOT be archived or retyped', async () => {
      // Seed a system account
      const sysRes = await pool.query(
        `INSERT INTO accounts (organization_id, code, name, account_type, is_system, status)
         VALUES ($1, '3000', 'System Retained Earnings', 'capital', true, 'active') RETURNING id`,
        [orgAId]
      );
      const sysId = sysRes.rows[0].id;

      // Attempt to retype
      const retypeRes = await request(app)
        .patch(`/api/accounts/${sysId}`)
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({ account_type: 'expense' });

      expect(retypeRes.status).toBe(400);
      expect(retypeRes.body.message).toMatch(/System account type cannot be changed/i);

      // Attempt to archive
      const archiveRes = await request(app)
        .patch(`/api/accounts/${sysId}/archive`)
        .set('Cookie', [`sid=${adminASessionId}`]);

      expect(archiveRes.status).toBe(400);
      expect(archiveRes.body.message).toMatch(/System accounts cannot be archived/i);
    });

    test('Duplicate code in same org is rejected; allowed in different org', async () => {
      // In same Org A
      const dupRes = await request(app)
        .post('/api/accounts')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          code: '1100', // already used
          name: 'Duplicate Code Test',
          account_type: 'asset',
        });
      expect(dupRes.status).toBe(409);

      // In Org B: same code '1100' is allowed!
      const orgBAccRes = await request(app)
        .post('/api/accounts')
        .set('Cookie', [`sid=${adminBSessionId}`])
        .send({
          code: '1100',
          name: 'Org B Code 1100',
          account_type: 'asset',
        });
      expect(orgBAccRes.status).toBe(201);
    });

    test('GET /api/accounts/tree returns hierarchical structure', async () => {
      const res = await request(app)
        .get('/api/accounts/tree')
        .set('Cookie', [`sid=${adminASessionId}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      // Find parentAccId in roots
      const parentNode = res.body.data.find((n) => n.id === parentAccId);
      expect(parentNode).toBeDefined();
      expect(parentNode.children.some((c) => c.id === createdAccId)).toBe(true);
    });

    test('Manager CANNOT modify or archive account (403 Forbidden)', async () => {
      const editRes = await request(app)
        .patch(`/api/accounts/${createdAccId}`)
        .set('Cookie', [`sid=${managerASessionId}`])
        .send({ name: 'Hacked Name' });
      expect(editRes.status).toBe(403);

      const archiveRes = await request(app)
        .patch(`/api/accounts/${createdAccId}/archive`)
        .set('Cookie', [`sid=${managerASessionId}`]);
      expect(archiveRes.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. JOURNALS (/api/journals) TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Journals (/api/journals)', () => {
    let createdJournalId;

    test('Admin creates journal with default accounts', async () => {
      const res = await request(app)
        .post('/api/journals')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          name: 'Furniture Sales Journal',
          journal_type: 'sales',
          sequence_prefix: 'FSJ',
          default_debit_account_id: assetAccId,
          default_credit_account_id: liabilityAccId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Furniture Sales Journal');
      expect(res.body.data.journal_type).toBe('sales');
      expect(res.body.data.sequence_prefix).toBe('FSJ');
      createdJournalId = res.body.data.id;
    });

    test('Manager can also create a journal', async () => {
      const res = await request(app)
        .post('/api/journals')
        .set('Cookie', [`sid=${managerASessionId}`])
        .send({
          name: 'Office Petty Cash',
          journal_type: 'cash',
          sequence_prefix: 'PC',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('Reject journal with cross-tenant default account (404 Not Found)', async () => {
      // Org B admin trying to use Org A's asset account
      const res = await request(app)
        .post('/api/journals')
        .set('Cookie', [`sid=${adminBSessionId}`])
        .send({
          name: 'Org B Cross-Tenant Journal',
          journal_type: 'general',
          default_debit_account_id: assetAccId,
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/does not exist in this organization/i);
    });

    test('Manager CANNOT modify or archive journal (403 Forbidden)', async () => {
      const editRes = await request(app)
        .patch(`/api/journals/${createdJournalId}`)
        .set('Cookie', [`sid=${managerASessionId}`])
        .send({ name: 'Manager Renamed' });
      expect(editRes.status).toBe(403);

      const archiveRes = await request(app)
        .patch(`/api/journals/${createdJournalId}/archive`)
        .set('Cookie', [`sid=${managerASessionId}`]);
      expect(archiveRes.status).toBe(403);
    });

    test('Admin can update and archive/unarchive journal', async () => {
      const updateRes = await request(app)
        .patch(`/api/journals/${createdJournalId}`)
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({ name: 'Furniture Sales Journal Renamed' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Furniture Sales Journal Renamed');

      const archiveRes = await request(app)
        .patch(`/api/journals/${createdJournalId}/archive`)
        .set('Cookie', [`sid=${adminASessionId}`]);
      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.data.status).toBe('archived');

      const unarchiveRes = await request(app)
        .patch(`/api/journals/${createdJournalId}/unarchive`)
        .set('Cookie', [`sid=${adminASessionId}`]);
      expect(unarchiveRes.status).toBe(200);
      expect(unarchiveRes.body.data.status).toBe('active');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TAXES (/api/taxes) TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Taxes (/api/taxes)', () => {
    let createdTaxId;

    test('Admin creates tax with valid accounts and rate', async () => {
      const res = await request(app)
        .post('/api/taxes')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          name: 'GST 18%',
          rate: '18.0000',
          tax_scope: 'both',
          computation: 'percentage',
          collected_account_id: liabilityAccId, // Output Tax = Liability
          paid_account_id: assetAccId,          // Input Tax = Asset
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('GST 18%');
      expect(res.body.data.rate).toBe('18.0000');
      expect(res.body.data.tax_scope).toBe('both');
      createdTaxId = res.body.data.id;
    });

    test('Reject tax rate outside 0–100', async () => {
      const resNeg = await request(app)
        .post('/api/taxes')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          name: 'Invalid Negative Tax',
          rate: '-5',
        });
      expect(resNeg.status).toBe(400);

      const resOver = await request(app)
        .post('/api/taxes')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          name: 'Invalid Over Tax',
          rate: '105',
        });
      expect(resOver.status).toBe(400);
    });

    test('Reject misconfigured tax accounts (collected must be liability, paid must be asset)', async () => {
      // Trying to assign expense account as collected (output tax)
      const resLiabilityCheck = await request(app)
        .post('/api/taxes')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          name: 'Misconfigured Tax 1',
          rate: '10',
          collected_account_id: expenseAccId,
        });
      expect(resLiabilityCheck.status).toBe(400);
      expect(resLiabilityCheck.body.message).toMatch(/must have account classification "liability"/i);

      // Trying to assign liability account as paid (input tax)
      const resAssetCheck = await request(app)
        .post('/api/taxes')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          name: 'Misconfigured Tax 2',
          rate: '10',
          paid_account_id: liabilityAccId,
        });
      expect(resAssetCheck.status).toBe(400);
      expect(resAssetCheck.body.message).toMatch(/must have account classification "asset"/i);
    });

    test('Manager can create tax but CANNOT modify or archive (403 Forbidden)', async () => {
      const createRes = await request(app)
        .post('/api/taxes')
        .set('Cookie', [`sid=${managerASessionId}`])
        .send({
          name: 'GST 5%',
          rate: '5.0000',
          tax_scope: 'sales',
        });
      expect(createRes.status).toBe(201);

      const editRes = await request(app)
        .patch(`/api/taxes/${createdTaxId}`)
        .set('Cookie', [`sid=${managerASessionId}`])
        .send({ rate: '12.0000' });
      expect(editRes.status).toBe(403);

      const archiveRes = await request(app)
        .patch(`/api/taxes/${createdTaxId}/archive`)
        .set('Cookie', [`sid=${managerASessionId}`]);
      expect(archiveRes.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ANALYTIC ACCOUNTS (/api/analytic-accounts) TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Analytic Accounts (/api/analytic-accounts)', () => {
    let createdAnalyticId;

    test('Admin creates analytic account successfully', async () => {
      const res = await request(app)
        .post('/api/analytic-accounts')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          name: 'Retail Store - Ahmedabad',
          code: 'AHM-01',
          analytic_type: 'expense',
          department_or_project: 'Retail Operations',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Retail Store - Ahmedabad');
      expect(res.body.data.analytic_type).toBe('expense');
      createdAnalyticId = res.body.data.id;
    });

    test('Manager can create analytic account', async () => {
      const res = await request(app)
        .post('/api/analytic-accounts')
        .set('Cookie', [`sid=${managerASessionId}`])
        .send({
          name: 'Online Marketing Campaign',
          analytic_type: 'expense',
          department_or_project: 'Marketing',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('Reject invalid analytic_type', async () => {
      const res = await request(app)
        .post('/api/analytic-accounts')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          name: 'Invalid Type Center',
          analytic_type: 'liability',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Analytic type must be one of: income, expense/i);
    });

    test('Reject duplicate name within same organization', async () => {
      const res = await request(app)
        .post('/api/analytic-accounts')
        .set('Cookie', [`sid=${adminASessionId}`])
        .send({
          name: 'Retail Store - Ahmedabad',
          analytic_type: 'income',
        });

      expect(res.status).toBe(409);
    });

    test('Manager CANNOT modify or archive analytic account (403 Forbidden)', async () => {
      const editRes = await request(app)
        .patch(`/api/analytic-accounts/${createdAnalyticId}`)
        .set('Cookie', [`sid=${managerASessionId}`])
        .send({ name: 'Hacked Analytic' });
      expect(editRes.status).toBe(403);

      const archiveRes = await request(app)
        .patch(`/api/analytic-accounts/${createdAnalyticId}/archive`)
        .set('Cookie', [`sid=${managerASessionId}`]);
      expect(archiveRes.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. MULTI-TENANCY & CROSS-TENANT ISOLATION (404 NOT 403)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Multi-Tenancy & Cross-Tenant Isolation', () => {
    let orgAAccId, orgAJnlId, orgATaxId, orgAAnlId;

    beforeAll(async () => {
      const a = await pool.query(
        `INSERT INTO accounts (organization_id, code, name, account_type) VALUES ($1, '9999', 'Iso Acc', 'asset') RETURNING id`,
        [orgAId]
      );
      orgAAccId = a.rows[0].id;

      const j = await pool.query(
        `INSERT INTO journals (organization_id, name, journal_type) VALUES ($1, 'Iso Jnl', 'general') RETURNING id`,
        [orgAId]
      );
      orgAJnlId = j.rows[0].id;

      const t = await pool.query(
        `INSERT INTO taxes (organization_id, name, rate, tax_scope) VALUES ($1, 'Iso Tax', 12, 'both') RETURNING id`,
        [orgAId]
      );
      orgATaxId = t.rows[0].id;

      const an = await pool.query(
        `INSERT INTO analytic_accounts (organization_id, name, analytic_type) VALUES ($1, 'Iso Anl', 'income') RETURNING id`,
        [orgAId]
      );
      orgAAnlId = an.rows[0].id;
    });

    test('Cross-tenant GET returns 404 Not Found (Zero Leakage)', async () => {
      // Org B Admin requesting Org A's records
      const accRes = await request(app).get(`/api/accounts/${orgAAccId}`).set('Cookie', [`sid=${adminBSessionId}`]);
      expect(accRes.status).toBe(404);

      const jnlRes = await request(app).get(`/api/journals/${orgAJnlId}`).set('Cookie', [`sid=${adminBSessionId}`]);
      expect(jnlRes.status).toBe(404);

      const taxRes = await request(app).get(`/api/taxes/${orgATaxId}`).set('Cookie', [`sid=${adminBSessionId}`]);
      expect(taxRes.status).toBe(404);

      const anlRes = await request(app).get(`/api/analytic-accounts/${orgAAnlId}`).set('Cookie', [`sid=${adminBSessionId}`]);
      expect(anlRes.status).toBe(404);
    });

    test('Cross-tenant PATCH returns 404 Not Found', async () => {
      const accRes = await request(app)
        .patch(`/api/accounts/${orgAAccId}`)
        .set('Cookie', [`sid=${adminBSessionId}`])
        .send({ name: 'Hacked' });
      expect(accRes.status).toBe(404);

      const jnlRes = await request(app)
        .patch(`/api/journals/${orgAJnlId}`)
        .set('Cookie', [`sid=${adminBSessionId}`])
        .send({ name: 'Hacked' });
      expect(jnlRes.status).toBe(404);
    });

    test('Cross-tenant archive returns 404 Not Found', async () => {
      const taxRes = await request(app)
        .patch(`/api/taxes/${orgATaxId}/archive`)
        .set('Cookie', [`sid=${adminBSessionId}`]);
      expect(taxRes.status).toBe(404);

      const anlRes = await request(app)
        .patch(`/api/analytic-accounts/${orgAAnlId}/archive`)
        .set('Cookie', [`sid=${adminBSessionId}`]);
      expect(anlRes.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. SQL INJECTION DEFENSE & SORTBY ALLOW-LIST
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6. SQL Injection Defense & SortBy Allow-List', () => {
    test('Malicious sortBy is neutralized and falls back to default column safely', async () => {
      const injectionSort = "code; DROP TABLE accounts; --";
      const res = await request(app)
        .get(`/api/accounts?sortBy=${encodeURIComponent(injectionSort)}`)
        .set('Cookie', [`sid=${adminASessionId}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);

      // Verify accounts table is still intact
      const verifyRes = await pool.query('SELECT COUNT(*)::int AS count FROM accounts');
      expect(verifyRes.rows[0].count).toBeGreaterThan(0);
    });

    test('Standard list contract pagination parameters are respected', async () => {
      const res = await request(app)
        .get('/api/accounts?page=1&limit=5&sortBy=name&sortOrder=desc')
        .set('Cookie', [`sid=${adminASessionId}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(5);
    });
  });
});
