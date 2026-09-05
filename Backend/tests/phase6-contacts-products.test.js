const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/app');
const authSession = require('../src/auth/auth.session');
const authJwt = require('../src/auth/auth.jwt');
const authEmail = require('../src/auth/auth.email');
const contactsRepository = require('../src/contacts/contacts.repository');

/**
 * Phase 6 — Contacts, Products, Categories and portal provisioning.
 *
 * Integration tests against a live database. Two organizations are created so
 * every tenancy claim is proven rather than assumed: for each endpoint, Org B's
 * admin is pointed at Org A's record and must be told it does not exist.
 *
 * Run with:  npx jest tests/phase6-contacts-products.test.js --runInBand
 */

jest.setTimeout(30000);

const suffix = Date.now();

/** A minimal but genuine PNG: real signature, real bytes. */
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(256),
]);

describe('Phase 6: Contacts, Products & Portal Provisioning', () => {
  let orgA;
  let orgB;
  let adminA;
  let managerA;
  let adminB;
  let adminASid;
  let managerASid;
  let adminBSid;

  const createdContactIds = [];
  const createdProductIds = [];
  const createdCategoryIds = [];

  /** Create an organization and return its id. */
  async function makeOrg(label) {
    const res = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Phase6 ${label} ${suffix}`, `phase6-${label.toLowerCase()}-${suffix}`]
    );
    return res.rows[0].id;
  }

  /** Create a verified user in an organization and return its id. */
  async function makeUser(organizationId, role, label) {
    const res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', $3, true, $4) RETURNING id`,
      [`Phase6 ${label}`, `phase6_${label}_${suffix}@example.com`, role, organizationId]
    );
    return res.rows[0].id;
  }

  beforeAll(async () => {
    // Outbound mail is not under test; a real send would make the suite depend
    // on an SMTP server being reachable.
    jest.spyOn(authEmail, 'sendInviteEmail').mockResolvedValue(true);

    orgA = await makeOrg('OrgA');
    orgB = await makeOrg('OrgB');

    adminA = await makeUser(orgA, 'business_owner', 'adminA');
    managerA = await makeUser(orgA, 'accountant', 'managerA');
    adminB = await makeUser(orgB, 'business_owner', 'adminB');

    adminASid = authSession.createSession(adminA, 'business_owner', false).sessionId;
    managerASid = authSession.createSession(managerA, 'accountant', false).sessionId;
    adminBSid = authSession.createSession(adminB, 'business_owner', false).sessionId;
  });

  afterAll(async () => {
    for (const orgId of [orgA, orgB].filter(Boolean)) {
      await pool.query(
        'DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)',
        [orgId]
      );
      await pool.query(
        'DELETE FROM otp_verifications WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)',
        [orgId]
      );
      await pool.query('DELETE FROM audit_logs WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM products WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM product_categories WHERE organization_id = $1', [orgId]);
      await pool.query('UPDATE users SET contact_id = NULL WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM contacts WHERE organization_id = $1', [orgId]);
      await pool.query('UPDATE users SET organization_id = NULL WHERE organization_id = $1', [orgId]);
      await pool.query('UPDATE organizations SET created_by = NULL, updated_by = NULL WHERE id = $1', [orgId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    }
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`phase6_%_${suffix}@example.com`]);
    await pool.end();
  });

  const asAdminA = (req) => req.set('Cookie', [`sid=${adminASid}`]);
  const asManagerA = (req) => req.set('Cookie', [`sid=${managerASid}`]);
  const asAdminB = (req) => req.set('Cookie', [`sid=${adminBSid}`]);

  // ─────────────────────────────────────────────────────────────────────────
  describe('1. Schema', () => {
    test('contacts, product_categories, taxes and products exist with tenant columns', async () => {
      for (const table of ['contacts', 'product_categories', 'taxes', 'products']) {
        const cols = await pool.query(
          'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
          [table]
        );
        const names = cols.rows.map((r) => r.column_name);
        expect(names.length).toBeGreaterThan(0);
        expect(names).toContain('organization_id');
        expect(names).toContain('status');
      }
    });

    test('money columns are NUMERIC(15,2), never a float type', async () => {
      const cols = await pool.query(
        `SELECT column_name, data_type, numeric_precision, numeric_scale
           FROM information_schema.columns
          WHERE table_name = 'products'
            AND column_name IN ('sales_price', 'cost_price')`
      );
      expect(cols.rows.length).toBe(2);
      for (const row of cols.rows) {
        expect(row.data_type).toBe('numeric');
        expect(row.numeric_precision).toBe(15);
        expect(row.numeric_scale).toBe(2);
      }
    });

    test('users.contact_id foreign key was landed', async () => {
      const fk = await pool.query(
        `SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_contact_id'`
      );
      expect(fk.rowCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('2. Contact CRUD and archive', () => {
    let contactId;

    test('admin creates a contact', async () => {
      const res = await asAdminA(request(app).post('/api/contacts')).send({
        name: 'Azure Furniture',
        contact_type: 'customer',
        email: `azure_${suffix}@example.com`,
        mobile: '9876543210',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380015',
        portal_access_enabled: false,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.contact.name).toBe('Azure Furniture');
      expect(res.body.data.contact.organization_id).toBe(orgA);

      contactId = res.body.data.contact.id;
      createdContactIds.push(contactId);
    });

    test('manager may also create a contact (project.md §3)', async () => {
      const res = await asManagerA(request(app).post('/api/contacts')).send({
        name: 'Nimesh Pathak',
        contact_type: 'vendor',
        email: `nimesh_${suffix}@example.com`,
        city: 'Surat',
        pincode: '395003',
      });

      expect(res.status).toBe(201);
      createdContactIds.push(res.body.data.contact.id);
    });

    test('the list uses the standard contract', async () => {
      const res = await asAdminA(request(app).get('/api/contacts?page=1&limit=25'));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toEqual(
        expect.objectContaining({ page: 1, limit: 25, total: expect.any(Number) })
      );
    });

    test('search and status filters narrow the list', async () => {
      const res = await asAdminA(request(app).get('/api/contacts?search=Azure&status=active'));
      expect(res.status).toBe(200);
      expect(res.body.data.items.some((c) => c.name === 'Azure Furniture')).toBe(true);
    });

    test('admin updates a contact', async () => {
      const res = await asAdminA(request(app).patch(`/api/contacts/${contactId}`))
        .send({ city: 'Gandhinagar' });

      expect(res.status).toBe(200);
      expect(res.body.data.contact.city).toBe('Gandhinagar');
    });

    test('manager cannot modify a contact (§10 Decision 1)', async () => {
      const res = await asManagerA(request(app).patch(`/api/contacts/${contactId}`))
        .send({ city: 'Rajkot' });

      expect(res.status).toBe(403);
    });

    test('admin archives and restores a contact', async () => {
      const archived = await asAdminA(request(app).patch(`/api/contacts/${contactId}/archive`));
      expect(archived.status).toBe(200);
      expect(archived.body.data.contact.status).toBe('archived');

      const restored = await asAdminA(request(app).patch(`/api/contacts/${contactId}/unarchive`));
      expect(restored.status).toBe(200);
      expect(restored.body.data.contact.status).toBe('active');
    });

    test('manager cannot archive a contact', async () => {
      const res = await asManagerA(request(app).patch(`/api/contacts/${contactId}/archive`));
      expect(res.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('3. Duplicate rules are per-organization', () => {
    const sharedEmail = `shared_${suffix}@example.com`;

    test('a duplicate email inside one organization is rejected', async () => {
      const first = await asAdminA(request(app).post('/api/contacts')).send({
        name: 'First Holder', contact_type: 'customer', email: sharedEmail, portal_access_enabled: false,
      });
      expect(first.status).toBe(201);
      createdContactIds.push(first.body.data.contact.id);

      const second = await asAdminA(request(app).post('/api/contacts')).send({
        name: 'Second Holder', contact_type: 'customer', email: sharedEmail.toUpperCase(), portal_access_enabled: false,
      });
      expect(second.status).toBe(409);
    });

    test('the same email is allowed in a different organization', async () => {
      const res = await asAdminB(request(app).post('/api/contacts')).send({
        name: 'Org B Holder', contact_type: 'customer', email: sharedEmail, portal_access_enabled: false,
      });
      expect(res.status).toBe(201);
      createdContactIds.push(res.body.data.contact.id);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('4. Portal provisioning', () => {
    let portalContactId;
    let noEmailContactId;

    beforeAll(async () => {
      const withEmail = await asAdminA(request(app).post('/api/contacts')).send({
        name: 'Portal Customer',
        contact_type: 'customer',
        email: `portal_${suffix}@example.com`,
        portal_access_enabled: false,
      });
      portalContactId = withEmail.body.data.contact.id;
      createdContactIds.push(portalContactId);

      const withoutEmail = await asAdminA(request(app).post('/api/contacts')).send({
        name: 'Walk-in Customer', contact_type: 'customer',
      });
      noEmailContactId = withoutEmail.body.data.contact.id;
      createdContactIds.push(noEmailContactId);
    });

    test('enabling without an email is rejected — there is nowhere to send the invite', async () => {
      const res = await asAdminA(
        request(app).post(`/api/contacts/${noEmailContactId}/portal-access`)
      ).send({ enabled: true });

      expect(res.status).toBe(400);
    });

    test('a manager cannot provision portal access', async () => {
      const res = await asManagerA(
        request(app).post(`/api/contacts/${portalContactId}/portal-access`)
      ).send({ enabled: true });

      expect(res.status).toBe(403);
    });

    test('enabling creates exactly ONE linked user', async () => {
      const res = await asAdminA(
        request(app).post(`/api/contacts/${portalContactId}/portal-access`)
      ).send({ enabled: true });

      expect(res.status).toBe(200);
      expect(res.body.data.contact.portal_access_enabled).toBe(true);

      const users = await pool.query(
        'SELECT id, role, organization_id, must_change_password, status FROM users WHERE contact_id = $1',
        [portalContactId]
      );
      expect(users.rowCount).toBe(1);
      expect(users.rows[0].role).toBe('customer');
      expect(users.rows[0].organization_id).toBe(orgA);
      expect(users.rows[0].must_change_password).toBe(true);
    });

    test('the initial password is never returned in the response', async () => {
      const res = await asAdminA(request(app).get(`/api/contacts/${portalContactId}`));
      const body = JSON.stringify(res.body);

      expect(body).not.toMatch(/password_hash/);
      expect(body).not.toMatch(/"password"/);
      expect(res.body.data.contact.portal_user).toEqual(
        expect.objectContaining({ must_change_password: true })
      );
    });

    test('enabling twice does not mint a second user', async () => {
      await asAdminA(request(app).post(`/api/contacts/${portalContactId}/portal-access`))
        .send({ enabled: true });

      const users = await pool.query('SELECT id FROM users WHERE contact_id = $1', [portalContactId]);
      expect(users.rowCount).toBe(1);
    });

    test('disabling invalidates a LIVE JWT immediately', async () => {
      const portalUser = await contactsRepository.findPortalUser(null, orgA, portalContactId);

      // Make the account look like one that has finished the invite, so the
      // only thing that can reject the token is the revocation itself.
      await pool.query(
        `UPDATE users SET status = 'active', email_verified = true WHERE id = $1`,
        [portalUser.id]
      );
      const live = await pool.query('SELECT token_version FROM users WHERE id = $1', [portalUser.id]);

      const token = authJwt.generateToken({
        id: portalUser.id, role: 'customer', token_version: live.rows[0].token_version,
      });

      // The token works before revocation.
      const before = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(before.status).toBe(200);

      await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
        [portalUser.id, `hash_${suffix}_revoke`]
      );

      const res = await asAdminA(
        request(app).post(`/api/contacts/${portalContactId}/portal-access`)
      ).send({ enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.data.contact.portal_access_enabled).toBe(false);

      // The same token, unchanged, is now refused.
      const after = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(after.status).toBe(401);

      // Refresh tokens are gone, so a new access token cannot be minted.
      const refreshRows = await pool.query(
        'SELECT id FROM refresh_tokens WHERE user_id = $1', [portalUser.id]
      );
      expect(refreshRows.rowCount).toBe(0);
    });

    test('revocation retains the users row for audit integrity (A11)', async () => {
      const users = await pool.query('SELECT id, status FROM users WHERE contact_id = $1', [portalContactId]);
      expect(users.rowCount).toBe(1);
      expect(users.rows[0].status).toBe('inactive');
    });

    test('archiving a contact revokes its portal login but keeps the user row', async () => {
      const created = await asAdminA(request(app).post('/api/contacts')).send({
        name: 'To Be Archived',
        contact_type: 'customer',
        email: `archiveme_${suffix}@example.com`,
      });
      const id = created.body.data.contact.id;
      createdContactIds.push(id);

      await asAdminA(request(app).post(`/api/contacts/${id}/portal-access`)).send({ enabled: true });
      const beforeUsers = await pool.query('SELECT id, token_version FROM users WHERE contact_id = $1', [id]);
      expect(beforeUsers.rowCount).toBe(1);

      const archived = await asAdminA(request(app).patch(`/api/contacts/${id}/archive`));
      expect(archived.status).toBe(200);
      expect(archived.body.data.contact.portal_access_enabled).toBe(false);

      const afterUsers = await pool.query('SELECT id, status, token_version FROM users WHERE contact_id = $1', [id]);
      expect(afterUsers.rowCount).toBe(1);
      expect(afterUsers.rows[0].status).toBe('inactive');
      expect(afterUsers.rows[0].token_version).toBeGreaterThan(beforeUsers.rows[0].token_version);
    });

    test('creating a contact with an email auto-provisions when the actor is admin', async () => {
      const res = await asAdminA(request(app).post('/api/contacts')).send({
        name: 'Auto Provisioned', contact_type: 'customer', email: `auto_${suffix}@example.com`,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.contact.portal_access_enabled).toBe(true);
      createdContactIds.push(res.body.data.contact.id);

      const users = await pool.query('SELECT id FROM users WHERE contact_id = $1', [res.body.data.contact.id]);
      expect(users.rowCount).toBe(1);
    });

    test('a manager creating a contact does NOT mint a login', async () => {
      const res = await asManagerA(request(app).post('/api/contacts')).send({
        name: 'Manager Created', contact_type: 'customer', email: `mgrmade_${suffix}@example.com`,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.contact.portal_access_enabled).toBe(false);
      createdContactIds.push(res.body.data.contact.id);

      const users = await pool.query('SELECT id FROM users WHERE contact_id = $1', [res.body.data.contact.id]);
      expect(users.rowCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('5. Profile image', () => {
    let imageContactId;

    beforeAll(async () => {
      const res = await asAdminA(request(app).post('/api/contacts')).send({
        name: 'Image Contact', contact_type: 'customer',
      });
      imageContactId = res.body.data.contact.id;
      createdContactIds.push(imageContactId);
    });

    test('a genuine PNG is accepted', async () => {
      const res = await asAdminA(request(app).post(`/api/contacts/${imageContactId}/profile-image`))
        .set('Content-Type', 'image/png')
        .send(PNG_BYTES);

      expect(res.status).toBe(200);
      expect(res.body.data.contact.profile_image_url).toMatch(/^\/uploads\/contacts\/.+\.png$/);
    });

    test('a spoofed MIME type is rejected on its bytes', async () => {
      const res = await asAdminA(request(app).post(`/api/contacts/${imageContactId}/profile-image`))
        .set('Content-Type', 'image/png')
        .send(Buffer.from('<?php system($_GET["c"]); ?>'.padEnd(128, ' '), 'utf8'));

      expect(res.status).toBe(400);
    });

    test('an oversized upload is rejected', async () => {
      const oversized = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(2 * 1024 * 1024 + 1024),
      ]);

      const res = await asAdminA(request(app).post(`/api/contacts/${imageContactId}/profile-image`))
        .set('Content-Type', 'image/png')
        .send(oversized);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).not.toBe(200);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('6. Product categories and products', () => {
    let categoryId;
    let productId;

    test('admin creates a category', async () => {
      const res = await asAdminA(request(app).post('/api/product-categories'))
        .send({ name: `Seating ${suffix}`, description: 'Chairs, stools and benches' });

      expect(res.status).toBe(201);
      categoryId = res.body.data.category.id;
      createdCategoryIds.push(categoryId);
    });

    test('admin creates a product with money returned as a string', async () => {
      const res = await asAdminA(request(app).post('/api/products')).send({
        name: 'Wooden Chair',
        product_type: 'goods',
        sku: `WC-${suffix}`,
        category_id: categoryId,
        sales_price: '1499.50',
        cost_price: '900.00',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.product.sales_price).toBe('1499.50');
      expect(typeof res.body.data.product.sales_price).toBe('string');
      expect(res.body.data.product.category_name).toBe(`Seating ${suffix}`);

      productId = res.body.data.product.id;
      createdProductIds.push(productId);
    });

    test('manager can create a product but NOT change its price', async () => {
      const created = await asManagerA(request(app).post('/api/products')).send({
        name: 'Manager Product', product_type: 'goods', sales_price: '100.00',
      });
      expect(created.status).toBe(201);
      createdProductIds.push(created.body.data.product.id);

      const repriced = await asManagerA(request(app).patch(`/api/products/${productId}`))
        .send({ sales_price: '1.00' });
      expect(repriced.status).toBe(403);

      // And the price genuinely did not move.
      const check = await pool.query('SELECT sales_price FROM products WHERE id = $1', [productId]);
      expect(check.rows[0].sales_price).toBe('1499.50');
    });

    test('admin can change a price', async () => {
      const res = await asAdminA(request(app).patch(`/api/products/${productId}`))
        .send({ sales_price: '1599.00' });

      expect(res.status).toBe(200);
      expect(res.body.data.product.sales_price).toBe('1599.00');
    });

    test('a duplicate SKU inside one organization is rejected, but allowed across organizations', async () => {
      const duplicate = await asAdminA(request(app).post('/api/products')).send({
        name: 'Copycat Chair', product_type: 'goods', sku: `WC-${suffix}`,
      });
      expect(duplicate.status).toBe(409);

      const otherOrg = await asAdminB(request(app).post('/api/products')).send({
        name: 'Org B Chair', product_type: 'goods', sku: `WC-${suffix}`,
      });
      expect(otherOrg.status).toBe(201);
      createdProductIds.push(otherOrg.body.data.product.id);
    });

    test('a category from another organization cannot be attached', async () => {
      const res = await asAdminB(request(app).post('/api/products')).send({
        name: 'Cross Tenant Product', product_type: 'goods', category_id: categoryId,
      });
      expect(res.status).toBe(400);
    });

    test('archiving a category that still has products returns 409 naming the blocker', async () => {
      const res = await asAdminA(request(app).patch(`/api/product-categories/${categoryId}/archive`));

      expect(res.status).toBe(409);
      expect(JSON.stringify(res.body)).toMatch(/products/);
    });

    test('archiving a product does not touch its stored price', async () => {
      const before = await pool.query('SELECT sales_price FROM products WHERE id = $1', [productId]);

      const res = await asAdminA(request(app).patch(`/api/products/${productId}/archive`));
      expect(res.status).toBe(200);
      expect(res.body.data.product.status).toBe('archived');

      const after = await pool.query('SELECT sales_price FROM products WHERE id = $1', [productId]);
      expect(after.rows[0].sales_price).toBe(before.rows[0].sales_price);

      await asAdminA(request(app).patch(`/api/products/${productId}/unarchive`));
    });

    test('an archive attempt is refused with 409 when documents reference the product', async () => {
      // The document tables arrive in Phases 8/9. Stand one up with the shape
      // the reference check looks for so the 409 path is actually exercised
      // rather than merely assumed to work later.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS invoice_lines (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL,
          product_id      UUID NOT NULL
        )`);

      try {
        await pool.query(
          'INSERT INTO invoice_lines (organization_id, product_id) VALUES ($1, $2)',
          [orgA, productId]
        );

        const res = await asAdminA(request(app).patch(`/api/products/${productId}/archive`));
        expect(res.status).toBe(409);
        expect(JSON.stringify(res.body)).toMatch(/invoice_lines/);
      } finally {
        await pool.query('DROP TABLE IF EXISTS invoice_lines');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('7. Cross-tenant isolation on every endpoint', () => {
    let contactA;
    let productA;
    let categoryA;

    beforeAll(async () => {
      const c = await asAdminA(request(app).post('/api/contacts'))
        .send({ name: 'Tenant Probe Contact', contact_type: 'customer' });
      contactA = c.body.data.contact.id;
      createdContactIds.push(contactA);

      const cat = await asAdminA(request(app).post('/api/product-categories'))
        .send({ name: `Probe Category ${suffix}` });
      categoryA = cat.body.data.category.id;
      createdCategoryIds.push(categoryA);

      const p = await asAdminA(request(app).post('/api/products'))
        .send({ name: 'Tenant Probe Product', product_type: 'goods' });
      productA = p.body.data.product.id;
      createdProductIds.push(productA);
    });

    test("Org B sees none of Org A's records in any list", async () => {
      const contacts = await asAdminB(request(app).get('/api/contacts?limit=100'));
      expect(contacts.body.data.items.every((c) => c.organization_id === orgB)).toBe(true);
      expect(contacts.body.data.items.some((c) => c.id === contactA)).toBe(false);

      const products = await asAdminB(request(app).get('/api/products?limit=100'));
      expect(products.body.data.items.every((p) => p.organization_id === orgB)).toBe(true);

      const categories = await asAdminB(request(app).get('/api/product-categories?limit=100'));
      expect(categories.body.data.items.every((c) => c.organization_id === orgB)).toBe(true);
    });

    test("a cross-tenant id returns 404, never 403 — a 403 would confirm the record exists", async () => {
      const probes = [
        ['get', `/api/contacts/${contactA}`],
        ['patch', `/api/contacts/${contactA}`],
        ['patch', `/api/contacts/${contactA}/archive`],
        ['patch', `/api/contacts/${contactA}/unarchive`],
        ['post', `/api/contacts/${contactA}/portal-access`],
        ['get', `/api/products/${productA}`],
        ['patch', `/api/products/${productA}`],
        ['patch', `/api/products/${productA}/archive`],
        ['patch', `/api/products/${productA}/unarchive`],
        ['get', `/api/product-categories/${categoryA}`],
        ['patch', `/api/product-categories/${categoryA}`],
        ['patch', `/api/product-categories/${categoryA}/archive`],
        ['patch', `/api/product-categories/${categoryA}/unarchive`],
      ];

      for (const [method, path] of probes) {
        const res = await asAdminB(request(app)[method](path))
          .send({ name: 'Hijacked', enabled: true, city: 'Nowhere' });

        expect({ path, status: res.status }).toEqual({ path, status: 404 });
      }
    });

    test('organization_id in the request body is ignored', async () => {
      const res = await asAdminA(request(app).post('/api/contacts')).send({
        name: 'Body Org Injection',
        contact_type: 'customer',
        organization_id: orgB,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.contact.organization_id).toBe(orgA);
      createdContactIds.push(res.body.data.contact.id);
    });

    test('every endpoint requires authentication', async () => {
      for (const path of ['/api/contacts', '/api/products', '/api/product-categories']) {
        const res = await request(app).get(path);
        expect(res.status).toBe(401);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('8. sortBy allow-list at the HTTP boundary', () => {
    test('an injection attempt in sortBy is ignored, not executed', async () => {
      const res = await asAdminA(
        request(app).get('/api/contacts?sortBy=name;DROP%20TABLE%20contacts--')
      );

      expect(res.status).toBe(200);

      const stillThere = await pool.query("SELECT to_regclass('public.contacts') AS reg");
      expect(stillThere.rows[0].reg).toBe('contacts');
    });
  });
});
