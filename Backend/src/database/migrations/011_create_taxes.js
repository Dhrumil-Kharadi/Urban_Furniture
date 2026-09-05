/**
 * Migration: Create taxes table
 *
 * Technical Requirement §4.1:
 * - id: UUID PK DEFAULT gen_random_uuid()
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - name: VARCHAR(100) NOT NULL
 * - rate: NUMERIC(7,4) NOT NULL CHECK (rate >= 0 AND rate <= 100)
 * - tax_scope: VARCHAR(20) NOT NULL CHECK (tax_scope IN ('sales', 'purchase', 'both'))
 * - computation: VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (computation IN ('percentage', 'fixed'))
 * - collected_account_id: UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT
 * - paid_account_id: UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT
 * - status: VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
 * - created_by / updated_by: UUID REFERENCES users(id)
 * - created_at / updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *
 * Constraints & Indexes:
 * - UNIQUE (organization_id, name)
 * - Index: (organization_id)
 * - Index: (organization_id, collected_account_id)
 * - Index: (organization_id, paid_account_id)
 */

const UP = `
  CREATE TABLE IF NOT EXISTS taxes (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name                  VARCHAR(100) NOT NULL,
    rate                  NUMERIC(7,4) NOT NULL CHECK (rate >= 0 AND rate <= 100),
    tax_scope             VARCHAR(20) NOT NULL CHECK (tax_scope IN ('sales', 'purchase', 'both')),
    computation           VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (computation IN ('percentage', 'fixed')),
    collected_account_id  UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    paid_account_id       UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    status                VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by            UUID REFERENCES users(id),
    updated_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_taxes_org_name UNIQUE (organization_id, name)
  );

  CREATE INDEX IF NOT EXISTS idx_taxes_organization_id
    ON taxes(organization_id);

  CREATE INDEX IF NOT EXISTS idx_taxes_collected_account
    ON taxes(organization_id, collected_account_id);

  CREATE INDEX IF NOT EXISTS idx_taxes_paid_account
    ON taxes(organization_id, paid_account_id);
`;

const DOWN = `
  DROP TABLE IF EXISTS taxes CASCADE;
`;

module.exports = { name: '011_create_taxes', up: UP, down: DOWN };
