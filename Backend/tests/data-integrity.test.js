const path = require('path');
const { pool } = require('../src/config/db');

async function runDataIntegrityTests() {
  console.log('========================================================================');
  console.log('⚖️  DATA INTEGRITY AUDIT SUITE (PHASE 14 — FINANCIAL INVARIANTS)');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`  ❌ FAILED: ${message}`);
      throw new Error(`Data Integrity Failure: ${message}`);
    }
    passed++;
    console.log(`  ✅ PASSED: ${message}`);
  }

  try {
    // ─── 1. JOURNAL ENTRY BALANCE INVARIANT ─────────────────
    console.log('[SECTION 1: Double-Entry Balance Invariant]');
    const balanceRes = await pool.query(`
      SELECT
        je.id,
        je.entry_number,
        je.status,
        ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS total_debit,
        ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS total_credit
      FROM journal_entries je
      JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
      GROUP BY je.id, je.entry_number, je.status
      HAVING ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) <> ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2);
    `);
    assert(
      balanceRes.rows.length === 0,
      `Every journal entry balances: SUM(debit) == SUM(credit) (unbalanced count: ${balanceRes.rows.length})`
    );

    // ─── 2. NO NEGATIVE DEBITS OR CREDITS ───────────────────
    console.log('\n[SECTION 2: Non-Negative Value Invariant]');
    const negativeRes = await pool.query(`
      SELECT COUNT(*) as count
      FROM journal_entry_lines
      WHERE debit < 0 OR credit < 0;
    `);
    assert(
      parseInt(negativeRes.rows[0].count, 10) === 0,
      'No journal entry line contains negative debit or negative credit amounts'
    );

    // ─── 3. POSTED JOURNAL ENTRIES COMPLETENESS ─────────────
    console.log('\n[SECTION 3: Posted Journal Entries Invariant]');
    const postedJeRes = await pool.query(`
      SELECT COUNT(*) as count
      FROM journal_entries
      WHERE status = 'posted' AND (posted_at IS NULL OR created_by IS NULL);
    `);
    assert(
      parseInt(postedJeRes.rows[0].count, 10) === 0,
      'All posted journal entries have non-null posted_at and created_by audit columns'
    );

    // ─── 4. POSTED INVOICES 1:1 WITH JOURNAL ENTRIES ─────────
    console.log('\n[SECTION 4: Document to General Ledger Linkage]');
    const invoiceLinkRes = await pool.query(`
      SELECT COUNT(*) as count
      FROM customer_invoices ci
      LEFT JOIN journal_entries je ON ci.journal_entry_id = je.id
      WHERE ci.status IN ('posted', 'paid', 'partially_paid')
        AND (ci.journal_entry_id IS NULL OR je.id IS NULL);
    `);
    assert(
      parseInt(invoiceLinkRes.rows[0].count, 10) === 0,
      'Every posted customer invoice references an existing journal entry in the General Ledger'
    );

    // ─── 5. POSTED VENDOR BILLS 1:1 WITH JOURNAL ENTRIES ────
    const billLinkRes = await pool.query(`
      SELECT COUNT(*) as count
      FROM vendor_bills vb
      LEFT JOIN journal_entries je ON vb.journal_entry_id = je.id
      WHERE vb.status IN ('posted', 'paid', 'partially_paid')
        AND (vb.journal_entry_id IS NULL OR je.id IS NULL);
    `);
    assert(
      parseInt(billLinkRes.rows[0].count, 10) === 0,
      'Every posted vendor bill references an existing journal entry in the General Ledger'
    );

    // ─── 6. DOCUMENT NUMBERING UNIQUENESS & INTEGRITY ────────
    console.log('\n[SECTION 6: Document Number Uniqueness]');
    const dupInvoiceRes = await pool.query(`
      SELECT organization_id, invoice_number, COUNT(*) as count
      FROM customer_invoices
      GROUP BY organization_id, invoice_number
      HAVING COUNT(*) > 1;
    `);
    assert(
      dupInvoiceRes.rows.length === 0,
      'No duplicate invoice numbers exist within any organization'
    );

    const dupBillRes = await pool.query(`
      SELECT organization_id, bill_number, COUNT(*) as count
      FROM vendor_bills
      GROUP BY organization_id, bill_number
      HAVING COUNT(*) > 1;
    `);
    assert(
      dupBillRes.rows.length === 0,
      'No duplicate vendor bill numbers exist within any organization'
    );

    const dupJeRes = await pool.query(`
      SELECT organization_id, entry_number, COUNT(*) as count
      FROM journal_entries
      GROUP BY organization_id, entry_number
      HAVING COUNT(*) > 1;
    `);
    assert(
      dupJeRes.rows.length === 0,
      'No duplicate journal entry numbers exist within any organization'
    );

    // ─── 7. CHART OF ACCOUNTS INTEGRITY ─────────────────────
    console.log('\n[SECTION 7: Chart of Accounts Constraints]');
    const coaRes = await pool.query(`
      SELECT organization_id, code, COUNT(*) as count
      FROM accounts
      GROUP BY organization_id, code
      HAVING COUNT(*) > 1;
    `);
    assert(
      coaRes.rows.length === 0,
      'No duplicate account codes exist within any organization CoA'
    );

    // ─── 8. BALANCE SHEET EQUALITY (A = L + E) ──────────────
    console.log('\n[SECTION 8: Balance Sheet Fundamental Accounting Equation]');
    const orgs = await pool.query('SELECT id, name FROM organizations');
    for (const org of orgs.rows) {
      const bsRes = await pool.query(`
        SELECT
          a.account_type,
          ROUND(COALESCE(SUM(jel.debit - jel.credit), 0)::numeric, 2) AS net_balance
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        JOIN accounts a ON jel.account_id = a.id
        WHERE je.organization_id = $1 AND je.status = 'posted'
        GROUP BY a.account_type;
      `, [org.id]);

      let assetNet = 0;
      let liabilityNet = 0;
      let equityNet = 0;
      let incomeNet = 0;
      let expenseNet = 0;

      for (const row of bsRes.rows) {
        const val = parseFloat(row.net_balance);
        if (row.account_type === 'asset') assetNet += val;
        else if (row.account_type === 'liability') liabilityNet += (-val); // credit normal
        else if (row.account_type === 'capital') equityNet += (-val);      // credit normal
        else if (row.account_type === 'income') incomeNet += (-val);       // credit normal
        else if (row.account_type === 'expense') expenseNet += val;        // debit normal
      }

      // In double entry: Assets = Liabilities + Equity + Retained Earnings (Income - Expense)
      const currentYearEarnings = incomeNet - expenseNet;
      const totalEquityAndLiabilities = liabilityNet + equityNet + currentYearEarnings;
      const diff = Math.abs(assetNet - totalEquityAndLiabilities);

      assert(
        diff < 0.01,
        `Balance Sheet equation (Assets = Liabilities + Equity + Net Income) holds for org ${org.name}: Assets=${assetNet.toFixed(2)}, L+E+Net=${totalEquityAndLiabilities.toFixed(2)}, Diff=${diff.toFixed(2)}`
      );
    }

    console.log('\n========================================================================');
    console.log(`🏆 DATA INTEGRITY AUDIT COMPLETE: ${passed}/${total} INVARIANTS SATISFIED`);
    console.log('========================================================================\n');
  } finally {
    await pool.end();
  }
}

runDataIntegrityTests().catch((err) => {
  console.error('\n❌ DATA INTEGRITY AUDIT FAILED:', err);
  process.exit(1);
});
