/**
 * Document Sequence Service
 *
 * Implements non-gapping, per-organization, per-fiscal-year document numbering.
 *
 * CRITICAL ACCOUNTING RULE:
 * A PostgreSQL SEQUENCE cannot be used for accounting documents because:
 * 1. Sequences are global across the database, not partitioned by organization and year.
 * 2. Sequences gap on transaction rollback (e.g. nextval burned).
 *
 * This implementation takes a row lock (SELECT ... FOR UPDATE) inside the caller's
 * posting transaction. If the transaction rolls back, the lock is released and
 * the sequence number remains unconsumed.
 */

const DEFAULT_PREFIXES = {
  invoice: 'INV',
  bill: 'BILL',
  purchase_order: 'PO',
  sales_order: 'SO',
  payment: 'PAY',
  journal_entry: 'JE',
};

const sequenceService = {
  /**
   * Acquire the next formatted document number within a transaction.
   *
   * @param {object} client - Active transaction client (MANDATORY)
   * @param {string} organizationId - UUID of the organization
   * @param {string} docType - e.g. 'invoice', 'bill', 'purchase_order', 'sales_order', 'payment', 'journal_entry'
   * @param {string|number} fiscalYear - e.g. '2026'
   * @param {string} [customPrefix] - Optional prefix override
   * @returns {Promise<string>} Formatted document number e.g. "INV/2026/00001"
   */
  async nextDocumentNumber(client, organizationId, docType, fiscalYear, customPrefix) {
    if (!client || typeof client.query !== 'function') {
      throw new Error('nextDocumentNumber requires an active transaction client');
    }
    if (!organizationId) throw new Error('organizationId is required for document sequencing');
    if (!docType) throw new Error('docType is required for document sequencing');

    const fy = String(fiscalYear || new Date().getFullYear());
    const prefix = (customPrefix || DEFAULT_PREFIXES[docType] || docType.toUpperCase().substring(0, 4));

    // Ensure a sequence record exists; lock it with FOR UPDATE
    let seqResult = await client.query(
      `SELECT id, prefix, next_number, padding
         FROM document_sequences
        WHERE organization_id = $1 AND doc_type = $2 AND fiscal_year = $3
          FOR UPDATE;`,
      [organizationId, docType, fy]
    );

    if (seqResult.rows.length === 0) {
      // Initialize sequence for this org/docType/fy
      await client.query(
        `INSERT INTO document_sequences (organization_id, doc_type, fiscal_year, prefix, next_number, padding)
         VALUES ($1, $2, $3, $4, 1, 5)
         ON CONFLICT (organization_id, doc_type, fiscal_year) DO NOTHING;`,
        [organizationId, docType, fy, prefix]
      );

      // Re-select with FOR UPDATE
      seqResult = await client.query(
        `SELECT id, prefix, next_number, padding
           FROM document_sequences
          WHERE organization_id = $1 AND doc_type = $2 AND fiscal_year = $3
            FOR UPDATE;`,
        [organizationId, docType, fy]
      );
    }

    const row = seqResult.rows[0];
    const currentNumber = row.next_number;
    const padding = row.padding || 5;
    const activePrefix = row.prefix || prefix;

    // Advance sequence for the next caller
    await client.query(
      `UPDATE document_sequences
          SET next_number = next_number + 1,
              updated_at = NOW()
        WHERE id = $1;`,
      [row.id]
    );

    const formatted = `${activePrefix}/${fy}/${String(currentNumber).padStart(padding, '0')}`;
    return formatted;
  },
};

module.exports = sequenceService;
