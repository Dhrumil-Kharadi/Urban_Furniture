/**
 * Migration: Create journals table
 *
 * Full column set per technicalrequirement.md §4.1:
 * - id: UUID PK default gen_random_uuid()
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - name: VARCHAR(100) NOT NULL
 * - journal_type: VARCHAR(20) NOT NULL CHECK IN (sales, purchase, bank, cash, general)
 * - default_debit_account_id: UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT
 * - default_credit_account_id: UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT
 * - sequence_prefix: VARCHAR(10)
 * - status: VARCHAR(10) NOT NULL DEFAULT 'active' CHECK IN (active, archived)
 * - created_by / updated_by: UUID REFERENCES users(id)
 * - created_at / updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *
 * Index: (organization_id)
 */

const UP = `
  CREATE TABLE IF NOT EXISTS journals (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name                      VARCHAR(100) NOT NULL,
    journal_type              VARCHAR(20) NOT NULL CHECK (journal_type IN ('sales', 'purchase', 'bank', 'cash', 'general')),
    default_debit_account_id  UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    default_credit_account_id UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    sequence_prefix           VARCHAR(10),
    status                    VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by                UUID REFERENCES users(id),
    updated_by                UUID REFERENCES users(id),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_journals_organization_id
    ON journals(organization_id);
`;

const DOWN = `
  DROP TABLE IF EXISTS journals CASCADE;
`;

module.exports = { name: '013_create_journals', up: UP, down: DOWN };
