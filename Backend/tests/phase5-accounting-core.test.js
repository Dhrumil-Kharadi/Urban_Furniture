const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/app');
const authSession = require('../src/auth/auth.session');
const { seedOrganizationMasterData } = require('../src/organizations/organizations.seed');

/**
 * Phase 5 — Accounting core (accounts, journals, taxes, analytic accounts).
 *
 * Integration tests against a live database. Two organizations, so every
 * tenancy claim is proven rather than assumed: Org B's admin is pointed at
 * Org A's records and must be told they do not exist.
 *
 * Run with:  npx jest tests/phase5-accounting-core.test.js --runInBand
 */

jest.setTimeout(30000);

const suffix = Date.now();

describe('Phase 5: Accounting core', () => {
  let orgA;
  let orgB;
  let adminA;
  let managerA;
  let adminB;
  let adminASid;
  let managerASid;
  let adminBSid;

  async function makeOrg(label) {
    const res = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Phase5 ${label} ${suffix}`, `phase5-${label.toLowerCase()}-${suffix}`]
    );
    return res.rows[0].id;
  }

  async function makeUser(organizationId, role, label) {
    const res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', $3, true, $4) RETURNING id`,
      [`Phase5 ${label}`, `phase5_${label}_${suffix}@example.com`, role, organizationId]
    );
    return res.rows[0].id;
  }

  beforeAll(async () => {
    orgA = await makeOrg('OrgA');
    orgB = await makeOrg('OrgB');

    adminA = await makeUser(orgA, 'business_owner', 'adminA');
    managerA = await makeUser(orgA, 'accountant', 'managerA');
    adminB = await makeUser(orgB, 'business_owner', 'adminB');

    // Seed both organizations so the system accounts and journals the posting
    // rules depend on actually exist.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await seedOrganizationMasterData(client, orgA, adminA);
      await seedOrganizationMasterData(client, orgB, adminB);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    adminASid = authSession.createSession(adminA, 'business_owner', false).sessionId;
    managerASid = authSession.createSession(managerA, 'accountant', false).sessionId;
    adminBSid = authSession.createSession(adminB, 'business_owner', false).sessionId;
  });

  afterAll(async () => {
    for (const orgId of [orgA, orgB].filter(Boolean)) {
      await pool.query('DELETE FROM audit_logs WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM document_sequences WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM products WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM product_categories WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM analytic_accounts WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM journals WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM taxes WHERE organization_id = $1', [orgId]);
      // Children first: accounts self-reference through parent_account_id.
      await pool.query(
        'DELETE FROM accounts WHERE organization_id = $1 AND parent_account_id IS NOT NULL',
        [orgId]
      );
      await pool.query('DELETE FROM accounts WHERE organization_id = $1', [orgId]);
      await pool.query('UPDATE users SET organization_id = NULL WHERE organization_id = $1', [orgId]);
      await pool.query('UPDATE organizations SET created_by = NULL, updated_by = NULL WHERE id = $1', [orgId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    }
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`phase5_%_${suffix}@example.com`]);
    await pool.end();
  });

  const asAdminA = (req) => req.set('Cookie', [`sid=${adminASid}`]);
  const asManagerA = (req) => req.set('Cookie', [`sid=${managerASid}`]);
  const asAdminB = (req) => req.set('Cookie', [`sid=${adminBSid}`]);

  /** Fetch a seeded system account by its code. */
  async function systemAccount(orgId, code) {
    const res = await pool.query(
      'SELECT id, name, account_type FROM accounts WHERE organization_id = $1 AND code = $2',
      [orgId, code]
    );
    return res.rows[0];
  }

  // ─────────────────────────────────────────────────────────────────────────
  describe('1. Chart of Accounts', () => {
    let assetParentId;
    let childId;

    test('the seeded chart is visible and marked as system', async () => {
      const res = await asAdminA(request(app).get('/api/accounts?limit=100'));

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(10);
      expect(res.body.data.items.every((a) => a.is_system === true)).toBe(true);
      expect(res.body.data.pagination).toEqual(
        expect.objectContaining({ total: 10, page: 1 })
      );
    });

    test('opening balance is returned as a string, not a number', async () => {
      const res = await asAdminA(request(app).get('/api/accounts?limit=1'));
      expect(typeof res.body.data.items[0].opening_balance).toBe('string');
    });

    test('admin creates a parent and a child of the same type', async () => {
      const parent = await asAdminA(request(app).post('/api/accounts')).send({
        code: `P-${suffix}`, name: 'Current Assets', account_type: 'asset',
      });
      expect(parent.status).toBe(201);
      assetParentId = parent.body.data.account.id;

      const child = await asAdminA(request(app).post('/api/accounts')).send({
        code: `C-${suffix}`,
        name: 'Petty Cash',
        account_type: 'asset',
        parent_account_id: assetParentId,
        opening_balance: '1500.75',
      });
      expect(child.status).toBe(201);
      expect(child.body.data.account.opening_balance).toBe('1500.75');
      expect(child.body.data.account.parent_account_name).toBe('Current Assets');
      childId = child.body.data.account.id;
    });

    test('a parent of a different type is rejected', async () => {
      const res = await asAdminA(request(app).post('/api/accounts')).send({
        code: `X-${suffix}`,
        name: 'Mismatched',
        account_type: 'income',
        parent_account_id: assetParentId,
      });
      expect(res.status).toBe(400);
    });

    test('a cycle is rejected — the ancestor chain is walked before saving', async () => {
      // Making the parent a child of its own child would close a loop and hang
      // any recursive walk of the tree.
      const res = await asAdminA(request(app).patch(`/api/accounts/${assetParentId}`))
        .send({ parent_account_id: childId });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/cycle/i);
    });

    test('an account cannot be its own parent', async () => {
      const res = await asAdminA(request(app).patch(`/api/accounts/${childId}`))
        .send({ parent_account_id: childId });
      expect(res.status).toBe(400);
    });

    test('a duplicate code within one organization is rejected, allowed across them', async () => {
      const duplicate = await asAdminA(request(app).post('/api/accounts')).send({
        code: `P-${suffix}`, name: 'Copycat', account_type: 'asset',
      });
      expect(duplicate.status).toBe(409);

      const otherOrg = await asAdminB(request(app).post('/api/accounts')).send({
        code: `P-${suffix}`, name: 'Org B Current Assets', account_type: 'asset',
      });
      expect(otherOrg.status).toBe(201);
    });

    test('a system account cannot be archived or retyped', async () => {
      const debtors = await systemAccount(orgA, '1030');

      const retype = await asAdminA(request(app).patch(`/api/accounts/${debtors.id}`))
        .send({ account_type: 'expense' });
      expect(retype.status).toBe(409);

      const archive = await asAdminA(request(app).patch(`/api/accounts/${debtors.id}/archive`));
      expect(archive.status).toBe(409);

      // And it genuinely did not move.
      const after = await systemAccount(orgA, '1030');
      expect(after.account_type).toBe('asset');
    });

    test('archiving is refused while a child still points at the account', async () => {
      const res = await asAdminA(request(app).patch(`/api/accounts/${assetParentId}/archive`));
      expect(res.status).toBe(409);
      expect(JSON.stringify(res.body)).toMatch(/accounts/);
    });

    test('the tree endpoint nests children under parents', async () => {
      const res = await asAdminA(request(app).get('/api/accounts/tree'));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.tree)).toBe(true);

      const parent = res.body.data.tree.find((n) => n.id === assetParentId);
      expect(parent).toBeDefined();
      expect(parent.children.map((c) => c.id)).toContain(childId);
    });

    test('manager can create but not modify or archive', async () => {
      const created = await asManagerA(request(app).post('/api/accounts')).send({
        code: `M-${suffix}`, name: 'Manager Account', account_type: 'expense',
      });
      expect(created.status).toBe(201);

      const modified = await asManagerA(
        request(app).patch(`/api/accounts/${created.body.data.account.id}`)
      ).send({ name: 'Renamed' });
      expect(modified.status).toBe(403);

      const archived = await asManagerA(
        request(app).patch(`/api/accounts/${created.body.data.account.id}/archive`)
      );
      expect(archived.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('2. Journals', () => {
    test('the four seeded journals are visible', async () => {
      const res = await asAdminA(request(app).get('/api/journals?limit=100'));

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(4);
      expect(res.body.data.items.map((j) => j.journal_type).sort()).toEqual(
        ['bank', 'cash', 'purchase', 'sales']
      );
    });

    test('default accounts are resolved by name in the same query', async () => {
      const res = await asAdminA(request(app).get('/api/journals?type=sales'));
      const sales = res.body.data.items[0];

      expect(sales.default_debit_account_name).toBe('Debtors');
      expect(sales.default_credit_account_name).toBe('Sale Income');
    });

    test("a default account from another organization is rejected", async () => {
      const orgBCash = await systemAccount(orgB, '1010');

      const res = await asAdminA(request(app).post('/api/journals')).send({
        name: `Cross Tenant ${suffix}`,
        journal_type: 'general',
        default_debit_account_id: orgBCash.id,
      });
      expect(res.status).toBe(400);
    });

    test('the only active journal of a required type cannot be archived', async () => {
      const list = await asAdminA(request(app).get('/api/journals?type=sales'));
      const sales = list.body.data.items[0];

      const res = await asAdminA(request(app).patch(`/api/journals/${sales.id}/archive`));
      expect(res.status).toBe(409);
      expect(JSON.stringify(res.body)).toMatch(/only active sales journal/i);
    });

    test('a second journal of the same type can then be archived', async () => {
      const second = await asAdminA(request(app).post('/api/journals')).send({
        name: `Second Sales ${suffix}`, journal_type: 'sales', sequence_prefix: 'inv2',
      });
      expect(second.status).toBe(201);
      expect(second.body.data.journal.sequence_prefix).toBe('INV2');

      const archived = await asAdminA(
        request(app).patch(`/api/journals/${second.body.data.journal.id}/archive`)
      );
      expect(archived.status).toBe(200);
      expect(archived.body.data.journal.status).toBe('archived');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('3. Taxes', () => {
    let taxId;

    test('a tax must point at a liability or an asset, never at income', async () => {
      const saleIncome = await systemAccount(orgA, '4010');
      expect(saleIncome.account_type).toBe('income');

      const rejected = await asAdminA(request(app).post('/api/taxes')).send({
        name: `Bad GST ${suffix}`, rate: '18', tax_account_id: saleIncome.id,
      });
      expect(rejected.status).toBe(400);
      expect(JSON.stringify(rejected.body)).toMatch(/liability|asset/i);
    });

    test('a tax posting to Output Tax Payable is accepted', async () => {
      const outputTax = await systemAccount(orgA, '2020');
      expect(outputTax.account_type).toBe('liability');

      const res = await asAdminA(request(app).post('/api/taxes')).send({
        name: `GST 18 ${suffix}`, rate: '18', tax_scope: 'sales', tax_account_id: outputTax.id,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.tax.rate).toBe('18.0000');
      expect(typeof res.body.data.tax.rate).toBe('string');
      expect(res.body.data.tax.tax_account_name).toBe('Output Tax Payable');
      taxId = res.body.data.tax.id;
    });

    test('an Input Tax Credit asset is also accepted', async () => {
      const inputTax = await systemAccount(orgA, '1040');
      expect(inputTax.account_type).toBe('asset');

      const res = await asAdminA(request(app).post('/api/taxes')).send({
        name: `Input GST 5 ${suffix}`, rate: '5', tax_scope: 'purchase', tax_account_id: inputTax.id,
      });
      expect(res.status).toBe(201);
    });

    test('a rate outside 0–100 is rejected', async () => {
      for (const rate of ['-1', '101']) {
        const res = await asAdminA(request(app).post('/api/taxes'))
          .send({ name: `Bad ${rate} ${suffix}`, rate });
        expect(res.status).toBe(400);
      }
    });

    test("scope 'sales' also returns taxes scoped to 'both'", async () => {
      const both = await asAdminA(request(app).post('/api/taxes'))
        .send({ name: `Both 12 ${suffix}`, rate: '12', tax_scope: 'both' });
      expect(both.status).toBe(201);

      const res = await asAdminA(request(app).get('/api/taxes?scope=sales&limit=100'));
      const names = res.body.data.items.map((t) => t.name);
      expect(names).toContain(`Both 12 ${suffix}`);
      expect(names).toContain(`GST 18 ${suffix}`);
      expect(names).not.toContain(`Input GST 5 ${suffix}`);
    });

    test('a duplicate name within one organization is rejected', async () => {
      const res = await asAdminA(request(app).post('/api/taxes'))
        .send({ name: `GST 18 ${suffix}`, rate: '18' });
      expect(res.status).toBe(409);
    });

    test('a tax referenced by a product cannot be archived', async () => {
      const product = await asAdminA(request(app).post('/api/products')).send({
        name: `Taxed Chair ${suffix}`, product_type: 'goods', sales_tax_id: taxId,
      });
      expect(product.status).toBe(201);

      const res = await asAdminA(request(app).patch(`/api/taxes/${taxId}/archive`));
      expect(res.status).toBe(409);
      expect(JSON.stringify(res.body)).toMatch(/products/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('4. Analytic accounts', () => {
    test('admin creates one with a department', async () => {
      const res = await asAdminA(request(app).post('/api/analytic-accounts')).send({
        code: `ahm-${suffix}`,
        name: `Retail Store - Ahmedabad ${suffix}`,
        analytic_type: 'income',
        department: 'Retail',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.analyticAccount.code).toBe(`AHM-${suffix}`.toUpperCase());
      expect(res.body.data.analyticAccount.department).toBe('Retail');
    });

    test('a duplicate name within one organization is rejected, allowed across them', async () => {
      const duplicate = await asAdminA(request(app).post('/api/analytic-accounts'))
        .send({ name: `Retail Store - Ahmedabad ${suffix}`, analytic_type: 'income' });
      expect(duplicate.status).toBe(409);

      const otherOrg = await asAdminB(request(app).post('/api/analytic-accounts'))
        .send({ name: `Retail Store - Ahmedabad ${suffix}`, analytic_type: 'income' });
      expect(otherOrg.status).toBe(201);
    });

    test('archive and restore round-trip', async () => {
      const created = await asAdminA(request(app).post('/api/analytic-accounts'))
        .send({ name: `Online Sales ${suffix}`, analytic_type: 'income' });
      const id = created.body.data.analyticAccount.id;

      const archived = await asAdminA(request(app).patch(`/api/analytic-accounts/${id}/archive`));
      expect(archived.status).toBe(200);
      expect(archived.body.data.analyticAccount.status).toBe('archived');

      const restored = await asAdminA(request(app).patch(`/api/analytic-accounts/${id}/unarchive`));
      expect(restored.status).toBe(200);
      expect(restored.body.data.analyticAccount.status).toBe('active');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('5. Cross-tenant isolation on every endpoint', () => {
    let accountA;
    let journalA;
    let taxA;
    let analyticA;

    beforeAll(async () => {
      const acc = await asAdminA(request(app).post('/api/accounts'))
        .send({ code: `PROBE-${suffix}`, name: 'Probe Account', account_type: 'expense' });
      accountA = acc.body.data.account.id;

      const jr = await asAdminA(request(app).get('/api/journals?type=cash'));
      journalA = jr.body.data.items[0].id;

      const tx = await asAdminA(request(app).post('/api/taxes'))
        .send({ name: `Probe Tax ${suffix}`, rate: '9' });
      taxA = tx.body.data.tax.id;

      const an = await asAdminA(request(app).post('/api/analytic-accounts'))
        .send({ name: `Probe Analytic ${suffix}`, analytic_type: 'expense' });
      analyticA = an.body.data.analyticAccount.id;
    });

    test("Org B's lists contain none of Org A's records", async () => {
      for (const path of ['/api/accounts', '/api/journals', '/api/taxes', '/api/analytic-accounts']) {
        const res = await asAdminB(request(app).get(`${path}?limit=100`));
        expect(res.status).toBe(200);
        expect(res.body.data.items.every((r) => r.organization_id === orgB)).toBe(true);
      }
    });

    test('a cross-tenant id returns 404, never 403 — a 403 would confirm it exists', async () => {
      const probes = [
        ['get', `/api/accounts/${accountA}`],
        ['patch', `/api/accounts/${accountA}`],
        ['patch', `/api/accounts/${accountA}/archive`],
        ['patch', `/api/accounts/${accountA}/unarchive`],
        ['get', `/api/journals/${journalA}`],
        ['patch', `/api/journals/${journalA}`],
        ['patch', `/api/journals/${journalA}/archive`],
        ['patch', `/api/journals/${journalA}/unarchive`],
        ['get', `/api/taxes/${taxA}`],
        ['patch', `/api/taxes/${taxA}`],
        ['patch', `/api/taxes/${taxA}/archive`],
        ['patch', `/api/taxes/${taxA}/unarchive`],
        ['get', `/api/analytic-accounts/${analyticA}`],
        ['patch', `/api/analytic-accounts/${analyticA}`],
        ['patch', `/api/analytic-accounts/${analyticA}/archive`],
        ['patch', `/api/analytic-accounts/${analyticA}/unarchive`],
      ];

      for (const [method, path] of probes) {
        const res = await asAdminB(request(app)[method](path))
          .send({ name: 'Hijacked', rate: '1' });

        expect({ path, status: res.status }).toEqual({ path, status: 404 });
      }
    });

    test('organization_id in the request body is ignored', async () => {
      const res = await asAdminA(request(app).post('/api/analytic-accounts')).send({
        name: `Body Injection ${suffix}`,
        analytic_type: 'income',
        organization_id: orgB,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.analyticAccount.organization_id).toBe(orgA);
    });

    test('every endpoint requires authentication', async () => {
      for (const path of ['/api/accounts', '/api/accounts/tree', '/api/journals', '/api/taxes', '/api/analytic-accounts']) {
        const res = await request(app).get(path);
        expect(res.status).toBe(401);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('6. sortBy allow-list at the HTTP boundary', () => {
    test('an injection attempt in sortBy is ignored, not executed', async () => {
      const res = await asAdminA(
        request(app).get('/api/accounts?sortBy=code;DROP%20TABLE%20accounts--')
      );
      expect(res.status).toBe(200);

      const stillThere = await pool.query("SELECT to_regclass('public.accounts') AS reg");
      expect(stillThere.rows[0].reg).toBe('accounts');
    });
  });
});
