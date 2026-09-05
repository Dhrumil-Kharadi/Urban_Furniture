const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/app');
const { resolveTenant } = require('../src/shared/tenant.middleware');
const {
  validateUpdateOrganization,
  validateCreateOrganization,
} = require('../src/organizations/organizations.validation');
const organizationsService = require('../src/organizations/organizations.service');
const organizationsRepository = require('../src/organizations/organizations.repository');
const authSession = require('../src/auth/auth.session');

describe('Phase 1: Multi-Tenancy Foundation & Organizations Module', () => {
  let testOrgId;
  let adminUserId;
  let managerUserId;
  let adminSessionId;
  let managerSessionId;
  let userWithoutOrgId;
  let userWithoutOrgSessionId;

  beforeAll(async () => {
    // Create test organization
    const orgRes = await pool.query(`
      INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
      VALUES ($1, $2, $3, $4)
      RETURNING id, slug;
    `, ['Test Urban Furnishings', `test-org-${Date.now()}`, 'INR', 4]);
    testOrgId = orgRes.rows[0].id;

    // Create test admin with organization
    const adminRes = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, role, organization_id;
    `, ['Phase1 Admin', `admin_${Date.now()}@example.com`, 'hash', 'admin', true, testOrgId]);
    adminUserId = adminRes.rows[0].id;
    const adminSession = authSession.createSession(adminUserId, 'admin', false);
    adminSessionId = adminSession.sessionId;

    // Create test manager (accountant) with organization
    const managerRes = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, role, organization_id;
    `, ['Phase1 Manager', `manager_${Date.now()}@example.com`, 'hash', 'manager', true, testOrgId]);
    managerUserId = managerRes.rows[0].id;
    const managerSession = authSession.createSession(managerUserId, 'manager', false);
    managerSessionId = managerSession.sessionId;

    // Create test user with NO organization
    const noOrgRes = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, role, organization_id;
    `, ['Phase1 NoOrg', `noorg_${Date.now()}@example.com`, 'hash', 'admin', true, null]);
    userWithoutOrgId = noOrgRes.rows[0].id;
    const noOrgSession = authSession.createSession(userWithoutOrgId, 'admin', false);
    userWithoutOrgSessionId = noOrgSession.sessionId;
  });

  afterAll(async () => {
    // Clean up test records (nullify foreign keys to break circular dependencies)
    if (testOrgId) {
      await pool.query('UPDATE users SET organization_id = NULL WHERE id IN ($1, $2, $3)', [adminUserId, managerUserId, userWithoutOrgId]);
      await pool.query('UPDATE organizations SET created_by = NULL, updated_by = NULL WHERE id = $1', [testOrgId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
    }
    if (adminUserId) await pool.query('DELETE FROM users WHERE id = $1', [adminUserId]);
    if (managerUserId) await pool.query('DELETE FROM users WHERE id = $1', [managerUserId]);
    if (userWithoutOrgId) await pool.query('DELETE FROM users WHERE id = $1', [userWithoutOrgId]);
    await pool.end();
  });

  describe('1. Migration Idempotency & Down Reversibility', () => {
    test('Migrations 006 and 007 applied and columns exist', async () => {
      const orgCols = await pool.query(`
        SELECT column_name
          FROM information_schema.columns
         WHERE table_name = 'organizations';
      `);
      const orgColumnNames = orgCols.rows.map(r => r.column_name);
      expect(orgColumnNames).toContain('id');
      expect(orgColumnNames).toContain('name');
      expect(orgColumnNames).toContain('slug');
      expect(orgColumnNames).toContain('currency_code');
      expect(orgColumnNames).toContain('fiscal_year_start_month');
      expect(orgColumnNames).toContain('status');

      const userCols = await pool.query(`
        SELECT column_name
          FROM information_schema.columns
         WHERE table_name = 'users';
      `);
      const userColumnNames = userCols.rows.map(r => r.column_name);
      expect(userColumnNames).toContain('organization_id');
      expect(userColumnNames).toContain('contact_id');
      expect(userColumnNames).toContain('must_change_password');
    });

    test('Down migrations reverse cleanly and Up re-applies cleanly', async () => {
      const mig007 = require('../src/database/migrations/007_add_organization_to_users');
      const mig006 = require('../src/database/migrations/006_create_organizations');

      // Test reverse on dedicated client transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Execute down 007 then down 006
        await client.query(mig007.down);
        await client.query(mig006.down);

        // Verify organizations table is dropped
        const checkOrg = await client.query(`
          SELECT table_name FROM information_schema.tables WHERE table_name = 'organizations';
        `);
        expect(checkOrg.rows.length).toBe(0);

        // Verify organization_id column on users is dropped
        const checkCol = await client.query(`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'organization_id';
        `);
        expect(checkCol.rows.length).toBe(0);

        // Re-apply up 006 and up 007
        await client.query(mig006.up);
        await client.query(mig007.up);

        // Verify restored
        const restoredOrg = await client.query(`
          SELECT table_name FROM information_schema.tables WHERE table_name = 'organizations';
        `);
        expect(restoredOrg.rows.length).toBe(1);

        // Rollback so the test isolation remains intact
        await client.query('ROLLBACK');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    });
  });

  describe('2. Slug Generation & Collision Suffixing', () => {
    test('slugify cleans names and removes special chars', () => {
      expect(organizationsService.slugify('Urban Furniture & Co.')).toBe('urban-furniture-co');
      expect(organizationsService.slugify('  Spaced  Out  ')).toBe('spaced-out');
      expect(organizationsService.slugify('---hello---')).toBe('hello');
      expect(organizationsService.slugify('!@#$%^')).toBe('organization');
    });

    test('resolveUniqueSlug appends -2, -3 on collisions', async () => {
      const uniqueBase = `test-coll-${Date.now()}`;

      // Mock repository call
      const findSpy = jest.spyOn(organizationsRepository, 'findSlugsStartingWith');
      findSpy.mockResolvedValueOnce([uniqueBase, `${uniqueBase}-2`]);

      const resolved = await organizationsService.resolveUniqueSlug(null, uniqueBase);
      expect(resolved).toBe(`${uniqueBase}-3`);

      findSpy.mockRestore();
    });
  });

  describe('3. resolveTenant Middleware', () => {
    test('Sets req.organizationId strictly from req.user.organization_id', () => {
      const req = { user: { id: 'u1', organization_id: 'org-uuid-123' } };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      resolveTenant(req, res, next);
      expect(req.organizationId).toBe('org-uuid-123');
      expect(nextCalled).toBe(true);
    });

    test('Refuses user with missing organization_id with 403', () => {
      const req = { user: { id: 'u1' } };
      let responseStatus = null;
      let responseBody = null;
      const res = {
        status(code) { responseStatus = code; return this; },
        json(data) { responseBody = data; return this; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      resolveTenant(req, res, next);
      expect(nextCalled).toBe(false);
      expect(responseStatus).toBe(403);
      expect(responseBody.success).toBe(false);
      expect(responseBody.message).toBe('No organization context for this account');
    });
  });

  describe('4. Security: Body Stripping of organization_id', () => {
    test('validateUpdateOrganization strips organization_id and id from body', () => {
      const maliciousPayload = {
        organization_id: 'malicious-org-id',
        id: 'malicious-id',
        name: 'Safe Name',
        currency: 'INR',
        fiscalYearStartMonth: 4,
      };

      const result = validateUpdateOrganization(maliciousPayload);
      expect(result.isValid).toBe(true);
      expect(result.data.organization_id).toBeUndefined();
      expect(result.data.id).toBeUndefined();
      expect(result.data.name).toBe('Safe Name');
      expect(result.data.currency_code).toBe('INR');
      expect(result.data.fiscal_year_start_month).toBe(4);
    });

    test('validateCreateOrganization strips organization_id from body', () => {
      const payload = {
        organization_id: 'should-be-removed',
        name: 'New Tenant Org',
      };
      const result = validateCreateOrganization(payload);
      expect(result.isValid).toBe(true);
      expect(result.data.organization_id).toBeUndefined();
      expect(result.data.name).toBe('New Tenant Org');
    });
  });

  describe('5. Organizations Endpoints (/api/organizations/current)', () => {
    test('GET /api/organizations/current without auth returns 401', async () => {
      const res = await request(app).get('/api/organizations/current');
      expect(res.status).toBe(401);
    });

    test('GET /api/organizations/current with user lacking organization_id returns 403', async () => {
      const res = await request(app)
        .get('/api/organizations/current')
        .set('Cookie', [`sid=${userWithoutOrgSessionId}`]);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('No organization context for this account');
    });

    test('GET /api/organizations/current with manager returns 200 with org details', async () => {
      const res = await request(app)
        .get('/api/organizations/current')
        .set('Cookie', [`sid=${managerSessionId}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testOrgId);
      expect(res.body.data.currency_code).toBe('INR');
    });

    test('PATCH /api/organizations/current as manager returns 403 (Admin only)', async () => {
      const res = await request(app)
        .patch('/api/organizations/current')
        .set('Cookie', [`sid=${managerSessionId}`])
        .send({ name: 'Manager Attempted Update' });

      expect(res.status).toBe(403);
    });

    test('PATCH /api/organizations/current as admin updates org and ignores injected organization_id', async () => {
      const res = await request(app)
        .patch('/api/organizations/current')
        .set('Cookie', [`sid=${adminSessionId}`])
        .send({
          organization_id: '00000000-0000-0000-0000-000000000000',
          name: 'Updated Urban Furniture Name',
          fiscalYearStartMonth: 4,
          currency: 'INR',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testOrgId);
      expect(res.body.data.name).toBe('Updated Urban Furniture Name');
      expect(res.body.data.fiscal_year_start_month).toBe(4);
    });
  });
});
