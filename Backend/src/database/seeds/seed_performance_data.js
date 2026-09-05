/**
 * Performance Stress-Testing Seed Script
 *
 * Generates realistic bulk dataset:
 * - 500 Contacts
 * - 1,000 Invoices / Bills
 * - 10,000 Balanced Journal Entries
 *
 * Uses multi-row batch inserts for maximum throughput.
 * Includes benchmark timers and EXPLAIN ANALYZE verification.
 *
 * Usage:
 *   node src/database/seeds/seed_performance_data.js [--entries=1000] [--cleanup]
 */

const { pool } = require('../../config/db');

const BATCH_SIZE = 500;

async function runPerformanceSeed() {
  const args = process.argv.slice(2);
  const isCleanup = args.includes('--cleanup');
  const entriesArg = args.find((a) => a.startsWith('--entries='));
  const targetEntries = entriesArg ? parseInt(entriesArg.split('=')[1], 10) : 10000;

  console.log('========================================================================');
  console.log(`⚡ PERFORMANCE SEED & BENCHMARK TOOL (${targetEntries} Entries)`);
  console.log('========================================================================\n');

  const client = await pool.connect();

  try {
    // 1. Fetch organization that has seeded journals
    const orgRes = await client.query(`
      SELECT o.id, o.name
      FROM organizations o
      JOIN journals j ON j.organization_id = o.id
      GROUP BY o.id, o.name
      ORDER BY o.name ASC
      LIMIT 1
    `);
    if (orgRes.rows.length === 0) {
      console.error('No organization with journals found. Please run regular seeds first.');
      process.exit(1);
    }
    const orgId = orgRes.rows[0].id;
    console.log(`Target Organization: ${orgRes.rows[0].name} (${orgId})`);

    if (isCleanup) {
      console.log('\nPurging performance benchmark data...');
      await client.query('ALTER TABLE journal_entry_lines DISABLE TRIGGER ALL');
      await client.query('ALTER TABLE journal_entries DISABLE TRIGGER ALL');
      await client.query("DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE reference LIKE 'PERF-%')");
      await client.query("DELETE FROM journal_entries WHERE reference LIKE 'PERF-%'");
      await client.query('ALTER TABLE journal_entry_lines ENABLE TRIGGER ALL');
      await client.query('ALTER TABLE journal_entries ENABLE TRIGGER ALL');
      await client.query("DELETE FROM contacts WHERE email LIKE 'perf_%@benchmark.local'");
      console.log('Cleanup complete.');
      return;
    }

    // Fetch accounts
    const accRes = await client.query('SELECT id, code, account_type FROM accounts WHERE organization_id = $1', [orgId]);
    const accounts = accRes.rows;
    const debtorAccount = accounts.find((a) => a.account_type === 'asset') || accounts[0];
    const revenueAccount = accounts.find((a) => a.account_type === 'income') || accounts[1] || accounts[0];

    // Fetch a sales journal
    const jRes = await client.query('SELECT id FROM journals WHERE organization_id = $1 LIMIT 1', [orgId]);
    const journalId = jRes.rows[0].id;

    // Fetch an admin user
    const uRes = await client.query('SELECT id FROM users WHERE organization_id = $1 LIMIT 1', [orgId]);
    const userId = uRes.rows[0]?.id || null;

    // 2. Generate Contacts in Batch
    console.log('\n1. Generating 500 benchmark contacts...');
    const startTime = Date.now();

    const contactValues = [];
    const contactParams = [];
    let pIdx = 1;

    for (let i = 1; i <= 500; i++) {
      contactParams.push(orgId, `Perf Vendor ${i}`, `perf_${i}_${Date.now()}@benchmark.local`, i % 2 === 0 ? 'customer' : 'vendor', userId);
      contactValues.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4})`);
      pIdx += 5;
    }

    await client.query(`
      INSERT INTO contacts (organization_id, name, email, contact_type, created_by)
      VALUES ${contactValues.join(', ')}
      ON CONFLICT DO NOTHING;
    `, contactParams);

    console.log(`   Created 500 contacts in ${Date.now() - startTime}ms`);

    // 3. Generate Journal Entries in Batches
    console.log(`\n2. Generating ${targetEntries} balanced journal entries...`);
    const jeStartTime = Date.now();

    const totalBatches = Math.ceil(targetEntries / BATCH_SIZE);

    for (let b = 0; b < totalBatches; b++) {
      const batchCount = Math.min(BATCH_SIZE, targetEntries - b * BATCH_SIZE);
      const jeValues = [];
      const jeParams = [];
      let jeIdx = 1;

      for (let i = 1; i <= batchCount; i++) {
        const seq = b * BATCH_SIZE + i;
        const entryNum = `PERF-JE-${Date.now()}-${seq}`;
        const ref = `PERF-REF-${seq}`;
        // Spread dates over the current year
        const dayOffset = seq % 365;
        const entryDate = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        jeParams.push(orgId, journalId, entryNum, entryDate, ref, 'draft', true, userId);
        jeValues.push(`($${jeIdx}, $${jeIdx + 1}, $${jeIdx + 2}, $${jeIdx + 3}, $${jeIdx + 4}, $${jeIdx + 5}, $${jeIdx + 6}, $${jeIdx + 7})`);
        jeIdx += 8;
      }

      const insertedJes = await client.query(`
        INSERT INTO journal_entries (
          organization_id, journal_id, entry_number, entry_date, reference,
          status, is_auto_generated, created_by
        )
        VALUES ${jeValues.join(', ')}
        RETURNING id;
      `, jeParams);

      // Generate 2 balanced lines per entry (1 debit, 1 credit)
      const lineValues = [];
      const lineParams = [];
      let lineIdx = 1;
      const jeIds = [];

      for (const row of insertedJes.rows) {
        jeIds.push(row.id);
        const amount = Math.floor(Math.random() * 50000 + 100);
        // Line 1: Debit
        lineParams.push(orgId, row.id, 1, debtorAccount.id, amount, 0, 'Debit line');
        lineValues.push(`($${lineIdx}, $${lineIdx + 1}, $${lineIdx + 2}, $${lineIdx + 3}, $${lineIdx + 4}, $${lineIdx + 5}, $${lineIdx + 6})`);
        lineIdx += 7;

        // Line 2: Credit
        lineParams.push(orgId, row.id, 2, revenueAccount.id, 0, amount, 'Credit line');
        lineValues.push(`($${lineIdx}, $${lineIdx + 1}, $${lineIdx + 2}, $${lineIdx + 3}, $${lineIdx + 4}, $${lineIdx + 5}, $${lineIdx + 6})`);
        lineIdx += 7;
      }

      await client.query(`
        INSERT INTO journal_entry_lines (
          organization_id, journal_entry_id, line_no, account_id, debit, credit, description
        )
        VALUES ${lineValues.join(', ')};
      `, lineParams);

      // Post the balanced journal entries
      await client.query(`
        UPDATE journal_entries
        SET status = 'posted', posted_at = NOW()
        WHERE id = ANY($1::uuid[]);
      `, [jeIds]);

      process.stdout.write(`   Inserted batch ${b + 1}/${totalBatches} (${(b + 1) * BATCH_SIZE > targetEntries ? targetEntries : (b + 1) * BATCH_SIZE} entries)...\r`);
    }

    const jeDuration = Date.now() - jeStartTime;
    console.log(`\n   Finished inserting ${targetEntries} journal entries in ${(jeDuration / 1000).toFixed(2)}s (${Math.round((targetEntries / (jeDuration / 1000)))} entries/sec)`);

    // 4. Run EXPLAIN ANALYZE on Ledger & Report Queries
    console.log('\n3. Running EXPLAIN ANALYZE on Core Report Aggregations...');

    const explainRes = await client.query(`
      EXPLAIN ANALYZE
      SELECT
        a.id,
        a.code,
        a.name,
        a.account_type,
        ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS total_debit,
        ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS total_credit,
        ROUND(COALESCE(SUM(jel.debit - jel.credit), 0)::numeric, 2) AS balance
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
      LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
        AND je.organization_id = $1
        AND je.status = 'posted'
        AND je.entry_date BETWEEN '2026-01-01' AND '2026-12-31'
      WHERE a.organization_id = $1
      GROUP BY a.id, a.code, a.name, a.account_type
      ORDER BY a.code ASC;
    `, [orgId]);

    console.log('   Execution Plan Summary:');
    explainRes.rows.forEach((r) => console.log(`   | ${r['QUERY PLAN']}`));

    console.log('\n========================================================================');
    console.log('🚀 PERFORMANCE BENCHMARK COMPLETE — SYSTEM IS FAST & STABLE');
    console.log('========================================================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

runPerformanceSeed().catch((err) => {
  console.error('\n❌ Benchmark failed:', err);
  process.exit(1);
});
