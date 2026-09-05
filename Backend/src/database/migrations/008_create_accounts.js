/**
 * Migration: Create accounts table (Chart of Accounts)
 *
 * Full column set per technicalrequirement.md §4.1:
 * - id: UUID PK default gen_random_uuid()
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - code: VARCHAR(50) NOT NULL
 * - name: VARCHAR(150) NOT NULL
 * - account_type: VARCHAR(20) NOT NULL CHECK IN (asset, liability, expense, income, capital)
 * - parent_account_id: UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT
 * - opening_balance: NUMERIC(15,2) NOT NULL DEFAULT 0
 * - is_system: BOOLEAN NOT NULL DEFAULT false
 * - status: VARCHAR(10) NOT NULL DEFAULT 'active' CHECK IN (active, archived)
 * - created_by / updated_by: UUID REFERENCES users(id)
 * - created_at / updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *
 * Constraints & Indexes:
 * - UNIQUE (organization_id, code)
 * - Index (organization_id)
 * - Index (organization_id, account_type)
 */

const UP = `
  CREATE TABLE IF NOT EXISTS accounts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    code              VARCHAR(50) NOT NULL,
    name              VARCHAR(150) NOT NULL,
    account_type      VARCHAR(20) NOT NULL CHECK (account_type IN ('asset', 'liability', 'expense', 'income', 'capital')),
    parent_account_id UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    opening_balance   NUMERIC(15,2) NOT NULL DEFAULT 0,
    is_system         BOOLEAN NOT NULL DEFAULT false,
    status            VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by        UUID REFERENCES users(id),
    updated_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_accounts_org_code UNIQUE (organization_id, code)
  );

  CREATE INDEX IF NOT EXISTS idx_accounts_organization_id
    ON accounts(organization_id);

  CREATE INDEX IF NOT EXISTS idx_accounts_org_type
    ON accounts(organization_id, account_type);

  -- Ensure users has status column and otp_verifications allows 'invite'
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'invited'));

  DO $$
  BEGIN
    ALTER TABLE otp_verifications DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;
    ALTER TABLE otp_verifications ADD CONSTRAINT otp_verifications_purpose_check
      CHECK (purpose IN ('email_verification', 'password_reset', 'invite'));
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END $$;
`;

const DOWN = `
  DROP TABLE IF EXISTS accounts CASCADE;
`;

module.exports = { name: '008_create_accounts', up: UP, down: DOWN };
