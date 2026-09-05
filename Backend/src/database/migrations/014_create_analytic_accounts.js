/**
 * Migration: Create analytic_accounts table
 *
 * Technical Requirement §4.1:
 * - id: UUID PK DEFAULT gen_random_uuid()
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - name: VARCHAR(150) NOT NULL
 * - code: VARCHAR(50) NULL
 * - analytic_type: VARCHAR(20) NOT NULL CHECK (analytic_type IN ('income', 'expense'))
 * - department_or_project: VARCHAR(100) NULL
 * - status: VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
 * - created_by / updated_by: UUID REFERENCES users(id)
 * - created_at / updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *
 * Constraints & Indexes:
 * - UNIQUE (organization_id, name)
 * - Index: (organization_id)
 * - Index: (organization_id, analytic_type)
 */

const UP = `
  CREATE TABLE IF NOT EXISTS analytic_accounts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name                  VARCHAR(150) NOT NULL,
    code                  VARCHAR(50) NULL,
    analytic_type         VARCHAR(20) NOT NULL CHECK (analytic_type IN ('income', 'expense')),
    department_or_project VARCHAR(100) NULL,
    status                VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by            UUID REFERENCES users(id),
    updated_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_analytic_accounts_org_name UNIQUE (organization_id, name)
  );

  CREATE INDEX IF NOT EXISTS idx_analytic_accounts_organization_id
    ON analytic_accounts(organization_id);

  CREATE INDEX IF NOT EXISTS idx_analytic_accounts_org_type
    ON analytic_accounts(organization_id, analytic_type);
`;

const DOWN = `
  DROP TABLE IF EXISTS analytic_accounts CASCADE;
`;

module.exports = { name: '014_create_analytic_accounts', up: UP, down: DOWN };
