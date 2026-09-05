/**
 * Organization Seeding Service
 *
 * Seeds mandatory master data for a newly created organization inside the signup transaction:
 * - 10 System Accounts (Chart of Accounts)
 * - 4 System Journals (Sales, Purchase, Bank, Cash)
 * - 6 Document Sequences (PO, SO, BILL, INV, PAY, JE)
 *
 * Runs on the caller's transaction client — any failure will roll back the entire transaction.
 */

/**
 * Seed accounts, journals, and sequences for an organization.
 *
 * @param {object} client - PostgreSQL client connected inside active transaction
 * @param {string} organizationId - UUID of the new organization
 * @param {string} [userId] - Optional UUID of the creator admin user
 * @param {number|string} [fiscalYear] - Optional fiscal year (defaults to current calendar year)
 */
async function seedOrganizationMasterData(client, organizationId, userId = null, fiscalYear = null) {
  if (!client || !client.query) {
    throw new Error('Database transaction client is required for seeding');
  }
  if (!organizationId) {
    throw new Error('Organization ID is required for seeding');
  }

  const fy = String(fiscalYear || new Date().getFullYear());

  // 1. Insert 10 System Accounts (is_system = true)
  const accountsToSeed = [
    { code: '1010', name: 'Cash', account_type: 'asset' },
    { code: '1020', name: 'Bank', account_type: 'asset' },
    { code: '1030', name: 'Debtors', account_type: 'asset' },
    { code: '1040', name: 'Input Tax Credit', account_type: 'asset' },
    { code: '1050', name: 'Payment Gateway Clearing', account_type: 'asset' },
    { code: '2010', name: 'Creditors', account_type: 'liability' },
    { code: '2020', name: 'Output Tax Payable', account_type: 'liability' },
    { code: '3010', name: 'Opening Balance Equity', account_type: 'capital' },
    { code: '4010', name: 'Sale Income', account_type: 'income' },
    { code: '5010', name: 'Purchase Expense', account_type: 'expense' },
  ];

  const accountMap = {};
  for (const acc of accountsToSeed) {
    const res = await client.query(
      `INSERT INTO accounts (
        organization_id, code, name, account_type, opening_balance,
        is_system, status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, 0.00, true, 'active', $5, $5)
      RETURNING id, code, name`,
      [organizationId, acc.code, acc.name, acc.account_type, userId]
    );
    accountMap[acc.name] = res.rows[0].id;
  }

  // 2. Insert 4 System Journals (project.md §4.4)
  const journalsToSeed = [
    {
      name: 'Sales',
      journal_type: 'sales',
      sequence_prefix: 'INV',
      default_debit_account_id: accountMap['Debtors'] || null,
      default_credit_account_id: accountMap['Sale Income'] || null,
    },
    {
      name: 'Purchase',
      journal_type: 'purchase',
      sequence_prefix: 'BILL',
      default_debit_account_id: accountMap['Purchase Expense'] || null,
      default_credit_account_id: accountMap['Creditors'] || null,
    },
    {
      name: 'Bank',
      journal_type: 'bank',
      sequence_prefix: 'BNK',
      default_debit_account_id: accountMap['Bank'] || null,
      default_credit_account_id: null,
    },
    {
      name: 'Cash',
      journal_type: 'cash',
      sequence_prefix: 'CSH',
      default_debit_account_id: accountMap['Cash'] || null,
      default_credit_account_id: null,
    },
  ];

  for (const j of journalsToSeed) {
    await client.query(
      `INSERT INTO journals (
        organization_id, name, journal_type, sequence_prefix,
        default_debit_account_id, default_credit_account_id, status,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7)`,
      [
        organizationId,
        j.name,
        j.journal_type,
        j.sequence_prefix,
        j.default_debit_account_id,
        j.default_credit_account_id,
        userId,
      ]
    );
  }

  // 3. Insert 6 Sequences (PO, SO, BILL, INV, PAY, JE)
  const sequencesToSeed = [
    { doc_type: 'PO', prefix: 'PO' },
    { doc_type: 'SO', prefix: 'SO' },
    { doc_type: 'BILL', prefix: 'BILL' },
    { doc_type: 'INV', prefix: 'INV' },
    { doc_type: 'PAY', prefix: 'PAY' },
    { doc_type: 'JE', prefix: 'JE' },
  ];

  for (const s of sequencesToSeed) {
    await client.query(
      `INSERT INTO document_sequences (
        organization_id, doc_type, fiscal_year, prefix, next_number, padding
      ) VALUES ($1, $2, $3, $4, 1, 5)
      ON CONFLICT (organization_id, doc_type, fiscal_year) DO NOTHING`,
      [organizationId, s.doc_type, fy, s.prefix]
    );
  }

  return {
    accountsCount: accountsToSeed.length,
    journalsCount: journalsToSeed.length,
    sequencesCount: sequencesToSeed.length,
  };
}

module.exports = {
  seedOrganizationMasterData,
};
