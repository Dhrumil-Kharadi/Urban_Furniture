const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/app');
const authSession = require('../src/auth/auth.session');
const { withTransaction } = require('../src/shared/withTransaction');
const accountingService = require('../src/accounting/accounting.service');
const accountingRepository = require('../src/accounting/accounting.repository');
const { seedOrganizationMasterData } = require('../src/organizations/organizations.seed');
const { sum } = require('../src/shared/money');

/**
 * Phase 7 — THE LEDGER ENGINE. Priority 1.
 *
 * If only one thing in this project is tested, it is this. Every financial
 * number the system will ever produce comes from this engine, and a bug here
 * surfaces weeks later as a wrong report, by which point every posted document
 * is suspect.
 *
 * Several of these deliberately BYPASS the application entirely and go at the
 * tables with raw SQL. The point is not to test the service twice — it is to
 * prove the database refuses on its own, because application validation can be
 * defeated by a bug and a trigger cannot.
 *
 * Run with:  npx jest tests/phase7-ledger.test.js --runInBand
 */

jest.setTimeout(60000);

const suffix = Date.now();

describe('Phase 7: Ledger engine', () => {
  let orgA;
  let orgB;
  let adminA;
  let managerA;
  let adminB;
  let adminASid;
  let managerASid;
  let adminBSid;

  let generalJournalA;
  let cashA;
  let bankA;
  let debtorsA;
  let salesIncomeA;
  let cashB;

  async function makeOrg(label) {
    const res = await pool.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month)
       VALUES ($1, $2, 'INR', 4) RETURNING id`,
      [`Phase7 ${label} ${suffix}`, `phase7-${label.toLowerCase()}-${suffix}`]
    );
    return res.rows[0].id;
  }

  async function makeUser(organizationId, role, label) {
    const res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified, organization_id)
       VALUES ($1, $2, 'hash', $3, true, $4) RETURNING id`,
      [`Phase7 ${label}`, `phase7_${label}_${suffix}@example.com`, role, organizationId]
    );
    return res.rows[0].id;
  }

  async function accountByCode(orgId, code) {
    const res = await pool.query(
      'SELECT id, code, name, account_type FROM accounts WHERE organization_id = $1 AND code = $2',
      [orgId, code]
    );
    return res.rows[0];
  }

  async function journalByType(orgId, type) {
    const res = await pool.query(
      'SELECT id, name FROM journals WHERE organization_id = $1 AND journal_type = $2 LIMIT 1',
      [orgId, type]
    );
    return res.rows[0];
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

    // The seed makes no 'general' journal, and a manual entry wants one.
    const gj = await pool.query(
      `INSERT INTO journals (organization_id, name, journal_type, sequence_prefix, status, created_by, updated_by)
       VALUES ($1, $2, 'general', 'GEN', 'active', $3, $3) RETURNING id`,
      [orgA, `General ${suffix}`, adminA]
    );
    generalJournalA = gj.rows[0].id;

    cashA = (await accountByCode(orgA, '1010')).id;
    bankA = (await accountByCode(orgA, '1020')).id;
    debtorsA = (await accountByCode(orgA, '1030')).id;
    salesIncomeA = (await accountByCode(orgA, '4010')).id;
    cashB = (await accountByCode(orgB, '1010')).id;
  });

  afterAll(async () => {
    for (const orgId of [orgA, orgB].filter(Boolean)) {
      // Disable triggers for clean test teardown
      await pool.query(`ALTER TABLE journal_entries DISABLE TRIGGER trg_journal_entries_immutable`);
      await pool.query(`ALTER TABLE journal_entry_lines DISABLE TRIGGER trg_journal_entry_lines_immutable`);
      await pool.query(`ALTER TABLE journal_entries DISABLE TRIGGER trg_journal_entries_balanced`);
      await pool.query(`ALTER TABLE journal_entry_lines DISABLE TRIGGER trg_journal_entry_lines_balanced`);

      await pool.query(
        `UPDATE journal_entries SET reversed_by_entry_id = NULL WHERE organization_id = $1`,
        [orgId]
      );
      await pool.query('DELETE FROM journal_entry_lines WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM journal_entries WHERE organization_id = $1', [orgId]);

      await pool.query(`ALTER TABLE journal_entries ENABLE TRIGGER trg_journal_entries_immutable`);
      await pool.query(`ALTER TABLE journal_entry_lines ENABLE TRIGGER trg_journal_entry_lines_immutable`);
      await pool.query(`ALTER TABLE journal_entries ENABLE TRIGGER trg_journal_entries_balanced`);
      await pool.query(`ALTER TABLE journal_entry_lines ENABLE TRIGGER trg_journal_entry_lines_balanced`);

      await pool.query('DELETE FROM audit_logs WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM document_sequences WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM analytic_accounts WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM journals WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM taxes WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM products WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM product_categories WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM contacts WHERE organization_id = $1', [orgId]);
      await pool.query('DELETE FROM accounts WHERE organization_id = $1', [orgId]);
      await pool.query('UPDATE users SET organization_id = NULL WHERE organization_id = $1', [orgId]);
      await pool.query('UPDATE organizations SET created_by = NULL, updated_by = NULL WHERE id = $1', [orgId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    }
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`phase7_%_${suffix}@example.com`]);
    await pool.end();
  });

  const asAdminA = (req) => req.set('Cookie', [`sid=${adminASid}`]);
  const asManagerA = (req) => req.set('Cookie', [`sid=${managerASid}`]);
  const asAdminB = (req) => req.set('Cookie', [`sid=${adminBSid}`]);

  /** Post a simple balanced entry through the engine. */
  async function postSimple({ amount = '100.00', date = '2026-05-14', journalId } = {}) {
    return withTransaction((client) =>
      accountingService.postJournalEntry(client, {
        organizationId: orgA,
        journalId: journalId || generalJournalA,
        entryDate: date,
        lines: [
          { account_id: cashA, debit: amount },
          { account_id: salesIncomeA, credit: amount },
        ],
        actorUserId: adminA,
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  describe('1. Posting', () => {
    test('a balanced entry posts, numbered from the JE sequence', async () => {
      const entry = await postSimple({ amount: '100.00' });

      expect(entry.status).toBe('posted');
      expect(entry.posted_at).not.toBeNull();
      expect(entry.entry_number).toMatch(/^JE\/2026\/\d{5}$/);
      expect(entry.lines).toHaveLength(2);
      expect(entry.lines[0].debit).toBe('100.00');
      expect(entry.lines[1].credit).toBe('100.00');
    });

    test('the entry date decides the fiscal year — March belongs to the previous one', async () => {
      const entry = await postSimple({ amount: '10.00', date: '2026-03-31' });
      expect(entry.entry_number).toMatch(/^JE\/2025\/\d{5}$/);
    });

    test('an unbalanced entry is rejected by the service', async () => {
      await expect(
        withTransaction((client) =>
          accountingService.postJournalEntry(client, {
            organizationId: orgA,
            journalId: generalJournalA,
            entryDate: '2026-05-14',
            lines: [
              { account_id: cashA, debit: '100.00' },
              { account_id: salesIncomeA, credit: '99.99' },
            ],
            actorUserId: adminA,
          })
        )
      ).rejects.toThrow(/unbalanced/i);
    });

    test('posting to an ARCHIVED account is rejected — project.md §9.6', async () => {
      const created = await pool.query(
        `INSERT INTO accounts (organization_id, code, name, account_type, status, created_by, updated_by)
         VALUES ($1, $2, 'Archived Expense', 'expense', 'archived', $3, $3) RETURNING id`,
        [orgA, `ARCH-${suffix}`, adminA]
      );
      const archivedAccount = created.rows[0].id;

      await expect(
        withTransaction((client) =>
          accountingService.postJournalEntry(client, {
            organizationId: orgA,
            journalId: generalJournalA,
            entryDate: '2026-05-14',
            lines: [
              { account_id: archivedAccount, debit: '50.00' },
              { account_id: cashA, credit: '50.00' },
            ],
            actorUserId: adminA,
          })
        )
      ).rejects.toThrow(/not found or is archived/i);
    });

    test('posting to an ARCHIVED journal is rejected — project.md §9.6', async () => {
      const created = await pool.query(
        `INSERT INTO journals (organization_id, name, journal_type, status, created_by, updated_by)
         VALUES ($1, $2, 'general', 'archived', $3, $3) RETURNING id`,
        [orgA, `Archived Journal ${suffix}`, adminA]
      );

      await expect(
        postSimple({ journalId: created.rows[0].id })
      ).rejects.toThrow(/not found or is archived/i);
    });

    test("a CROSS-TENANT account in a line is rejected", async () => {
      await expect(
        withTransaction((client) =>
          accountingService.postJournalEntry(client, {
            organizationId: orgA,
            journalId: generalJournalA,
            entryDate: '2026-05-14',
            lines: [
              // cashB belongs to Org B. The FK would happily accept it; the
              // tenant check is the only thing standing in the way.
              { account_id: cashB, debit: '25.00' },
              { account_id: cashA, credit: '25.00' },
            ],
            actorUserId: adminA,
          })
        )
      ).rejects.toThrow(/not found or is archived/i);
    });

    test('a rolled-back post consumes NO sequence number', async () => {
      const before = await pool.query(
        `SELECT next_number FROM document_sequences
          WHERE organization_id = $1 AND doc_type = 'JE' AND fiscal_year = '2026'`,
        [orgA]
      );

      await expect(
        withTransaction(async (client) => {
          await accountingService.postJournalEntry(client, {
            organizationId: orgA,
            journalId: generalJournalA,
            entryDate: '2026-05-14',
            lines: [
              { account_id: cashA, debit: '77.00' },
              { account_id: salesIncomeA, credit: '77.00' },
            ],
            actorUserId: adminA,
          });
          // Something later in the caller's transaction fails — a bill insert,
          // say. The number must go back with it.
          throw new Error('caller failed after posting');
        })
      ).rejects.toThrow('caller failed after posting');

      const after = await pool.query(
        `SELECT next_number FROM document_sequences
          WHERE organization_id = $1 AND doc_type = 'JE' AND fiscal_year = '2026'`,
        [orgA]
      );

      expect(after.rows[0].next_number).toBe(before.rows[0].next_number);
    });

    test('concurrent posting produces NO duplicate entry numbers', async () => {
      const CONCURRENT = 12;

      // Genuinely in parallel — Promise.all, separate connections, all racing
      // the same sequence row.
      const entries = await Promise.all(
        Array.from({ length: CONCURRENT }, (_, i) =>
          postSimple({ amount: `${10 + i}.00`, date: '2026-06-01' })
        )
      );

      const numbers = entries.map((e) => e.entry_number);
      expect(new Set(numbers).size).toBe(CONCURRENT);

      // And the database agrees — the unique constraint would have caught it,
      // but the count proves nothing was lost either.
      const stored = await pool.query(
        `SELECT COUNT(DISTINCT entry_number)::integer AS distinct_numbers,
                COUNT(*)::integer AS total
           FROM journal_entries
          WHERE organization_id = $1 AND entry_date = '2026-06-01'`,
        [orgA]
      );
      expect(stored.rows[0].distinct_numbers).toBe(stored.rows[0].total);
      expect(stored.rows[0].total).toBe(CONCURRENT);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('2. Database guarantees — the application is BYPASSED entirely', () => {
    test('the deferrable trigger rejects an unbalanced entry inserted via RAW SQL', async () => {
      const client = await pool.connect();

      await expect((async () => {
        try {
          await client.query('BEGIN');

          const entry = await client.query(
            `INSERT INTO journal_entries
               (organization_id, journal_id, entry_number, entry_date, status, posted_at)
             VALUES ($1, $2, $3, '2026-05-14', 'posted', NOW())
             RETURNING id`,
            [orgA, generalJournalA, `RAW/UNBAL/${suffix}`]
          );
          const entryId = entry.rows[0].id;

          // 100 debit against 60 credit. No service, no validation — straight
          // at the table.
          await client.query(
            `INSERT INTO journal_entry_lines
               (organization_id, journal_entry_id, line_no, account_id, debit, credit)
             VALUES ($1, $2, 1, $3, 100.00, 0), ($1, $2, 2, $4, 0, 60.00)`,
            [orgA, entryId, cashA, salesIncomeA]
          );

          // The trigger is DEFERRED, so it fires here and not before.
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      })()).rejects.toThrow(/unbalanced/i);

      const orphan = await pool.query(
        'SELECT id FROM journal_entries WHERE entry_number = $1',
        [`RAW/UNBAL/${suffix}`]
      );
      expect(orphan.rowCount).toBe(0);
    });

    test('the trigger rejects a POSTED entry with fewer than two lines', async () => {
      const client = await pool.connect();

      await expect((async () => {
        try {
          await client.query('BEGIN');
          const entry = await client.query(
            `INSERT INTO journal_entries
               (organization_id, journal_id, entry_number, entry_date, status, posted_at)
             VALUES ($1, $2, $3, '2026-05-14', 'posted', NOW())
             RETURNING id`,
            [orgA, generalJournalA, `RAW/ONELINE/${suffix}`]
          );
          await client.query(
            `INSERT INTO journal_entry_lines
               (organization_id, journal_entry_id, line_no, account_id, debit, credit)
             VALUES ($1, $2, 1, $3, 0, 0.00)`,
            [orgA, entry.rows[0].id, cashA]
          );
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      })()).rejects.toThrow();
    });

    test('the line CHECK constraint rejects a line with BOTH sides zero', async () => {
      await expect(
        pool.query(
          `INSERT INTO journal_entry_lines
             (organization_id, journal_entry_id, line_no, account_id, debit, credit)
           VALUES ($1, gen_random_uuid(), 1, $2, 0, 0)`,
          [orgA, cashA]
        )
      ).rejects.toThrow();
    });

    test('the line CHECK constraint rejects a line with BOTH sides non-zero', async () => {
      const entry = await postSimple({ amount: '5.00' });

      await expect(
        pool.query(
          `INSERT INTO journal_entry_lines
             (organization_id, journal_entry_id, line_no, account_id, debit, credit)
           VALUES ($1, $2, 99, $3, 10.00, 10.00)`,
          [orgA, entry.id, cashA]
        )
      ).rejects.toThrow(/ck_journal_entry_lines_sides|check/i);
    });

    test('the immutability trigger rejects a raw UPDATE on a posted line', async () => {
      const entry = await postSimple({ amount: '250.00' });
      const lineId = entry.lines[0].id;

      await expect(
        pool.query('UPDATE journal_entry_lines SET debit = 999999.00 WHERE id = $1', [lineId])
      ).rejects.toThrow(/immutable/i);

      // And the amount genuinely did not move.
      const after = await pool.query('SELECT debit FROM journal_entry_lines WHERE id = $1', [lineId]);
      expect(after.rows[0].debit).toBe('250.00');
    });

    test('the immutability trigger rejects a raw DELETE of a posted line', async () => {
      const entry = await postSimple({ amount: '260.00' });

      await expect(
        pool.query('DELETE FROM journal_entry_lines WHERE id = $1', [entry.lines[0].id])
      ).rejects.toThrow(/immutable/i);
    });

    test('a posted entry cannot be DELETED', async () => {
      const entry = await postSimple({ amount: '270.00' });

      await expect(
        pool.query('DELETE FROM journal_entries WHERE id = $1', [entry.id])
      ).rejects.toThrow(/cannot be deleted/i);
    });

    test('a posted entry cannot be renumbered, redated or rejournalled', async () => {
      const entry = await postSimple({ amount: '280.00' });

      for (const [sql, params] of [
        ['UPDATE journal_entries SET entry_number = $2 WHERE id = $1', [entry.id, `HACKED/${suffix}`]],
        ['UPDATE journal_entries SET entry_date = $2 WHERE id = $1', [entry.id, '2020-01-01']],
        ['UPDATE journal_entries SET narration = $2 WHERE id = $1', [entry.id, 'edited']],
      ]) {
        await expect(pool.query(sql, params)).rejects.toThrow(/immutable|renumbered/i);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('3. Reversal', () => {
    test('a reversal is an exact mirror and flags the original', async () => {
      const original = await postSimple({ amount: '400.00' });

      const { original: flagged, reversal } = await withTransaction((client) =>
        accountingService.reverseJournalEntry(client, original.id, 'Keyed twice', {
          organizationId: orgA,
          actorUserId: adminA,
          reversalDate: '2026-05-20',
        })
      );

      expect(flagged.status).toBe('reversed');
      expect(flagged.reversed_by_entry_id).toBe(reversal.id);

      // Debits and credits swapped, same accounts, same amounts.
      const originalByAccount = new Map(original.lines.map((l) => [l.account_id, l]));
      expect(reversal.lines).toHaveLength(original.lines.length);

      for (const line of reversal.lines) {
        const source = originalByAccount.get(line.account_id);
        expect(source).toBeDefined();
        expect(line.debit).toBe(source.credit);
        expect(line.credit).toBe(source.debit);
      }

      expect(reversal.source_type).toBe('reversal');
      expect(reversal.source_id).toBe(original.id);
      expect(reversal.is_auto_generated).toBe(true);
    });

    test('the original entry is left byte-for-byte unchanged', async () => {
      const original = await postSimple({ amount: '410.00' });
      const before = await pool.query(
        'SELECT debit, credit, account_id FROM journal_entry_lines WHERE journal_entry_id = $1 ORDER BY line_no',
        [original.id]
      );

      await withTransaction((client) =>
        accountingService.reverseJournalEntry(client, original.id, 'test', {
          organizationId: orgA, actorUserId: adminA,
        })
      );

      const after = await pool.query(
        'SELECT debit, credit, account_id FROM journal_entry_lines WHERE journal_entry_id = $1 ORDER BY line_no',
        [original.id]
      );
      expect(after.rows).toEqual(before.rows);
    });

    test('a reversal round-trip leaves account balances EXACTLY unchanged', async () => {
      const asOf = '2026-12-31';

      const before = await accountingRepository.getAccountBalances(null, orgA, asOf);
      const beforeByAccount = new Map(before.map((row) => [row.account_id, row.balance]));

      const entry = await withTransaction((client) =>
        accountingService.postJournalEntry(client, {
          organizationId: orgA,
          journalId: generalJournalA,
          entryDate: '2026-07-15',
          lines: [
            { account_id: debtorsA, debit: '1234.56' },
            { account_id: salesIncomeA, credit: '1234.56' },
          ],
          actorUserId: adminA,
        })
      );

      const during = await accountingRepository.getAccountBalances(null, orgA, asOf);
      const duringByAccount = new Map(during.map((row) => [row.account_id, row.balance]));
      // The entry did move the needle, so the test is not vacuous.
      expect(duringByAccount.get(debtorsA)).not.toBe(beforeByAccount.get(debtorsA));

      await withTransaction((client) =>
        accountingService.reverseJournalEntry(client, entry.id, 'round trip', {
          organizationId: orgA, actorUserId: adminA, reversalDate: '2026-07-16',
        })
      );

      const after = await accountingRepository.getAccountBalances(null, orgA, asOf);
      for (const row of after) {
        expect({ account: row.code, balance: row.balance })
          .toEqual({ account: row.code, balance: beforeByAccount.get(row.account_id) });
      }
    });

    test('an entry cannot be reversed twice', async () => {
      const entry = await postSimple({ amount: '420.00' });

      await withTransaction((client) =>
        accountingService.reverseJournalEntry(client, entry.id, 'first', {
          organizationId: orgA, actorUserId: adminA,
        })
      );

      await expect(
        withTransaction((client) =>
          accountingService.reverseJournalEntry(client, entry.id, 'second', {
            organizationId: orgA, actorUserId: adminA,
          })
        )
      ).rejects.toThrow(/already been reversed/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('4. API surface', () => {
    let apiEntryId;

    test('a manual entry posts through the API', async () => {
      const res = await asAdminA(request(app).post('/api/journal-entries')).send({
        journal_id: generalJournalA,
        entry_date: '2026-08-01',
        reference: `REF-${suffix}`,
        narration: 'Manual adjustment',
        lines: [
          { account_id: bankA, debit: '500.00', description: 'To bank' },
          { account_id: cashA, credit: '500.00', description: 'From cash' },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.data.entry.status).toBe('posted');
      expect(res.body.data.entry.is_auto_generated).toBe(false);
      apiEntryId = res.body.data.entry.id;
    });

    test('an unbalanced manual entry is refused by the API', async () => {
      const res = await asAdminA(request(app).post('/api/journal-entries')).send({
        journal_id: generalJournalA,
        entry_date: '2026-08-01',
        lines: [
          { account_id: bankA, debit: '500.00' },
          { account_id: cashA, credit: '400.00' },
        ],
      });

      expect(res.status).toBe(422);
    });

    test('THERE IS NO PATCH AND NO DELETE on a posted entry', async () => {
      const patched = await asAdminA(request(app).patch(`/api/journal-entries/${apiEntryId}`))
        .send({ narration: 'edited' });
      expect(patched.status).toBe(404);

      const deleted = await asAdminA(request(app).delete(`/api/journal-entries/${apiEntryId}`));
      expect(deleted.status).toBe(404);
    });

    test('the list carries per-entry totals and honours the auto/manual filter', async () => {
      const res = await asAdminA(request(app).get('/api/journal-entries?source=manual&limit=50'));

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((e) => e.is_auto_generated === false)).toBe(true);

      const entry = res.body.data.items.find((e) => e.id === apiEntryId);
      expect(entry.total_debit).toBe('500.00');
      expect(entry.total_credit).toBe('500.00');
      expect(entry.line_count).toBe(2);
    });

    test('the API reverses an entry', async () => {
      const res = await asManagerA(request(app).post(`/api/journal-entries/${apiEntryId}/reverse`))
        .send({ reason: 'Wrong account', reversal_date: '2026-08-05' });

      expect(res.status).toBe(201);
      expect(res.body.data.original.status).toBe('reversed');
      expect(res.body.data.reversal.entry_number).not.toBe(res.body.data.original.entry_number);
    });

    test('cross-tenant entry ids return 404, never 403', async () => {
      for (const [method, path] of [
        ['get', `/api/journal-entries/${apiEntryId}`],
        ['post', `/api/journal-entries/${apiEntryId}/reverse`],
      ]) {
        const res = await asAdminB(request(app)[method](path)).send({ reason: 'x' });
        expect({ path, status: res.status }).toEqual({ path, status: 404 });
      }
    });

    test("Org B's list contains none of Org A's entries", async () => {
      const res = await asAdminB(request(app).get('/api/journal-entries?limit=100'));
      expect(res.status).toBe(200);
      expect(res.body.data.items.every((e) => e.organization_id === orgB)).toBe(true);
    });

    test('every endpoint requires authentication', async () => {
      const res = await request(app).get('/api/journal-entries');
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('5. Reporting primitives', () => {
    test('getAccountBalances returns every account, including untouched ones', async () => {
      const balances = await accountingRepository.getAccountBalances(null, orgA, '2026-12-31');

      const codes = balances.map((row) => row.code);
      expect(codes).toContain('1010');
      expect(codes).toContain('3010');
      expect(balances.every((row) => typeof row.balance === 'string')).toBe(true);
    });

    test('the trial balance balances — total debits equal total credits', async () => {
      const balances = await accountingRepository.getAccountBalances(null, orgA, '2026-12-31');

      const totalDebit = sum(balances.map((row) => row.total_debit));
      const totalCredit = sum(balances.map((row) => row.total_credit));

      expect(totalDebit).toBe(totalCredit);
    });

    test('getPeriodMovements is scoped to its date range', async () => {
      const inRange = await accountingRepository.getPeriodMovements(
        null, orgA, '2026-08-01', '2026-08-31'
      );
      const outOfRange = await accountingRepository.getPeriodMovements(
        null, orgA, '2030-01-01', '2030-12-31'
      );

      const inTotal = sum(inRange.map((row) => row.total_debit));
      const outTotal = sum(outOfRange.map((row) => row.total_debit));

      expect(inTotal).not.toBe('0.00');
      expect(outTotal).toBe('0.00');
    });

    test('getContactOpenItems is scoped to one contact and one side', async () => {
      const contact = await pool.query(
        `INSERT INTO contacts (organization_id, name, contact_type, created_by, updated_by)
         VALUES ($1, $2, 'customer', $3, $3) RETURNING id`,
        [orgA, `Ledger Customer ${suffix}`, adminA]
      );
      const contactId = contact.rows[0].id;

      await withTransaction((client) =>
        accountingService.postJournalEntry(client, {
          organizationId: orgA,
          journalId: generalJournalA,
          entryDate: '2026-09-01',
          lines: [
            { account_id: debtorsA, debit: '900.00', partner_contact_id: contactId },
            { account_id: salesIncomeA, credit: '900.00' },
          ],
          actorUserId: adminA,
        })
      );

      const items = await accountingRepository.getContactOpenItems(
        null, orgA, contactId, 'receivable'
      );

      expect(items.length).toBe(1);
      expect(items[0].outstanding).toBe('900.00');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('6. Opening balances', () => {
    test('opening balances post as ONE balancing entry against Opening Balance Equity', async () => {
      // Give a couple of accounts a real opening position first.
      await pool.query(
        `UPDATE accounts SET opening_balance = 5000.00 WHERE organization_id = $1 AND code = '1020'`,
        [orgB]
      );
      await pool.query(
        `UPDATE accounts SET opening_balance = 2000.00 WHERE organization_id = $1 AND code = '2010'`,
        [orgB]
      );

      const bankJournal = await journalByType(orgB, 'bank');

      const res = await asAdminB(request(app).post('/api/journal-entries/opening-balances'))
        .send({ journal_id: bankJournal.id, entry_date: '2026-04-01' });

      expect(res.status).toBe(201);

      const entry = res.body.data.entry;
      expect(entry.source_type).toBe('opening_balance');

      const totalDebit = sum(entry.lines.map((l) => l.debit));
      const totalCredit = sum(entry.lines.map((l) => l.credit));
      expect(totalDebit).toBe(totalCredit);

      // 5000 asset debit vs 2000 liability credit → equity absorbs 3000.
      const equityLine = entry.lines.find((l) => l.account_code === '3010');
      expect(equityLine.credit).toBe('3000.00');
    });

    test('posting them a second time is refused rather than double-counted', async () => {
      const bankJournal = await journalByType(orgB, 'bank');

      const res = await asAdminB(request(app).post('/api/journal-entries/opening-balances'))
        .send({ journal_id: bankJournal.id, entry_date: '2026-04-01' });

      expect(res.status).toBe(409);
    });
  });
});
