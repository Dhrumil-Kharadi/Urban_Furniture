const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/app');
const authSession = require('../src/auth/auth.session');
const { seedOrganizationMasterData } = require('../src/organizations/organizations.seed');
const authJwt = require('../src/auth/auth.jwt');

jest.setTimeout(60000);

const suffix = Date.now();

describe('Phase 12: Contact Portal & Card Payment Gateway', () => {
  let orgId;
  let adminId;
  let customerContactId;
  let vendorContactId;
  let otherOrgContactId;
  let otherOrgId;

  let customerUserId;
  let vendorUserId;
  let customerToken;
  let vendorToken;

  let testInvoiceId;
  let otherInvoiceId;
  let testBillId;

  const asCustomer = (req) => req.set('Authorization', `Bearer ${customerToken}`);
  const asVendor = (req) => req.set('Authorization', `Bearer ${vendorToken}`);

  beforeAll(async () => {
    // 1. Create main org
    const orgRes = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Phase12 Org ${suffix}`, `phase12-org-${suffix}`]
    );
    orgId = orgRes.rows[0].id;

    // 2. Create other org
    const otherOrgRes = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Other Org ${suffix}`, `other-org-${suffix}`]
    );
    otherOrgId = otherOrgRes.rows[0].id;

    // 3. Admin user for seeding
    const adminRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', 'business_owner', true, $3) RETURNING id`,
      ['Admin P12', `admin_p12_${suffix}@test.com`, orgId]
    );
    adminId = adminRes.rows[0].id;

    // Seed master data
    const seedClient = await pool.connect();
    try {
      await seedClient.query('BEGIN');
      await seedOrganizationMasterData(seedClient, orgId, adminId);
      await seedOrganizationMasterData(seedClient, otherOrgId, adminId);
      await seedClient.query('COMMIT');
    } finally {
      seedClient.release();
    }

    // 4. Contacts
    const cRes = await pool.query(
      `INSERT INTO contacts (organization_id, name, contact_type, email, portal_access_enabled)
       VALUES ($1, 'Customer One', 'customer', $2, true) RETURNING id`,
      [orgId, `customer_${suffix}@test.com`]
    );
    customerContactId = cRes.rows[0].id;

    const vRes = await pool.query(
      `INSERT INTO contacts (organization_id, name, contact_type, email, portal_access_enabled)
       VALUES ($1, 'Vendor One', 'vendor', $2, true) RETURNING id`,
      [orgId, `vendor_${suffix}@test.com`]
    );
    vendorContactId = vRes.rows[0].id;

    const oRes = await pool.query(
      `INSERT INTO contacts (organization_id, name, contact_type, email, portal_access_enabled)
       VALUES ($1, 'Foreign Customer', 'customer', $2, true) RETURNING id`,
      [otherOrgId, `foreign_${suffix}@test.com`]
    );
    otherOrgContactId = oRes.rows[0].id;

    // 5. User accounts for portal contacts
    const cuRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id, contact_id)
       VALUES ($1, $2, 'hash', 'customer', true, $3, $4) RETURNING id`,
      ['Customer User', `c_user_${suffix}@test.com`, orgId, customerContactId]
    );
    customerUserId = cuRes.rows[0].id;

    const vuRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id, contact_id)
       VALUES ($1, $2, 'hash', 'customer', true, $3, $4) RETURNING id`,
      ['Vendor User', `v_user_${suffix}@test.com`, orgId, vendorContactId]
    );
    vendorUserId = vuRes.rows[0].id;

    customerToken = authJwt.generateToken({
      id: customerUserId,
      role: 'customer',
      token_version: 1,
    });

    vendorToken = authJwt.generateToken({
      id: vendorUserId,
      role: 'customer',
      token_version: 1,
    });

    // Query journals
    const sjRes = await pool.query(
      "SELECT id FROM journals WHERE organization_id = $1 AND journal_type = 'sales'",
      [orgId]
    );
    const salesJournalId = sjRes.rows[0].id;

    const osjRes = await pool.query(
      "SELECT id FROM journals WHERE organization_id = $1 AND journal_type = 'sales'",
      [otherOrgId]
    );
    const otherSalesJournalId = osjRes.rows[0].id;

    const pjRes = await pool.query(
      "SELECT id FROM journals WHERE organization_id = $1 AND journal_type = 'purchase'",
      [orgId]
    );
    const purchaseJournalId = pjRes.rows[0].id;

    // 6. Create test customer invoice
    const invRes = await pool.query(
      `INSERT INTO customer_invoices (
         organization_id, customer_contact_id, invoice_number, invoice_date, due_date,
         untaxed_amount, tax_amount, total_amount, amount_paid, amount_due, journal_id, status
       )
       VALUES ($1, $2, 'INV/2026/00099', '2026-06-01', '2026-06-30', 20000, 3600, 23600, 0, 23600, $3, 'posted')
       RETURNING id`,
      [orgId, customerContactId, salesJournalId]
    );
    testInvoiceId = invRes.rows[0].id;

    // Foreign org invoice
    const otherInvRes = await pool.query(
      `INSERT INTO customer_invoices (
         organization_id, customer_contact_id, invoice_number, invoice_date, due_date,
         untaxed_amount, tax_amount, total_amount, amount_paid, amount_due, journal_id, status
       )
       VALUES ($1, $2, 'INV/2026/00100', '2026-06-01', '2026-06-30', 10000, 1800, 11800, 0, 11800, $3, 'posted')
       RETURNING id`,
      [otherOrgId, otherOrgContactId, otherSalesJournalId]
    );
    otherInvoiceId = otherInvRes.rows[0].id;

    // Vendor bill
    const billRes = await pool.query(
      `INSERT INTO vendor_bills (
         organization_id, vendor_contact_id, bill_number, bill_date, due_date,
         untaxed_amount, tax_amount, total_amount, amount_paid, amount_due, journal_id, status
       )
       VALUES ($1, $2, 'BILL/2026/00088', '2026-05-15', '2026-06-15', 15000, 2700, 17700, 0, 17700, $3, 'posted')
       RETURNING id`,
      [orgId, vendorContactId, purchaseJournalId]
    );
    testBillId = billRes.rows[0].id;
  });



  describe('Contact Portal Scoping & Access Control', () => {
    it('customer sees only their own invoices', async () => {
      const res = await asCustomer(request(app).get('/api/portal/invoices'));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].id).toBe(testInvoiceId);
    });

    it('returns 404 when customer attempts to access an invoice belonging to another contact/org', async () => {
      const res = await asCustomer(request(app).get(`/api/portal/invoices/${otherInvoiceId}`));
      expect(res.status).toBe(404);
    });

    it('vendor can view their bills statement', async () => {
      const res = await asVendor(request(app).get('/api/portal/bills'));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].id).toBe(testBillId);
    });

    it('vendor calling customer invoice endpoints is refused with 403', async () => {
      const res = await asVendor(request(app).get('/api/portal/invoices'));
      expect(res.status).toBe(403);
    });

    it('vendor calling pay-intent gets 403 (organization pays vendors, not the reverse)', async () => {
      const res = await asVendor(
        request(app).post(`/api/portal/invoices/${testInvoiceId}/pay-intent`)
      );
      expect(res.status).toBe(403);
    });

    it('contact role is refused with 403 on internal accounting endpoints', async () => {
      const res = await asCustomer(request(app).get('/api/accounts'));
      expect(res.status).toBe(403);
    });
  });

  describe('Card Payment Flow & Idempotency', () => {
    let orderId;
    let paymentId;
    let signature;

    it('creates pay-intent using DB amount (23600.00), ignoring any client payload', async () => {
      const res = await asCustomer(
        request(app)
          .post(`/api/portal/invoices/${testInvoiceId}/pay-intent`)
          .send({ amount: '1.00' }) // Attempt to tamper amount
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe('23600.00'); // Strictly DB amount!
      expect(res.body.data.gatewayOrderId).toBeDefined();

      orderId = res.body.data.gatewayOrderId;
      paymentId = `pay_sim_${Date.now()}`;
      signature = 'sim_sig_valid';
    });

    it('rejects tampered or invalid signature without posting to ledger', async () => {
      const res = await asCustomer(
        request(app)
          .post('/api/portal/payments/verify')
          .send({
            invoiceId: testInvoiceId,
            orderId: 'invalid_order',
            paymentId: 'invalid_payment',
            signature: 'invalid_signature_hash',
          })
      );

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      // Verify invoice is untouched
      const invRes = await pool.query(
        'SELECT status, amount_due FROM customer_invoices WHERE id = $1',
        [testInvoiceId]
      );
      expect(invRes.rows[0].status).toBe('posted');
      expect(Number(invRes.rows[0].amount_due)).toBe(23600);
    });

    it('successfully processes valid payment, updates invoice to paid, and posts journal entry', async () => {
      const res = await asCustomer(
        request(app)
          .post('/api/portal/payments/verify')
          .send({
            invoiceId: testInvoiceId,
            orderId,
            paymentId,
            signature,
          })
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('paid');
      expect(res.body.data.paymentNumber).toContain('PAY/');

      // Verify invoice updated to 'paid' and amount_due = 0
      const invRes = await pool.query(
        'SELECT status, amount_paid, amount_due FROM customer_invoices WHERE id = $1',
        [testInvoiceId]
      );
      expect(invRes.rows[0].status).toBe('paid');
      expect(Number(invRes.rows[0].amount_due)).toBe(0);

      // Verify payment was recorded in payments table
      const payRes = await pool.query(
        'SELECT * FROM payments WHERE gateway_payment_id = $1',
        [paymentId]
      );
      expect(payRes.rows.length).toBe(1);
      expect(payRes.rows[0].payment_method).toBe('card');

      // Verify double-entry posting: Dr Clearing / Cr Debtors
      const linesRes = await pool.query(
        `SELECT l.debit, l.credit, a.name AS account_name
           FROM journal_entry_lines l
           JOIN accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = $1`,
        [payRes.rows[0].journal_entry_id]
      );
      expect(linesRes.rows.length).toBe(2);
      const debitLine = linesRes.rows.find((l) => Number(l.debit) > 0);
      const creditLine = linesRes.rows.find((l) => Number(l.credit) > 0);
      expect(debitLine.account_name).toContain('Clearing');
      expect(creditLine.account_name).toContain('Debtors');
    });

    it('handles idempotent replay (same gateway_payment_id returns success without double-crediting)', async () => {
      const res = await asCustomer(
        request(app)
          .post('/api/portal/payments/verify')
          .send({
            invoiceId: testInvoiceId,
            orderId,
            paymentId, // Same paymentId!
            signature,
          })
      );

      expect(res.status).toBe(200);
      expect(res.body.data.alreadyProcessed).toBe(true);

      // Verify payment row count is STILL 1
      const countRes = await pool.query(
        'SELECT COUNT(*)::integer AS total FROM payments WHERE gateway_payment_id = $1',
        [paymentId]
      );
      expect(countRes.rows[0].total).toBe(1);
    });
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM payment_allocations WHERE invoice_id IN ($1, $2)', [testInvoiceId, otherInvoiceId]);
      await pool.query('DELETE FROM payments WHERE gateway_payment_id = $1', [paymentId]);
      await pool.query('DELETE FROM customer_invoices WHERE id IN ($1, $2)', [testInvoiceId, otherInvoiceId]);
      await pool.query('DELETE FROM vendor_bills WHERE id = $1', [testBillId]);
    } catch {
      // Ignore cleanup error
    }
  });
});
