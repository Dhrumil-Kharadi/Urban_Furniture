const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/app');
const authSession = require('../src/auth/auth.session');
const { seedOrganizationMasterData } = require('../src/organizations/organizations.seed');

jest.setTimeout(60000);

const suffix = Date.now();

describe('Phase 9: Sales Flow (SO → Customer Invoice → Ledger)', () => {
  let orgA;
  let orgB;
  let adminA;
  let managerA;
  let adminB;
  let adminASid;
  let managerASid;
  let adminBSid;

  let customerNimesh;
  let vendorOnly;
  let productChair;
  let salesJournalA;
  let saleIncomeAccountA;
  let debtorsAccountA;
  let outputTaxAccountA;
  let tax18A;
  let analyticA;

  const asAdminA = (req) => req.set('Cookie', [`sid=${adminASid}`]);
  const asManagerA = (req) => req.set('Cookie', [`sid=${managerASid}`]);
  const asAdminB = (req) => req.set('Cookie', [`sid=${adminBSid}`]);

  async function makeOrg(label) {
    const res = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Phase9 ${label} ${suffix}`, `phase9-${label.toLowerCase()}-${suffix}`]
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

    adminA = await makeUser(orgA, 'admin', 'adminA');
    managerA = await makeUser(orgA, 'manager', 'mgrA');
    adminB = await makeUser(orgB, 'admin', 'adminB');

    adminASid = authSession.createSession(adminA, 'admin', false).sessionId;
    managerASid = authSession.createSession(managerA, 'manager', false).sessionId;
    adminBSid = authSession.createSession(adminB, 'admin', false).sessionId;

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

    // Find sales journal
    const jRes = await pool.query(
      `SELECT id FROM journals WHERE organization_id = $1 AND journal_type = 'sales' LIMIT 1`,
      [orgA]
    );
    salesJournalA = jRes.rows[0].id;

    // Accounts
    const debtorsRes = await pool.query(
      `SELECT id FROM accounts WHERE organization_id = $1 AND code = '1030' LIMIT 1`,
      [orgA]
    );
    debtorsAccountA = debtorsRes.rows[0].id;

    const incRes = await pool.query(
      `SELECT id FROM accounts WHERE organization_id = $1 AND code = '4010' LIMIT 1`,
      [orgA]
    );
    saleIncomeAccountA = incRes.rows[0].id;

    const outTaxRes = await pool.query(
      `SELECT id FROM accounts WHERE organization_id = $1 AND code = '2020' LIMIT 1`,
      [orgA]
    );
    outputTaxAccountA = outTaxRes.rows[0].id;

    // Create Customer Contact: Nimesh Pathak
    const cRes = await pool.query(
      `INSERT INTO contacts (organization_id, name, contact_type, email, city, status)
       VALUES ($1, 'Nimesh Pathak', 'customer', $2, 'Ahmedabad', 'active')
       RETURNING id`,
      [orgA, `nimesh_${suffix}@example.com`]
    );
    customerNimesh = cRes.rows[0].id;

    // Create Vendor-Only Contact (should be rejected for Sales)
    const vRes = await pool.query(
      `INSERT INTO contacts (organization_id, name, contact_type, email, city, status)
       VALUES ($1, 'Vendor Only', 'vendor', $2, 'Surat', 'active')
       RETURNING id`,
      [orgA, `vendor_${suffix}@example.com`]
    );
    vendorOnly = vRes.rows[0].id;

    // Create a 18% sales tax
    const tRes = await pool.query(
      `INSERT INTO taxes (organization_id, name, rate, tax_scope, tax_account_id, status)
       VALUES ($1, 'GST 18%', 18.0000, 'sales', $2, 'active')
       RETURNING id`,
      [orgA, outputTaxAccountA]
    );
    tax18A = tRes.rows[0].id;

    // Create product: Office Chair
    const pRes = await pool.query(
      `INSERT INTO products (
         organization_id, name, sku, product_type, sales_price, cost_price,
         income_account_id, sales_tax_id, status
       ) VALUES ($1, 'Office Chair', $2, 'goods', 5000.00, 3000.00, $3, $4, 'active')
       RETURNING id`,
      [orgA, `CHAIR-${suffix}`, saleIncomeAccountA, tax18A]
    );
    productChair = pRes.rows[0].id;

    // Analytic account
    const anRes = await pool.query(
      `INSERT INTO analytic_accounts (organization_id, name, code, analytic_type, status)
       VALUES ($1, 'Corporate Sales', 'AN-CORP', 'income', 'active')
       RETURNING id`,
      [orgA]
    );
    analyticA = anRes.rows[0].id;
  });

  describe('Sales Order Lifecycle & Validation', () => {
    test('Cannot create Sales Order with vendor-only contact', async () => {
      const res = await asAdminA(
        request(app)
          .post('/api/sales-orders')
          .send({
            customer_contact_id: vendorOnly,
            order_date: '2026-05-01',
            lines: [
              {
                product_id: productChair,
                quantity: 2,
                unit_price: 5000,
                description: 'Office Chair',
              },
            ],
          })
      );

      expect(res.status).toBe(400);
      const msg = res.body.error?.message || res.body.message;
      expect(msg).toMatch(/Customer not found or is inactive/i);
    });

    test('Create draft Sales Order — recomputes totals and tax server-side', async () => {
      const res = await asManagerA(
        request(app)
          .post('/api/sales-orders')
          .send({
            customer_contact_id: customerNimesh,
            order_date: '2026-05-01',
            lines: [
              {
                product_id: productChair,
                quantity: 5,
                unit_price: 5000, // untaxed = 25000, tax 18% = 4500, total = 29500
                tax_id: tax18A,
                analytic_account_id: analyticA,
                description: '5 Office Chairs for Nimesh',
              },
            ],
          })
      );

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.so_number).toMatch(/^SO\/\d{4}\/\d{5}$/);
      expect(parseFloat(res.body.data.untaxed_amount)).toBe(25000.00);
      expect(parseFloat(res.body.data.tax_amount)).toBe(4500.00);
      expect(parseFloat(res.body.data.total_amount)).toBe(29500.00);
      expect(res.body.data.lines).toHaveLength(1);
    });

    test('Confirm draft Sales Order: draft → confirmed', async () => {
      const createRes = await asManagerA(
        request(app)
          .post('/api/sales-orders')
          .send({
            customer_contact_id: customerNimesh,
            order_date: '2026-05-02',
            lines: [
              {
                product_id: productChair,
                quantity: 1,
                unit_price: 5000,
                tax_id: tax18A,
                description: '1 Chair',
              },
            ],
          })
      );
      const soId = createRes.body.data.id;

      const confirmRes = await asManagerA(
        request(app).post(`/api/sales-orders/${soId}/confirm`)
      );

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.status).toBe('confirmed');

      // Cannot edit once confirmed
      const editRes = await asManagerA(
        request(app)
          .patch(`/api/sales-orders/${soId}`)
          .send({ notes: 'Trying to edit confirmed order' })
      );
      expect(editRes.status).toBe(409);
    });

    test('Cancel Sales Order (admin only)', async () => {
      const createRes = await asManagerA(
        request(app)
          .post('/api/sales-orders')
          .send({
            customer_contact_id: customerNimesh,
            order_date: '2026-05-03',
            lines: [
              {
                product_id: productChair,
                quantity: 2,
                unit_price: 5000,
                description: 'To cancel',
              },
            ],
          })
      );
      const soId = createRes.body.data.id;

      // Manager cannot cancel (admin only)
      const mgrCancel = await asManagerA(
        request(app).post(`/api/sales-orders/${soId}/cancel`)
      );
      expect(mgrCancel.status).toBe(403);

      // Admin cancels
      const adminCancel = await asAdminA(
        request(app).post(`/api/sales-orders/${soId}/cancel`)
      );
      expect(adminCancel.status).toBe(200);
      expect(adminCancel.body.data.status).toBe('cancelled');
    });
  });

  describe('Exit Criteria (§7.3): SO (Nimesh, 5 Office Chairs) → Invoice → Post', () => {
    let soId;
    let invoiceId;

    test('Step 1: Create and confirm SO for Nimesh Pathak with 5 Office Chairs', async () => {
      const createRes = await asManagerA(
        request(app)
          .post('/api/sales-orders')
          .send({
            customer_contact_id: customerNimesh,
            order_date: '2026-05-10',
            lines: [
              {
                product_id: productChair,
                quantity: 5,
                unit_price: 5000.00,
                tax_id: tax18A,
                analytic_account_id: analyticA,
                description: 'Ergonomic Office Chairs',
              },
            ],
          })
      );

      expect(createRes.status).toBe(201);
      soId = createRes.body.data.id;

      const confirmRes = await asManagerA(
        request(app).post(`/api/sales-orders/${soId}/confirm`)
      );
      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.status).toBe('confirmed');
    });

    test('Step 2: Generate Customer Invoice from confirmed SO', async () => {
      const invRes = await asManagerA(
        request(app)
          .post(`/api/sales-orders/${soId}/create-invoice`)
          .send({ journal_id: salesJournalA })
      );

      expect(invRes.status).toBe(201);
      invoiceId = invRes.body.data.id;

      expect(invRes.body.data.status).toBe('draft');
      expect(invRes.body.data.sales_order_id).toBe(soId);
      expect(parseFloat(invRes.body.data.untaxed_amount)).toBe(25000.00);
      expect(parseFloat(invRes.body.data.tax_amount)).toBe(4500.00);
      expect(parseFloat(invRes.body.data.total_amount)).toBe(29500.00);

      // Verify SO is now marked invoiced
      const soCheck = await asManagerA(
        request(app).get(`/api/sales-orders/${soId}`)
      );
      expect(soCheck.body.data.status).toBe('invoiced');

      // Cannot create a second invoice from the same SO (double-invoicing prevented)
      const doubleInvRes = await asManagerA(
        request(app)
          .post(`/api/sales-orders/${soId}/create-invoice`)
          .send({ journal_id: salesJournalA })
      );
      expect(doubleInvRes.status).toBe(409);
    });

    test('Step 3: Post Customer Invoice → Creates balanced Journal Entry per §5.2.4', async () => {
      const postRes = await asManagerA(
        request(app)
          .post(`/api/customer-invoices/${invoiceId}/post`)
          .send()
      );

      expect(postRes.status).toBe(200);
      expect(postRes.body.data.invoice.status).toBe('posted');
      expect(postRes.body.data.invoice.invoiceNumber).toMatch(/^INV\/\d{4}\/\d{5}$/);
      expect(postRes.body.data.journalEntry).toBeDefined();

      const jeId = postRes.body.data.journalEntry.id;
      expect(jeId).toBeTruthy();

      // Retrieve and verify the posted journal entry lines
      const jeRes = await asAdminA(
        request(app).get(`/api/journal-entries/${jeId}`)
      );
      expect(jeRes.status).toBe(200);

      const entry = jeRes.body.data.entry || jeRes.body.data;
      const lines = entry.lines || [];

      expect(entry.status).toBe('posted');

      // Strict posting validation per project.md §5.2.4 & §7:
      // Dr Debtors (1030)              total (29500.00)
      // Cr Sale Income (4010)          untaxed (25000.00)
      // Cr Output Tax Payable (2020)   tax (4500.00)
      const debtorsLine = lines.find((l) => l.account_id === debtorsAccountA);
      expect(debtorsLine).toBeDefined();
      expect(parseFloat(debtorsLine.debit)).toBe(29500.00);
      expect(parseFloat(debtorsLine.credit)).toBe(0.00);

      const incomeLine = lines.find((l) => l.account_id === saleIncomeAccountA);
      expect(incomeLine).toBeDefined();
      expect(parseFloat(incomeLine.debit)).toBe(0.00);
      expect(parseFloat(incomeLine.credit)).toBe(25000.00);
      expect(incomeLine.analytic_account_id).toBe(analyticA);

      const taxLine = lines.find((l) => l.account_id === outputTaxAccountA);
      expect(taxLine).toBeDefined();
      expect(parseFloat(taxLine.debit)).toBe(0.00);
      expect(parseFloat(taxLine.credit)).toBe(4500.00);

      // Verify tax is NOT folded into Sale Income
      expect(parseFloat(incomeLine.credit)).not.toBe(29500.00);
    });

    test('Double-post of customer invoice is strictly prevented', async () => {
      const secondPostRes = await asManagerA(
        request(app)
          .post(`/api/customer-invoices/${invoiceId}/post`)
          .send()
      );

      expect(secondPostRes.status).toBe(409);
      const postMsg = secondPostRes.body.error?.message || secondPostRes.body.message;
      expect(postMsg).toMatch(/Only draft invoices can be posted/i);
    });

    test('Send invoice to customer (dispatches email notification)', async () => {
      const sendRes = await asManagerA(
        request(app)
          .post(`/api/customer-invoices/${invoiceId}/send`)
          .send()
      );

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.success).toBe(true);
      expect(sendRes.body.data.sentTo).toBe(`nimesh_${suffix}@example.com`);
    });
  });

  describe('Invoice Cancellation & Journal Reversal', () => {
    test('Admin cancels posted customer invoice → reverses journal entry', async () => {
      // Create and post a new direct invoice
      const createRes = await asAdminA(
        request(app)
          .post('/api/customer-invoices')
          .send({
            customer_contact_id: customerNimesh,
            journal_id: salesJournalA,
            invoice_date: '2026-05-15',
            lines: [
              {
                product_id: productChair,
                income_account_id: saleIncomeAccountA,
                quantity: 1,
                unit_price: 5000,
                tax_id: tax18A,
                description: 'Chair for cancellation test',
              },
            ],
          })
      );
      const invId = createRes.body.data.id;

      const postRes = await asAdminA(
        request(app).post(`/api/customer-invoices/${invId}/post`)
      );
      expect(postRes.status).toBe(200);

      // Cancel posted invoice
      const cancelRes = await asAdminA(
        request(app).post(`/api/customer-invoices/${invId}/cancel`)
      );
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('cancelled');

      // Verify original journal entry is now reversed
      const invCheck = await asAdminA(
        request(app).get(`/api/customer-invoices/${invId}`)
      );
      const entryRes = await asAdminA(
        request(app).get(`/api/journal-entries/${invCheck.body.data.journal_entry_id}`)
      );
      const entry = entryRes.body.data.entry || entryRes.body.data;
      expect(entry.status).toBe('reversed');
    });
  });

  describe('Security & Cross-Tenant Isolation', () => {
    let invoiceAId;
    let soAId;

    beforeAll(async () => {
      const soRes = await asAdminA(
        request(app)
          .post('/api/sales-orders')
          .send({
            customer_contact_id: customerNimesh,
            order_date: '2026-05-20',
            lines: [
              {
                product_id: productChair,
                quantity: 1,
                unit_price: 5000,
                description: 'Tenant isolation test',
              },
            ],
          })
      );
      soAId = soRes.body.data.id;

      const invRes = await asAdminA(
        request(app)
          .post('/api/customer-invoices')
          .send({
            customer_contact_id: customerNimesh,
            journal_id: salesJournalA,
            invoice_date: '2026-05-20',
            lines: [
              {
                product_id: productChair,
                income_account_id: saleIncomeAccountA,
                quantity: 1,
                unit_price: 5000,
                description: 'Tenant isolation invoice test',
              },
            ],
          })
      );
      invoiceAId = invRes.body.data.id;
    });

    test('Org B cannot view Org A Sales Order (returns 404, not 403)', async () => {
      const res = await asAdminB(
        request(app).get(`/api/sales-orders/${soAId}`)
      );
      expect(res.status).toBe(404);
    });

    test('Org B cannot view Org A Customer Invoice (returns 404, not 403)', async () => {
      const res = await asAdminB(
        request(app).get(`/api/customer-invoices/${invoiceAId}`)
      );
      expect(res.status).toBe(404);
    });

    test('Org B cannot post Org A Customer Invoice', async () => {
      const res = await asAdminB(
        request(app)
          .post(`/api/customer-invoices/${invoiceAId}/post`)
          .send()
      );
      expect(res.status).toBe(404);
    });
  });
});
