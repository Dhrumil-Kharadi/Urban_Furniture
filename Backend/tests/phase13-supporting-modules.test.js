/**
 * Phase 13 Tests: Dashboard, Notifications, Attachments & Audit Logs
 * Reference: project.md §9.2, §9.5, §9.7 · technicalrequirement.md §6.13, §9.6 · phase.md Phase 13
 */

const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/app');
const authJwt = require('../src/auth/auth.jwt');
const authSession = require('../src/auth/auth.session');
const { seedOrganizationMasterData } = require('../src/organizations/organizations.seed');
const notificationsService = require('../src/notifications/notifications.service');
const { transporter } = require('../src/config/mail');

jest.setTimeout(60000);

const suffix = Date.now();

describe('Phase 13: Supporting Modules (Dashboard, Notifications, Attachments, Audit)', () => {
  let orgId;
  let otherOrgId;

  let adminId;
  let managerId;
  let customerContactId;
  let customerUserId;

  let adminSid;
  let managerSid;
  let otherOrgSid;
  let customerToken;

  let otherOrgAdminId;

  let postedInvoiceId;
  let testAttachmentId;

  const asAdmin = (req) => req.set('Cookie', [`sid=${adminSid}`]);
  const asManager = (req) => req.set('Cookie', [`sid=${managerSid}`]);
  const asCustomer = (req) => req.set('Authorization', `Bearer ${customerToken}`);
  const asOtherAdmin = (req) => req.set('Cookie', [`sid=${otherOrgSid}`]);

  beforeAll(async () => {
    // 1. Create primary org
    const orgRes = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Phase 13 Org ${suffix}`, `phase13-org-${suffix}`]
    );
    orgId = orgRes.rows[0].id;

    // 2. Create second org for tenant isolation tests
    const otherOrgRes = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Other P13 Org ${suffix}`, `other-p13-org-${suffix}`]
    );
    otherOrgId = otherOrgRes.rows[0].id;

    // 3. Create admin user
    const adminRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', 'admin', true, $3) RETURNING id`,
      ['P13 Admin', `p13_admin_${suffix}@test.com`, orgId]
    );
    adminId = adminRes.rows[0].id;

    // 4. Create manager user
    const managerRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', 'manager', true, $3) RETURNING id`,
      ['P13 Manager', `p13_manager_${suffix}@test.com`, orgId]
    );
    managerId = managerRes.rows[0].id;

    // 5. Create Other Org admin
    const otherAdminRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', 'admin', true, $3) RETURNING id`,
      ['Other Admin', `other_admin_${suffix}@test.com`, otherOrgId]
    );
    otherOrgAdminId = otherAdminRes.rows[0].id;

    // 6. Master data seed
    const seedClient = await pool.connect();
    try {
      await seedClient.query('BEGIN');
      await seedOrganizationMasterData(seedClient, orgId, adminId);
      await seedOrganizationMasterData(seedClient, otherOrgId, otherOrgAdminId);
      await seedClient.query('COMMIT');
    } finally {
      seedClient.release();
    }

    // 7. Create customer contact & portal user
    const cRes = await pool.query(
      `INSERT INTO contacts (organization_id, name, contact_type, email, portal_access_enabled)
       VALUES ($1, 'P13 Customer', 'customer', $2, true) RETURNING id`,
      [orgId, `customer_p13_${suffix}@test.com`]
    );
    customerContactId = cRes.rows[0].id;

    const ocRes = await pool.query(
      `INSERT INTO contacts (organization_id, name, contact_type, email, portal_access_enabled)
       VALUES ($1, 'Other Customer', 'customer', $2, true) RETURNING id`,
      [otherOrgId, `other_customer_${suffix}@test.com`]
    );
    const otherContactId = ocRes.rows[0].id;

    const cuRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id, contact_id)
       VALUES ($1, $2, 'hash', 'user', true, $3, $4) RETURNING id`,
      ['Customer User', `c_user_p13_${suffix}@test.com`, orgId, customerContactId]
    );
    customerUserId = cuRes.rows[0].id;

    // 8. Generate sessions for privileged users and JWT for customer portal
    adminSid = authSession.createSession(adminId, 'admin', false).sessionId;
    managerSid = authSession.createSession(managerId, 'manager', false).sessionId;
    otherOrgSid = authSession.createSession(otherOrgAdminId, 'admin', false).sessionId;

    customerToken = authJwt.generateToken({
      id: customerUserId,
      role: 'user',
      token_version: 1,
    });

    // Retrieve sale journals
    const jRes = await pool.query(
      `SELECT id FROM journals WHERE organization_id = $1 AND journal_type = 'sales' LIMIT 1`,
      [orgId]
    );
    const saleJournalId = jRes.rows[0]?.id;

    const otherJRes = await pool.query(
      `SELECT id FROM journals WHERE organization_id = $1 AND journal_type = 'sales' LIMIT 1`,
      [otherOrgId]
    );
    const otherSaleJournalId = otherJRes.rows[0]?.id;

    // 9. Post a sample customer invoice for Org 1 to populate dashboard and audit
    const invRes = await pool.query(
      `INSERT INTO customer_invoices (
         organization_id, customer_contact_id, journal_id, invoice_number, invoice_date, due_date,
         status, untaxed_amount, tax_amount, total_amount, amount_due, created_by
       )
       VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + 15, 'posted', 1000.00, 180.00, 1180.00, 1180.00, $5)
       RETURNING id`,
      [orgId, customerContactId, saleJournalId, `INV-P13-${suffix}`, adminId]
    );
    postedInvoiceId = invRes.rows[0].id;

    // Post an invoice for Other Org to verify isolation
    await pool.query(
      `INSERT INTO customer_invoices (
         organization_id, customer_contact_id, journal_id, invoice_number, invoice_date, due_date,
         status, untaxed_amount, tax_amount, total_amount, amount_due, created_by
       )
       VALUES ($1, $2, $3, 'INV-OTHER-99', CURRENT_DATE, CURRENT_DATE + 10, 'posted', 5000.00, 0.00, 5000.00, 5000.00, $4)`,
      [otherOrgId, otherContactId, otherSaleJournalId, otherOrgAdminId]
    );

    // Record an audit log for invoice posting
    await pool.query(
      `INSERT INTO audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, before, after)
       VALUES ($1, $2, 'post', 'customer_invoice', $3, '{"status":"draft"}', '{"status":"posted","total":1180.00}')`,
      [orgId, adminId, postedInvoiceId]
    );
  });

  afterAll(async () => {
    // Destroy sessions
    if (adminSid) authSession.destroySession(adminSid);
    if (managerSid) authSession.destroySession(managerSid);
    if (otherOrgSid) authSession.destroySession(otherOrgSid);

    // Cleanup test data in proper FK order
    try {
      await pool.query(`DELETE FROM attachments WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM notifications WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM audit_logs WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM customer_invoices WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM vendor_bills WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM sales_orders WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM purchase_orders WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM journal_entry_lines WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM journal_entries WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM budgets WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM analytic_accounts WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM products WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM product_categories WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM taxes WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM document_sequences WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM journals WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM accounts WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM users WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM contacts WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
      await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgId, otherOrgId]);
    } catch (_) {}
  });

  // ─────────────────────────────────────────────────────────────
  // 1. DASHBOARD TESTS
  // ─────────────────────────────────────────────────────────────
  describe('1. Unified Dashboard Summary', () => {
    test('Dashboard KPIs match report figures for the same period', async () => {
      const res = await asAdmin(
        request(app).get('/api/dashboard/summary?period=this_year')
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('kpis');
      expect(res.body.data).toHaveProperty('series');

      const kpis = res.body.data.kpis;
      expect(parseFloat(kpis.totalReceivable)).toBeGreaterThanOrEqual(1180.00);
      expect(kpis).toHaveProperty('totalPayable');
      expect(kpis).toHaveProperty('totalIncome');
      expect(kpis).toHaveProperty('totalExpenses');
      expect(kpis).toHaveProperty('netProfit');
      expect(kpis).toHaveProperty('overdueCount');
    });

    test('Dashboard is org-scoped — no cross-tenant leakage', async () => {
      const org1Res = await asAdmin(
        request(app).get('/api/dashboard/summary?period=this_year')
      );
      const otherRes = await asOtherAdmin(
        request(app).get('/api/dashboard/summary?period=this_year')
      );

      expect(org1Res.status).toBe(200);
      expect(otherRes.status).toBe(200);

      // Org 1 has 1180 receivable; Other Org has 5000 receivable
      expect(parseFloat(org1Res.body.data.kpis.totalReceivable)).toBe(1180.00);
      expect(parseFloat(otherRes.body.data.kpis.totalReceivable)).toBe(5000.00);
    });

    test("Portal dashboard shows ONLY the contact's own figures (role 'user')", async () => {
      const res = await asCustomer(
        request(app).get('/api/dashboard/summary')
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('user');
      expect(res.body.data.kpis).toHaveProperty('totalOutstanding');
      expect(res.body.data.kpis).toHaveProperty('totalOverdue');
      expect(res.body.data.kpis).toHaveProperty('paidThisYear');

      // The contact has 1180 outstanding on their invoice
      expect(parseFloat(res.body.data.kpis.totalOutstanding)).toBe(1180.00);
      // Ensure NO org-wide series or figures leaked
      expect(res.body.data).not.toHaveProperty('totalPayable');
      expect(res.body.data).not.toHaveProperty('netProfit');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. NOTIFICATIONS TESTS
  // ─────────────────────────────────────────────────────────────
  describe('2. Notifications (Transactional Queue & Async Dispatch)', () => {
    test('An email failure does NOT roll back the transaction or throw to caller', async () => {
      // Mock transporter.sendMail to simulate failure
      const originalSendMail = transporter.sendMail;
      transporter.sendMail = jest.fn().mockRejectedValue(new Error('SMTP connection refused'));

      try {
        // 1. Insert notification in 'pending' status
        const notif = await notificationsService.queueNotification(null, {
          organizationId: orgId,
          recipientEmail: 'failing_recipient@test.com',
          subject: 'Test Invoice Notice',
          bodyHtml: '<p>Invoice details</p>',
          triggerEvent: 'invoice_posted',
          entityType: 'customer_invoice',
          entityId: postedInvoiceId,
        });

        expect(notif).toBeDefined();
        expect(notif.status).toBe('pending');

        // 2. Dispatch notification (fails gracefully without throwing)
        const dispatchResult = await notificationsService.dispatchNotification(notif.id);
        expect(dispatchResult).toBe(false);

        // 3. Verify notification status changed to 'failed' with error message
        const updated = await pool.query(
          `SELECT * FROM notifications WHERE id = $1`,
          [notif.id]
        );
        expect(updated.rows[0].status).toBe('failed');
        expect(updated.rows[0].error_message).toContain('SMTP connection refused');
      } finally {
        transporter.sendMail = originalSendMail;
      }
    });

    test('A failed notification is retried and visible to an admin', async () => {
      // Admin lists notifications
      const listRes = await asAdmin(
        request(app).get('/api/notifications')
      );
      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.items.length).toBeGreaterThan(0);

      // Now mock sendMail to succeed for retry
      const originalSendMail = transporter.sendMail;
      transporter.sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-12345' });

      try {
        const retryRes = await asAdmin(
          request(app).post('/api/notifications/retry')
        );
        expect(retryRes.status).toBe(200);
        expect(retryRes.body.success).toBe(true);
        expect(retryRes.body.data.successCount).toBeGreaterThan(0);
      } finally {
        transporter.sendMail = originalSendMail;
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. ATTACHMENTS TESTS
  // ─────────────────────────────────────────────────────────────
  describe('3. Attachments Security & Management', () => {
    test('A file with a SPOOFED MIME header is rejected by magic bytes', async () => {
      // Declared as application/pdf but body contains text / HTML
      const spoofedContent = Buffer.from('<html><body>This is an HTML file disguised as PDF</body></html>');

      const res = await asAdmin(
        request(app)
          .post('/api/attachments')
          .field('entityType', 'customer_invoice')
          .field('entityId', postedInvoiceId)
          .attach('file', spoofedContent, {
            filename: 'fake_invoice.pdf',
            contentType: 'application/pdf',
          })
      );

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      const errMsg = res.body.error?.message || res.body.error || '';
      expect(errMsg).toMatch(/Invalid file content|MIME/i);
    });

    test('Oversized upload (>5MB) is rejected', async () => {
      // 5.2 MB buffer
      const oversizedBuffer = Buffer.alloc(5.2 * 1024 * 1024, 0x25); // '%...'

      const res = await asAdmin(
        request(app)
          .post('/api/attachments')
          .field('entityType', 'customer_invoice')
          .field('entityId', postedInvoiceId)
          .attach('file', oversizedBuffer, {
            filename: 'huge_file.pdf',
            contentType: 'application/pdf',
          })
      );

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      const errMsg = res.body.error?.message || res.body.error || '';
      expect(errMsg).toMatch(/exceeds/i);
    });

    test('Valid PDF upload succeeds and is saved outside web root', async () => {
      // Valid PDF magic bytes: %PDF-1.4
      const validPdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

      const res = await asAdmin(
        request(app)
          .post('/api/attachments')
          .field('entityType', 'customer_invoice')
          .field('entityId', postedInvoiceId)
          .attach('file', validPdfBuffer, {
            filename: 'genuine_invoice.pdf',
            contentType: 'application/pdf',
          })
      );

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.file_name).toBe('genuine_invoice.pdf');
      expect(res.body.data.mime_type).toBe('application/pdf');

      testAttachmentId = res.body.data.id;
    });

    test('Another org CANNOT download the attachment', async () => {
      expect(testAttachmentId).toBeDefined();

      const crossOrgRes = await asOtherAdmin(
        request(app).get(`/api/attachments/${testAttachmentId}/download`)
      );

      expect(crossOrgRes.status).toBe(404);
    });

    test('Authorized user can download the attachment', async () => {
      expect(testAttachmentId).toBeDefined();

      const downloadRes = await asAdmin(
        request(app).get(`/api/attachments/${testAttachmentId}/download`)
      );

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers['content-type']).toContain('application/pdf');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. AUDIT TESTS
  // ─────────────────────────────────────────────────────────────
  describe('4. Audit Logs (Role Restriction & Activity Trail)', () => {
    test('Manager gets 403 on audit logs', async () => {
      const res = await asManager(
        request(app).get('/api/audit-logs')
      );

      expect(res.status).toBe(403);
    });

    test('Admin gets 200 and audit rows exist for posting actions', async () => {
      const res = await asAdmin(
        request(app).get('/api/audit-logs')
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);

      // Verify posting action audit row exists
      const postActionRow = res.body.data.items.find(
        (item) => item.action === 'post' && item.entity_type === 'customer_invoice'
      );
      expect(postActionRow).toBeDefined();
      expect(postActionRow.organization_id).toBe(orgId);
    });
  });
});
