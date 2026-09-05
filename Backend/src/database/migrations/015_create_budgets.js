/**
 * Migration: Create budgets table
 *
 * project.md §4.7, §8 · technicalrequirement.md §4.1, §6.7
 *
 * A budget sets a planned monetary target for an analytic account over a
 * specific date period. Actual amounts are aggregated on read from
 * journal_entry_lines tagged with that analytic_account_id on posted entries.
 */

const UP = `
  CREATE TABLE IF NOT EXISTS budgets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name                VARCHAR(150) NOT NULL,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    analytic_account_id UUID NOT NULL REFERENCES analytic_accounts(id) ON DELETE RESTRICT,
    planned_amount      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (planned_amount >= 0),
    status              VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_budgets_period CHECK (period_end >= period_start)
  );

  CREATE INDEX IF NOT EXISTS idx_budgets_organization_id
    ON budgets(organization_id);

  CREATE INDEX IF NOT EXISTS idx_budgets_org_analytic
    ON budgets(organization_id, analytic_account_id);

  CREATE INDEX IF NOT EXISTS idx_budgets_org_status
    ON budgets(organization_id, status);
`;

const DOWN = `
  DROP TABLE IF EXISTS budgets CASCADE;
`;

module.exports = { name: '015_create_budgets', up: UP, down: DOWN };
