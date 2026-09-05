const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/app');
const authSession = require('../src/auth/auth.session');
const { seedOrganizationMasterData } = require('../src/organizations/organizations.seed');

jest.setTimeout(60000);

const suffix = Date.now();

describe('Phase 8: Purchase Flow (PO → Vendor Bill → Ledger)', () => {
  let orgA;
  let orgB;
  let adminA;
  let managerA;
  let adminB;
  let adminASid;
  let managerASid;
  let adminBSid;

  let vendorA;
  let productWood;
  let purchaseJournalA;
  let expenseAccountA;
  let inputTaxAccountA;
  let tax18A;
  let analyticA;

  const asAdminA = (req) => req.set('Cookie', [`sid=${adminASid}`]);
  const asManagerA = (req) => req.set('Cookie', [`sid=${managerASid}`]);
  const asAdminB = (req) => req.set('Cookie', [`sid=${adminBSid}`]);

  async function makeOrg(label) {
    const res = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Phase8 ${label} ${suffix}`, `phase8-${label.toLowerCase()}-${suffix}`]
    );
    return res.rows[0].id;
  }

  async function makeUser(organizationId, role, label) {
    const res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', $3, true, $4) RETURNING id`,
      [`User ${label}`, `${label.toLowerCase()}_${suffix}@example.com`, role, organizationId]
    );
    return res.rows[0].id;
  }

  beforeAll(async () => {
    orgA = await makeOrg('OrgA');
    orgB = await makeOrg('OrgB');

    adminA = await makeUser(orgA, 'business_owner', 'adminA');
    managerA = await makeUser(orgA, 'accountant', 'mgrA');
    adminB = await makeUser(orgB, 'business_owner', 'adminB');

    adminASid = authSession.createSession(adminA, 'business_owner', false).sessionId;
    managerASid = authSession.createSession(managerA, 'accountant', false).sessionId;
    adminBSid = authSession.createSession(adminB, 'business_owner', false).sessionId;

    // Seed master data in transactions
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

    // Find purchase journal
    const jRes = await pool.query(
      `SELECT id FROM journals WHERE organization_id = $1 AND journal_type = 'purchase' LIMIT 1`,
      [orgA]
    );
    purchaseJournalA = jRes.rows[0].id;

    // Accounts
    const expRes = await pool.query(
      `SELECT id FROM accounts WHERE organization_id = $1 AND code = '5010' LIMIT 1`,
      [orgA]
    );
    expenseAccountA = expRes.rows[0].id;

    const taxAccRes = await pool.query(
      `SELECT id FROM accounts WHERE organization_id = $1 AND code = '1040' LIMIT 1`,
      [orgA]
    );
    inputTaxAccountA = taxAccRes.rows[0].id;

    // Create a vendor contact for Org A (e.g. Azure Furniture)
    const vRes = await pool.query(
      `INSERT INTO contacts (organization_id, name, contact_type, email, city, status)
       VALUES ($1, 'Azure Furniture', 'vendor', $2, 'Ahmedabad', 'active')
       RETURNING id`,
      [orgA, `azure_${suffix}@example.com`]
    );
    vendorA = vRes.rows[0].id;

    // Create a 18% purchase tax with tax_account_id = Input Tax Credit
    const tRes = await pool.query(
      `INSERT INTO taxes (organization_id, name, rate, tax_scope, tax_account_id, status)
       VALUES ($1, 'GST 18%', 18.0000, 'purchase', $2, 'active')
       RETURNING id`,
      [orgA, inputTaxAccountA]
    );
    tax18A = tRes.rows[0].id;

    // Create an analytic account
    const anRes = await pool.query(
      `INSERT INTO analytic_accounts (organization_id, name, code, analytic_type, status)
       VALUES ($1, 'Showroom Project', 'AN-SHOW', 'expense', 'active')
       RETURNING id`,
      [orgA]
    );
    analyticA = anRes.rows[0].id;

    // Create a product (e.g. Wooden Chair)
    const pRes = await pool.query(
      `INSERT INTO products (organization_id, name, sku, product_type, cost_price, sales_price, expense_account_id, purchase_tax_id, status)
       VALUES ($1, 'Teak Wood Chair', $2, 'goods', 2500.00, 3500.00, $3, $4, 'active')
       RETURNING id`,
      [orgA, `SKU-CHAIR-${suffix}`, expenseAccountA, tax18A]
    );
    productWood = pRes.rows[0].id;
  });

  afterAll(async () => {
    for (const orgId of [orgA, orgB].filter(Boolean)) {
      await pool.query(`ALTER TABLE journal_entries DISABLE TRIGGER ALL`);
      await pool.query(`ALTER TABLE journal_entry_lines DISABLE TRIGGER ALL`);
      await pool.query(`DELETE FROM vendor_bill_lines WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM vendor_bills WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM purchase_order_lines WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM purchase_orders WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM journal_entry_lines WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM journal_entries WHERE organization_id = $1`, [orgId]);
      await pool.query(`ALTER TABLE journal_entries ENABLE TRIGGER ALL`);
      await pool.query(`ALTER TABLE journal_entry_lines ENABLE TRIGGER ALL`);
      await pool.query(`DELETE FROM products WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM taxes WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM analytic_accounts WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM contacts WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM document_sequences WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM journals WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM accounts WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM audit_logs WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    }
    await pool.end();
  });

  describe('Purchase Order Lifecycle', () => {
    let poId;

    test('1. Create PO as draft: recomputes totals server-side, ignores client total', async () => {
      const res = await asManagerA(
        request(app)
          .post('/api/purchase-orders')
          .send({
            vendor_contact_id: vendorA,
            order_date: '2026-04-10',
            lines: [
              {
                product_id: productWood,
                description: 'Teak Wood Chair batch',
                quantity: 10,
                unit_price: 2500, // untaxed = 25000, tax 18% = 4500, total = 29500
                tax_id: tax18A,
                analytic_account_id: analyticA,
              },
            ],
            total_amount: 999999, // Should be IGNORED
          })
      );

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      poId = data.id;

      expect(data.status).toBe('draft');
      expect(data.untaxed_amount).toBe('25000.00');
      expect(data.tax_amount).toBe('4500.00');
      expect(data.total_amount).toBe('29500.00');
      expect(data.lines).toHaveLength(1);
      expect(data.lines[0].analytic_account_id).toBe(analyticA);
    });

    test('2. Update PO while in draft', async () => {
      const res = await asManagerA(
        request(app)
          .patch(`/api/purchase-orders/${poId}`)
          .send({
            lines: [
              {
                product_id: productWood,
                description: 'Updated quantity',
                quantity: 20,
                unit_price: 2500, // untaxed = 50000, tax 18% = 9000, total = 59000
                tax_id: tax18A,
                analytic_account_id: analyticA,
              },
            ],
          })
      );

      expect(res.status).toBe(200);
      expect(res.body.data.untaxed_amount).toBe('50000.00');
      expect(res.body.data.tax_amount).toBe('9000.00');
      expect(res.body.data.total_amount).toBe('59000.00');
    });

    test('3. Confirm PO: transitions from draft to confirmed', async () => {
      const res = await asManagerA(
        request(app)
          .post(`/api/purchase-orders/${poId}/confirm`)
          .send()
      );

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('confirmed');
    });

    test('4. Confirmed PO cannot be edited via PATCH', async () => {
      const res = await asManagerA(
        request(app)
          .patch(`/api/purchase-orders/${poId}`)
          .send({ notes: 'Illegal edit on confirmed PO' })
      );

      expect(res.status).toBe(409);
    });

    test('5. Convert PO to Vendor Bill', async () => {
      const res = await asManagerA(
        request(app)
          .post(`/api/purchase-orders/${poId}/create-bill`)
          .send({ journal_id: purchaseJournalA })
      );

      expect(res.status).toBe(201);
      const bill = res.body.data;
      expect(bill.status).toBe('draft');
      expect(bill.purchase_order_id).toBe(poId);
      expect(bill.untaxed_amount).toBe('50000.00');
      expect(bill.tax_amount).toBe('9000.00');
      expect(bill.total_amount).toBe('59000.00');
      expect(bill.lines).toHaveLength(1);
      expect(bill.lines[0].analytic_account_id).toBe(analyticA);

      // Verify PO status is billed
      const poCheck = await asManagerA(
        request(app).get(`/api/purchase-orders/${poId}`)
      );
      expect(poCheck.body.data.status).toBe('billed');
    });

    test('6. Attempting to bill an already-billed PO returns 409', async () => {
      const res = await asManagerA(
        request(app)
          .post(`/api/purchase-orders/${poId}/create-bill`)
          .send({ journal_id: purchaseJournalA })
      );

      expect(res.status).toBe(409);
      expect(res.body.error?.message || res.body.message).toMatch(/already.*billed/i);
    });
  });

  describe('Vendor Bill Lifecycle & Ledger Integration', () => {
    let billId;

    test('1. Create direct Vendor Bill as draft', async () => {
      const res = await asManagerA(
        request(app)
          .post('/api/vendor-bills')
          .send({
            vendor_contact_id: vendorA,
            journal_id: purchaseJournalA,
            bill_date: '2026-04-15',
            due_date: '2026-05-15',
            lines: [
              {
                product_id: productWood,
                expense_account_id: expenseAccountA,
                description: 'Office wood chairs',
                quantity: 4,
                unit_price: 2500, // 10000 untaxed, 1800 tax, 11800 total
                tax_id: tax18A,
                analytic_account_id: analyticA,
              },
            ],
          })
      );

      expect(res.status).toBe(201);
      billId = res.body.data.id;
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.untaxed_amount).toBe('10000.00');
      expect(res.body.data.tax_amount).toBe('1800.00');
      expect(res.body.data.total_amount).toBe('11800.00');
    });

    test('2. Post Vendor Bill: creates balanced Journal Entry with correct lines', async () => {
      const res = await asManagerA(
        request(app)
          .post(`/api/vendor-bills/${billId}/post`)
          .send()
      );

      expect(res.status).toBe(200);
      const bill = res.body.data;
      expect(bill.status).toBe('posted');
      expect(bill.journal_entry_id).toBeDefined();
      expect(bill.amount_due).toBe('11800.00');
      expect(bill.bill_number).toMatch(/^BILL\//);

      // Verify the generated journal entry via API
      const entryRes = await asManagerA(
        request(app).get(`/api/journal-entries/${bill.journal_entry_id}`)
      );

      expect(entryRes.status).toBe(200);
      const entry = entryRes.body.data.entry || entryRes.body.data;
      expect(entry.status).toBe('posted');
      const totalDr = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
      const totalCr = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDr).toBe(11800);
      expect(totalCr).toBe(11800);

      // Check analytic account propagation to expense line
      const expenseLine = entry.lines.find((l) => l.account_id === expenseAccountA && Number(l.debit) > 0);
      expect(expenseLine).toBeDefined();
      expect(expenseLine.analytic_account_id).toBe(analyticA);
    });

    test('3. Posted bill cannot be edited via PATCH', async () => {
      const res = await asManagerA(
        request(app)
          .patch(`/api/vendor-bills/${billId}`)
          .send({ notes: 'Attempted edit on posted bill' })
      );

      expect(res.status).toBe(409);
    });

    test('4. Posted bill cannot be posted again', async () => {
      const res = await asManagerA(
        request(app)
          .post(`/api/vendor-bills/${billId}/post`)
          .send()
      );

      expect(res.status).toBe(409);
    });

    test('5. Non-admin cannot cancel a bill', async () => {
      const res = await asManagerA(
        request(app)
          .post(`/api/vendor-bills/${billId}/cancel`)
          .send()
      );

      expect(res.status).toBe(403);
    });

    test('6. Admin can cancel a posted bill (reverses journal entry)', async () => {
      const res = await asAdminA(
        request(app)
          .post(`/api/vendor-bills/${billId}/cancel`)
          .send()
      );

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cancelled');

      // Verify original journal entry is now reversed
      const billCheck = await asAdminA(
        request(app).get(`/api/vendor-bills/${billId}`)
      );

      const entryRes = await asAdminA(
        request(app).get(`/api/journal-entries/${billCheck.body.data.journal_entry_id}`)
      );

      const entry = entryRes.body.data.entry || entryRes.body.data;
      expect(entry.status).toBe('reversed');
    });
  });

  describe('Security & Multi-Tenancy Isolation', () => {
    let billAId;

    beforeAll(async () => {
      const res = await asAdminA(
        request(app)
          .post('/api/vendor-bills')
          .send({
            vendor_contact_id: vendorA,
            journal_id: purchaseJournalA,
            bill_date: '2026-04-20',
            lines: [
              {
                product_id: productWood,
                expense_account_id: expenseAccountA,
                quantity: 1,
                unit_price: 1000,
                description: 'Wood chair',
              },
            ],
          })
      );
      billAId = res.body.data.id;
    });

    test('Org B cannot view Org A vendor bill (returns 404, not 403)', async () => {
      const res = await asAdminB(
        request(app).get(`/api/vendor-bills/${billAId}`)
      );

      expect(res.status).toBe(404);
    });

    test('Org B cannot post Org A vendor bill', async () => {
      const res = await asAdminB(
        request(app)
          .post(`/api/vendor-bills/${billAId}/post`)
          .send()
      );

      expect(res.status).toBe(404);
    });
  });
});
