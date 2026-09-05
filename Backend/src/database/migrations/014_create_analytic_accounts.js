/**
 * Migration: Create analytic_accounts table
 *
 * project.md §4.6 / §8 — the cost-centre dimension. Transactions are optionally
 * tagged with an analytic account ("Retail Store - Ahmedabad", "Online Sales"),
 * and the Budget Report compares a budget's planned amount against the sum of
 * journal lines carrying that tag.
 *
 * Without this dimension the Budget Report has no "actual" figure to compare
 * against "planned", and §8 is unimplementable.
 *
 * - id: UUID PK default gen_random_uuid()
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - code: VARCHAR(50) NULL — optional short handle, unique per org when present
 * - name: VARCHAR(150) NOT NULL
 * - analytic_type: VARCHAR(10) NOT NULL CHECK IN (income, expense)
 * - department: VARCHAR(150) NULL — the optional descriptive field of §4.6
 * - status: VARCHAR(10) NOT NULL DEFAULT 'active' CHECK IN (active, archived)
 * - created_by / updated_by: UUID REFERENCES users(id)
 * - created_at / updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *
 * Constraints & Indexes:
 * - UNIQUE (organization_id, lower(name)) — per-organization, never global
 * - UNIQUE (organization_id, code) WHERE code IS NOT NULL
 * - Index (organization_id), (organization_id, status)
 */

const UP = `
  CREATE TABLE IF NOT EXISTS analytic_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    code            VARCHAR(50) NULL,
    name            VARCHAR(150) NOT NULL,
    analytic_type   VARCHAR(10) NOT NULL CHECK (analytic_type IN ('income', 'expense')),
    department      VARCHAR(150) NULL,
    status          VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_analytic_accounts_org_name
    ON analytic_accounts (organization_id, lower(name));

  CREATE UNIQUE INDEX IF NOT EXISTS uq_analytic_accounts_org_code
    ON analytic_accounts (organization_id, code)
    WHERE code IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_analytic_accounts_organization_id
    ON analytic_accounts(organization_id);

  CREATE INDEX IF NOT EXISTS idx_analytic_accounts_org_status
    ON analytic_accounts(organization_id, status);
`;

const DOWN = `
  DROP TABLE IF EXISTS analytic_accounts CASCADE;
`;

module.exports = { name: '014_create_analytic_accounts', up: UP, down: DOWN };
