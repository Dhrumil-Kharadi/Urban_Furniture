/**
 * Migration: Create taxes table
 *
 * SCOPE NOTE — this migration belongs to Phase 5 (Master Data A), not Phase 6.
 * It is landed here as a TABLE ONLY, with no module, routes or seed data,
 * because products.sales_tax_id / purchase_tax_id in 012 need a real foreign
 * key target and a UUID column with no constraint is exactly the kind of
 * silently-wrong reference an accounting system cannot afford.
 *
 * The schema is the one phase.md specifies for Phase 5 §Taxes, so Phase 5 can
 * build accounts/journals/taxes/analytics on top of it without a further
 * migration or a column rewrite.
 *
 * - rate NUMERIC(7,4) CHECK 0-100 — a rate is a rate, never a float
 * - tax_scope: sales | purchase | both (Phase 0 Decision 4 = both)
 * - tax_account_id must be the tax's OWN CoA account: project.md §7 requires
 *   tax to post separately, never folded into Sales Income.
 */

const UP = `
  CREATE TABLE IF NOT EXISTS taxes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name            VARCHAR(100) NOT NULL,
    rate            NUMERIC(7,4) NOT NULL CHECK (rate >= 0 AND rate <= 100),
    tax_scope       VARCHAR(10) NOT NULL DEFAULT 'both' CHECK (tax_scope IN ('sales', 'purchase', 'both')),
    tax_account_id  UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    status          VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT taxes_name_org_key UNIQUE (organization_id, name)
  );

  CREATE INDEX IF NOT EXISTS idx_taxes_organization_id
    ON taxes(organization_id);

  CREATE INDEX IF NOT EXISTS idx_taxes_org_status
    ON taxes(organization_id, status);
`;

const DOWN = `
  DROP TABLE IF EXISTS taxes CASCADE;
`;

module.exports = { name: '011_create_taxes', up: UP, down: DOWN };
