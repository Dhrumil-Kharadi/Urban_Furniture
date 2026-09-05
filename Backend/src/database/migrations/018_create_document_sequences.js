/**
 * Migration: Create document_sequences table
 *
 * Scoped auto-incrementing document numbering per organization and fiscal year.
 * Target of row-level lock (SELECT ... FOR UPDATE) during document posting.
 *
 * Columns:
 * - id: UUID PK
 * - organization_id: UUID NOT NULL REFERENCES organizations(id)
 * - doc_type: VARCHAR(50) NOT NULL (e.g. invoice, bill, po, so, payment, journal_entry)
 * - fiscal_year: VARCHAR(10) NOT NULL (e.g. '2026')
 * - prefix: VARCHAR(20) NOT NULL (e.g. 'INV', 'BILL', 'PO', 'SO', 'PAY')
 * - next_number: INTEGER NOT NULL DEFAULT 1
 * - padding: SMALLINT NOT NULL DEFAULT 5
 * - created_at / updated_at: TIMESTAMPTZ
 *
 * Constraint: UNIQUE (organization_id, doc_type, fiscal_year)
 */

const UP = `
  CREATE TABLE IF NOT EXISTS document_sequences (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    doc_type                VARCHAR(50) NOT NULL,
    fiscal_year             VARCHAR(10) NOT NULL,
    prefix                  VARCHAR(20) NOT NULL,
    next_number             INTEGER NOT NULL DEFAULT 1,
    padding                 SMALLINT NOT NULL DEFAULT 5,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_doc_sequences_org_type_fy UNIQUE (organization_id, doc_type, fiscal_year)
  );

  CREATE INDEX IF NOT EXISTS idx_doc_sequences_lookup
    ON document_sequences(organization_id, doc_type, fiscal_year);
`;

const DOWN = `
  DROP TABLE IF EXISTS document_sequences CASCADE;
`;

module.exports = { name: '018_create_document_sequences', up: UP, down: DOWN };
