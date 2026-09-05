const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/app');
const authSession = require('../src/auth/auth.session');
const { seedOrganizationMasterData } = require('../src/organizations/organizations.seed');
const { sum, money } = require('../src/shared/money');

/**
 * Phases 9 and 10 — Sales flow and Payments. Integration.
 *
 * The starred test in here is "concurrent payments cannot overpay an invoice".
 * It runs genuinely in parallel through Promise.all, because run sequentially
 * it would pass with the row lock removed and prove nothing.
 *
 * Run with:  npx jest tests/phase9-10-integration.test.js --runInBand
 */

jest.setTimeout(60000);

const suffix = Date.now();

describe('Phases 9 & 10: Sales and Payments', () => {
  let orgA;
  let orgB;
  let adminA;
  let managerA;
  let adminB;
  let adminASid;
  let managerASid;
  let adminBSid;

  let customerA;
  let productA;
  let salesJournalA;
  let bankJournalA;
  let cashJournalA;
  let bankAccountA;
  let cashAccountA;
  let incomeAccountA;
  let salesTaxA;

  async function makeOrg(label) {
    const res = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`P910 ${label} ${suffix}`, `p910-${label.toLowerCase()}-${suffix}`]
    );
    return res.rows[0].id;
  }

  async function makeUser(orgId, role, label) {
    const res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', $3, true, $4) RETURNING id`,
      [`P910 ${label}`, `p910_${label}_${suffix}@example.com`, role, orgId]
    );
    return res.rows[0].id;
  }

  async function accountByCode(orgId, code) {
    const res = await pool.query(
      'SELECT id FROM accounts WHERE organization_id = $1 AND code = $2', [orgId, code]
    );
    return res.rows[0].id;
  }

  async function journalByType(orgId, type) {
    const res = await pool.query(
      'SELECT id FROM journals WHERE organization_id = $1 AND journal_type = $2 LIMIT 1',
      [orgId, type]
    );
    return res.rows[0].id;
  }

  beforeAll(async () => {
    orgA = await makeOrg('OrgA');
    orgB = await makeOrg('OrgB');
    adminA = await makeUser(orgA, 'business_owner', 'adminA');
    managerA = await makeUser(orgA, 'accountant', 'managerA');
    adminB = await makeUser(orgB, 'business_owner', 'adminB');

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

    salesJournalA = await journalByType(orgA, 'sales');
    bankJournalA = await journalByType(orgA, 'bank');
    cashJournalA = await journalByType(orgA, 'cash');
    bankAccountA = await accountByCode(orgA, '1020');
    cashAccountA = await accountByCode(orgA, '1010');
    incomeAccountA = await accountByCode(orgA, '4010');

    const contact = await pool.query(
      `INSERT INTO contacts (organization_id, name, contact_type, email, status, created_by, updated_by)
       VALUES ($1, $2, 'customer', $3, 'active', $4, $4) RETURNING id`,
      [orgA, `Azure Furniture ${suffix}`, `azure_${suffix}@example.com`, adminA]
    );
    customerA = contact.rows[0].id;

    const tax = await pool.query(
      `INSERT INTO taxes (organization_id, name, rate, tax_scope, tax_account_id, created_by, updated_by)
       VALUES ($1, $2, 18, 'both', $3, $4, $4) RETURNING id`,
      [orgA, `GST18 ${suffix}`, await accountByCode(orgA, '2020'), adminA]
    );
    salesTaxA = tax.rows[0].id;

    const product = await pool.query(
      `INSERT INTO products (organization_id, name, product_type, sales_price, cost_price,
                             sales_tax_id, income_account_id, created_by, updated_by)
       VALUES ($1, $2, 'goods', 1000.00, 600.00, $3, $4, $5, $5) RETURNING id`,
      [orgA, `Office Chair ${suffix}`, salesTaxA, incomeAccountA, adminA]
    );
    productA = product.rows[0].id;
  });

  afterAll(async () => {
    for (const orgId of [orgA, orgB].filter(Boolean)) {
      await pool.query('DELETE FROM payment_allocations WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM payments WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM customer_invoice_lines WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM customer_invoices WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM sales_order_lines WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM sales_orders WHERE organization_id = $1', [orgId]);

      for (const t of ['trg_journal_entries_immutable', 'trg_journal_entries_balanced']) {
        await pool.query(`ALTER TABLE journal_entries DISABLE TRIGGER ${t}`);
      }
      for (const t of ['trg_journal_entry_lines_immutable', 'trg_journal_entry_lines_balanced']) {
        await pool.query(`ALTER TABLE journal_entry_lines DISABLE TRIGGER ${t}`);
      }
      await pool.query('UPDATE journal_entries SET reversed_by_entry_id = NULL WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM journal_entry_lines WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM journal_entries WHERE organization_id = $1', [orgId]);
      for (const t of ['trg_journal_entries_immutable', 'trg_journal_entries_balanced']) {
        await pool.query(`ALTER TABLE journal_entries ENABLE TRIGGER ${t}`);
      }
      for (const t of ['trg_journal_entry_lines_immutable', 'trg_journal_entry_lines_balanced']) {
        await pool.query(`ALTER TABLE journal_entry_lines ENABLE TRIGGER ${t}`);
      }

      await pool.query('DELETE FROM audit_logs WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM document_sequences WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM products WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM taxes WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM contacts WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM journals WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM accounts WHERE organization_id = $1', [orgId]);
      await pool.query('UPDATE users SET organization_id = NULL WHERE organization_id = $1', [orgId]);
      await pool.query('UPDATE organizations SET created_by = NULL, updated_by = NULL WHERE id = $1', [orgId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    }
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`p910_%_${suffix}@example.com`]);
    await pool.end();
  });

  const asAdminA = (req) => req.set('Cookie', [`sid=${adminASid}`]);
  const asManagerA = (req) => req.set('Cookie', [`sid=${managerASid}`]);
  const asAdminB = (req) => req.set('Cookie', [`sid=${adminBSid}`]);

  /** Create, confirm, invoice and post — the §7.3 path. Returns the invoice. */
  async function makePostedInvoice(quantity = '5') {
    const so = await asAdminA(request(app).post('/api/sales-orders')).send({
      customer_contact_id: customerA,
      order_date: '2026-05-14',
      lines: [{ product_id: productA, quantity, unit_price: '1000.00' }],
    });
    expect(so.status).toBe(201);

    const confirmed = await asAdminA(
      request(app).post(`/api/sales-orders/${so.body.data.salesOrder.id}/confirm`)
    );
    expect(confirmed.status).toBe(200);

    const invoiced = await asAdminA(
      request(app).post(`/api/sales-orders/${so.body.data.salesOrder.id}/create-invoice`)
    ).send({ journal_id: salesJournalA, invoice_date: '2026-05-15', due_date: '2026-06-15' });
    expect(invoiced.status).toBe(201);

    const posted = await asAdminA(
      request(app).post(`/api/customer-invoices/${invoiced.body.data.invoice.id}/post`)
    );
    expect(posted.status).toBe(200);

    return posted.body.data.invoice;
  }

  // ─────────────────────────────────────────────────────────────────────────
  describe('1. Sales order lifecycle — project.md §5.2.2', () => {
    let soId;

    test('draft → confirmed → invoiced', async () => {
      const created = await asAdminA(request(app).post('/api/sales-orders')).send({
        customer_contact_id: customerA,
        order_date: '2026-05-14',
        lines: [{ product_id: productA, quantity: '5', unit_price: '1000.00' }],
      });

      expect(created.status).toBe(201);
      expect(created.body.data.salesOrder.status).toBe('draft');
      // 5 x 1000 = 5000 untaxed, 18% = 900 tax, 5900 total.
      expect(created.body.data.salesOrder.total_amount).toBe('5900.00');
      soId = created.body.data.salesOrder.id;

      const confirmed = await asAdminA(request(app).post(`/api/sales-orders/${soId}/confirm`));
      expect(confirmed.status).toBe(200);
      expect(confirmed.body.data.salesOrder.status).toBe('confirmed');
      expect(confirmed.body.data.salesOrder.so_number).toMatch(/^SO\/2026\/\d{5}$/);

      const invoiced = await asAdminA(
        request(app).post(`/api/sales-orders/${soId}/create-invoice`)
      ).send({ journal_id: salesJournalA, invoice_date: '2026-05-15' });
      expect(invoiced.status).toBe(201);
      expect(invoiced.body.data.invoice.status).toBe('draft');

      const after = await asAdminA(request(app).get(`/api/sales-orders/${soId}`));
      expect(after.body.data.salesOrder.status).toBe('invoiced');
    });

    test('an already-invoiced order cannot be invoiced again — 409', async () => {
      const again = await asAdminA(
        request(app).post(`/api/sales-orders/${soId}/create-invoice`)
      ).send({ journal_id: salesJournalA, invoice_date: '2026-05-15' });

      expect(again.status).toBe(409);
    });

    test('a non-draft order cannot be edited', async () => {
      const edit = await asAdminA(request(app).patch(`/api/sales-orders/${soId}`))
        .send({ notes: 'sneaky edit' });
      expect(edit.status).toBe(409);
    });

    test('client-supplied totals are ignored; the server recomputes', async () => {
      const created = await asAdminA(request(app).post('/api/sales-orders')).send({
        customer_contact_id: customerA,
        order_date: '2026-05-14',
        total_amount: '1.00',
        untaxed_amount: '1.00',
        tax_amount: '0.00',
        lines: [{ product_id: productA, quantity: '2', unit_price: '1000.00' }],
      });

      expect(created.status).toBe(201);
      // 2 x 1000 + 18% = 2360, not the 1.00 the client claimed.
      expect(created.body.data.salesOrder.total_amount).toBe('2360.00');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('2. Invoice posting — the journal must match project.md §5.2.4', () => {
    let invoice;

    test('posting produces Dr Debtors / Cr Income / Cr Output Tax exactly', async () => {
      invoice = await makePostedInvoice('5');

      expect(invoice.status).toBe('posted');
      expect(invoice.invoice_number).toMatch(/^INV\/2026\/\d{5}$/);
      expect(invoice.amount_due).toBe('5900.00');

      const entry = await pool.query(
        `SELECT l.debit, l.credit, a.code
           FROM journal_entry_lines l
           JOIN accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = $1
          ORDER BY l.line_no`,
        [invoice.journal_entry_id]
      );

      const byCode = {};
      for (const row of entry.rows) byCode[row.code] = row;

      // Dr Debtors the full taxed total.
      expect(byCode['1030'].debit).toBe('5900.00');
      // Cr Sale Income the UNTAXED amount only.
      expect(byCode['4010'].credit).toBe('5000.00');
      // Cr Output Tax Payable — its own account, NOT folded into income.
      expect(byCode['2020'].credit).toBe('900.00');

      expect(sum(entry.rows.map((r) => r.debit))).toBe(sum(entry.rows.map((r) => r.credit)));
    });

    test('tax lands on Output Tax Payable, never on Sale Income', async () => {
      const lines = await pool.query(
        `SELECT a.code, l.credit FROM journal_entry_lines l
           JOIN accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = $1 AND a.code = '4010'`,
        [invoice.journal_entry_id]
      );
      // 5000, not 5900. If tax were folded in, revenue would be overstated.
      expect(lines.rows[0].credit).toBe('5000.00');
    });

    test('a posted invoice cannot be posted twice', async () => {
      const again = await asAdminA(request(app).post(`/api/customer-invoices/${invoice.id}/post`));
      expect(again.status).toBe(409);
    });

    test('a posted invoice cannot be edited', async () => {
      const edit = await asAdminA(request(app).patch(`/api/customer-invoices/${invoice.id}`))
        .send({ notes: 'after the fact' });
      expect(edit.status).toBe(409);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('3. Payments', () => {
    test('a full payment sets the invoice to paid', async () => {
      const invoice = await makePostedInvoice('1'); // 1180.00

      const payment = await asAdminA(request(app).post('/api/payments')).send({
        contact_id: customerA,
        direction: 'inbound',
        method: 'bank',
        payment_date: '2026-05-20',
        amount: invoice.total_amount,
        journal_id: bankJournalA,
        cash_account_id: bankAccountA,
        allocations: [
          { customer_invoice_id: invoice.id, allocated_amount: invoice.total_amount },
        ],
      });

      expect(payment.status).toBe(201);
      expect(payment.body.data.payment.payment_number).toMatch(/^PAY\/2026\/\d{5}$/);

      const after = await asAdminA(request(app).get(`/api/customer-invoices/${invoice.id}`));
      expect(after.body.data.invoice.status).toBe('paid');
      expect(after.body.data.invoice.amount_due).toBe('0.00');
    });

    test('a partial payment sets partially_paid, and two partials reach paid', async () => {
      const invoice = await makePostedInvoice('1'); // 1180.00

      const first = await asAdminA(request(app).post('/api/payments')).send({
        contact_id: customerA, direction: 'inbound', method: 'bank',
        payment_date: '2026-05-20', amount: '500.00',
        journal_id: bankJournalA, cash_account_id: bankAccountA,
        allocations: [{ customer_invoice_id: invoice.id, allocated_amount: '500.00' }],
      });
      expect(first.status).toBe(201);

      let after = await asAdminA(request(app).get(`/api/customer-invoices/${invoice.id}`));
      expect(after.body.data.invoice.status).toBe('partially_paid');
      expect(after.body.data.invoice.amount_due).toBe('680.00');

      const second = await asAdminA(request(app).post('/api/payments')).send({
        contact_id: customerA, direction: 'inbound', method: 'bank',
        payment_date: '2026-05-21', amount: '680.00',
        journal_id: bankJournalA, cash_account_id: bankAccountA,
        allocations: [{ customer_invoice_id: invoice.id, allocated_amount: '680.00' }],
      });
      expect(second.status).toBe(201);

      after = await asAdminA(request(app).get(`/api/customer-invoices/${invoice.id}`));
      expect(after.body.data.invoice.status).toBe('paid');
      expect(after.body.data.invoice.amount_due).toBe('0.00');
    });

    test('★ CONCURRENT PAYMENTS ON ONE INVOICE CANNOT OVERPAY IT', async () => {
      const invoice = await makePostedInvoice('1'); // 1180.00

      // Six payments of 1000 fired genuinely in parallel against a 1180
      // balance. Without SELECT ... FOR UPDATE all six read amount_due = 1180,
      // all six decide 1000 fits, and the invoice ends up paid 6000.
      const attempt = () =>
        asAdminA(request(app).post('/api/payments')).send({
          contact_id: customerA, direction: 'inbound', method: 'bank',
          payment_date: '2026-05-22', amount: '1000.00',
          journal_id: bankJournalA, cash_account_id: bankAccountA,
          allocations: [{ customer_invoice_id: invoice.id, allocated_amount: '1000.00' }],
        });

      const results = await Promise.all(Array.from({ length: 6 }, attempt));

      const accepted = results.filter((r) => r.status === 201);
      const refused = results.filter((r) => r.status !== 201);

      // Exactly one can fit; the rest must be refused for exceeding the balance.
      expect(accepted).toHaveLength(1);
      expect(refused).toHaveLength(5);
      for (const r of refused) {
        expect(r.status).toBe(400);
        expect(JSON.stringify(r.body)).toMatch(/exceeds/i);
      }

      const after = await asAdminA(request(app).get(`/api/customer-invoices/${invoice.id}`));
      const final = after.body.data.invoice;

      // The invariant, stated plainly: never more paid than the total.
      expect(money(final.amount_paid).greaterThan(money(final.total_amount))).toBe(false);
      expect(final.amount_paid).toBe('1000.00');
      expect(final.amount_due).toBe('180.00');
      expect(final.status).toBe('partially_paid');
    });

    test('an allocation exceeding amount_due is rejected', async () => {
      const invoice = await makePostedInvoice('1'); // 1180.00

      const res = await asAdminA(request(app).post('/api/payments')).send({
        contact_id: customerA, direction: 'inbound', method: 'bank',
        payment_date: '2026-05-20', amount: '2000.00',
        journal_id: bankJournalA, cash_account_id: bankAccountA,
        allocations: [{ customer_invoice_id: invoice.id, allocated_amount: '2000.00' }],
      });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/exceeds/i);
    });

    test('allocations that do not sum to the payment amount are rejected', async () => {
      const invoice = await makePostedInvoice('1');

      const res = await asAdminA(request(app).post('/api/payments')).send({
        contact_id: customerA, direction: 'inbound', method: 'bank',
        payment_date: '2026-05-20', amount: '1000.00',
        journal_id: bankJournalA, cash_account_id: bankAccountA,
        allocations: [{ customer_invoice_id: invoice.id, allocated_amount: '400.00' }],
      });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/must match/i);
    });

    test('a cash method with a BANK journal is rejected', async () => {
      const invoice = await makePostedInvoice('1');

      const res = await asAdminA(request(app).post('/api/payments')).send({
        contact_id: customerA, direction: 'inbound',
        method: 'cash',
        payment_date: '2026-05-20', amount: '100.00',
        journal_id: bankJournalA,
        cash_account_id: cashAccountA,
        allocations: [{ customer_invoice_id: invoice.id, allocated_amount: '100.00' }],
      });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/cash journal/i);
    });

    test('the payment entry is Dr Cash/Bank, Cr Debtors', async () => {
      const invoice = await makePostedInvoice('1');

      const payment = await asAdminA(request(app).post('/api/payments')).send({
        contact_id: customerA, direction: 'inbound', method: 'cash',
        payment_date: '2026-05-20', amount: '100.00',
        journal_id: cashJournalA, cash_account_id: cashAccountA,
        allocations: [{ customer_invoice_id: invoice.id, allocated_amount: '100.00' }],
      });
      expect(payment.status).toBe(201);

      const lines = await pool.query(
        `SELECT a.code, l.debit, l.credit FROM journal_entry_lines l
           JOIN accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = $1`,
        [payment.body.data.payment.journal_entry_id]
      );

      const byCode = {};
      for (const row of lines.rows) byCode[row.code] = row;

      expect(byCode['1010'].debit).toBe('100.00');   // Dr Cash
      expect(byCode['1030'].credit).toBe('100.00');  // Cr Debtors
    });

    test('cancel reverses the entry and restores amount_due exactly', async () => {
      const invoice = await makePostedInvoice('1'); // 1180.00
      const dueBefore = invoice.amount_due;

      const payment = await asAdminA(request(app).post('/api/payments')).send({
        contact_id: customerA, direction: 'inbound', method: 'bank',
        payment_date: '2026-05-20', amount: '600.00',
        journal_id: bankJournalA, cash_account_id: bankAccountA,
        allocations: [{ customer_invoice_id: invoice.id, allocated_amount: '600.00' }],
      });
      expect(payment.status).toBe(201);

      const cancelled = await asAdminA(
        request(app).post(`/api/payments/${payment.body.data.payment.id}/cancel`)
      );
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.payment.status).toBe('cancelled');

      const after = await asAdminA(request(app).get(`/api/customer-invoices/${invoice.id}`));
      expect(after.body.data.invoice.amount_due).toBe(dueBefore);
      expect(after.body.data.invoice.amount_paid).toBe('0.00');
      expect(after.body.data.invoice.status).toBe('posted');

      // The original entry is reversed, not deleted.
      const entry = await pool.query(
        'SELECT status, reversed_by_entry_id FROM journal_entries WHERE id = $1',
        [payment.body.data.payment.journal_entry_id]
      );
      expect(entry.rows[0].status).toBe('reversed');
      expect(entry.rows[0].reversed_by_entry_id).not.toBeNull();
    });

    test('a manager cannot cancel a payment; an admin can', async () => {
      const invoice = await makePostedInvoice('1');

      const payment = await asAdminA(request(app).post('/api/payments')).send({
        contact_id: customerA, direction: 'inbound', method: 'bank',
        payment_date: '2026-05-20', amount: '100.00',
        journal_id: bankJournalA, cash_account_id: bankAccountA,
        allocations: [{ customer_invoice_id: invoice.id, allocated_amount: '100.00' }],
      });

      const byManager = await asManagerA(
        request(app).post(`/api/payments/${payment.body.data.payment.id}/cancel`)
      );
      expect(byManager.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('4. Overdue is derived, never stored', () => {
    test('isOverdue computes across the due-date boundary', async () => {
      const invoice = await makePostedInvoice('1');

      // Due yesterday and still owing → overdue.
      await pool.query(
        `UPDATE customer_invoices SET due_date = CURRENT_DATE - 1 WHERE id = $1`,
        [invoice.id]
      );
      let res = await asAdminA(request(app).get(`/api/customer-invoices/${invoice.id}`));
      expect(res.body.data.invoice.is_overdue).toBe(true);
      // The stored status is untouched — nothing writes 'overdue'.
      expect(res.body.data.invoice.status).toBe('posted');

      // Due tomorrow → not overdue.
      await pool.query(
        `UPDATE customer_invoices SET due_date = CURRENT_DATE + 1 WHERE id = $1`,
        [invoice.id]
      );
      res = await asAdminA(request(app).get(`/api/customer-invoices/${invoice.id}`));
      expect(res.body.data.invoice.is_overdue).toBe(false);

      // Due yesterday but fully paid → not overdue.
      await pool.query(
        `UPDATE customer_invoices
            SET due_date = CURRENT_DATE - 1, amount_due = 0, amount_paid = total_amount, status = 'paid'
          WHERE id = $1`,
        [invoice.id]
      );
      res = await asAdminA(request(app).get(`/api/customer-invoices/${invoice.id}`));
      expect(res.body.data.invoice.is_overdue).toBe(false);
    });

    test('the overdue filter and the computed field agree', async () => {
      const res = await asAdminA(request(app).get('/api/customer-invoices?overdue=true&limit=100'));
      expect(res.status).toBe(200);
      expect(res.body.data.items.every((i) => i.is_overdue === true)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('5. Security', () => {
    test('a cross-tenant document id returns 404, never 403', async () => {
      const invoice = await makePostedInvoice('1');

      const probes = [
        ['get', `/api/customer-invoices/${invoice.id}`],
        ['patch', `/api/customer-invoices/${invoice.id}`],
        ['post', `/api/customer-invoices/${invoice.id}/post`],
      ];

      for (const [method, path] of probes) {
        const res = await asAdminB(request(app)[method](path)).send({ notes: 'x' });
        expect({ path, status: res.status }).toEqual({ path, status: 404 });
      }
    });

    test("Org B's lists contain none of Org A's documents", async () => {
      for (const path of ['/api/sales-orders', '/api/customer-invoices', '/api/payments']) {
        const res = await asAdminB(request(app).get(`${path}?limit=100`));
        expect(res.status).toBe(200);
        expect(res.body.data.items.every((r) => r.organization_id === orgB)).toBe(true);
      }
    });

    test('a Contact gets 403 on every payment endpoint — project.md §3', async () => {
      const contactUser = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id, contact_id)
         VALUES ('Portal Contact', $1, 'hash', 'customer', true, $2, $3) RETURNING id, token_version`,
        [`p910_contact_${suffix}@example.com`, orgA, customerA]
      );

      // eslint-disable-next-line global-require
      const authJwt = require('../src/auth/auth.jwt');
      const token = authJwt.generateToken({
        id: contactUser.rows[0].id, role: 'customer', token_version: contactUser.rows[0].token_version,
      });

      for (const [method, path] of [['get', '/api/payments'], ['post', '/api/payments']]) {
        const res = await request(app)[method](path).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });

    test('every endpoint requires authentication', async () => {
      for (const path of ['/api/sales-orders', '/api/customer-invoices', '/api/payments']) {
        expect((await request(app).get(path)).status).toBe(401);
      }
    });
  });
});
