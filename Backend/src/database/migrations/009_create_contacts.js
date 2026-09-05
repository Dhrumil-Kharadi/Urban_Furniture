/**
 * Migration: Create contacts table (Contact Master)
 *
 * Full column set per project.md §4.1:
 * - id: UUID PK default gen_random_uuid()
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - name: VARCHAR(150) NOT NULL
 * - contact_type: VARCHAR(10) NOT NULL CHECK IN (customer, vendor, both)
 * - email / mobile: nullable — a walk-in customer may have neither
 * - city / state / pincode: address block. pincode is 6 digits (India).
 * - profile_image_url: TEXT NULL, path served from the uploads mount
 * - portal_access_enabled: BOOLEAN NOT NULL DEFAULT false
 * - status: VARCHAR(10) NOT NULL DEFAULT 'active' CHECK IN (active, archived)
 * - created_by / updated_by: UUID REFERENCES users(id)
 * - created_at / updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *
 * Constraints & Indexes:
 * - UNIQUE (organization_id, lower(email)) WHERE email IS NOT NULL
 *   Partial + expression index, so it cannot be a table constraint.
 *   Uniqueness is per-organization: two tenants may both hold the same email.
 * - Index (organization_id), (organization_id, status), (organization_id, contact_type)
 *
 * Also lands the users.contact_id FK that migration 007 deliberately deferred
 * until this table existed. It is placed here rather than in its own file
 * because the constraint is meaningless one statement before contacts exists.
 */

const UP = `
  CREATE TABLE IF NOT EXISTS contacts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name                  VARCHAR(150) NOT NULL,
    contact_type          VARCHAR(10) NOT NULL CHECK (contact_type IN ('customer', 'vendor', 'both')),
    email                 VARCHAR(255) NULL,
    mobile                VARCHAR(20) NULL,
    city                  VARCHAR(100) NULL,
    state                 VARCHAR(100) NULL,
    pincode               VARCHAR(6) NULL CHECK (pincode IS NULL OR pincode ~ '^[0-9]{6}$'),
    profile_image_url     TEXT NULL,
    portal_access_enabled BOOLEAN NOT NULL DEFAULT false,
    status                VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by            UUID REFERENCES users(id),
    updated_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_org_email
    ON contacts (organization_id, lower(email))
    WHERE email IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_contacts_organization_id
    ON contacts(organization_id);

  CREATE INDEX IF NOT EXISTS idx_contacts_org_status
    ON contacts(organization_id, status);

  CREATE INDEX IF NOT EXISTS idx_contacts_org_type
    ON contacts(organization_id, contact_type);

  -- Deferred from 007_add_organization_to_users: users.contact_id now has a target.
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_contact_id'
    ) THEN
      ALTER TABLE users
        ADD CONSTRAINT fk_users_contact_id
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT;
    END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_users_contact_id ON users(contact_id);
`;

const DOWN = `
  ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_contact_id;
  DROP INDEX IF EXISTS idx_users_contact_id;
  DROP TABLE IF EXISTS contacts CASCADE;
`;

module.exports = { name: '009_create_contacts', up: UP, down: DOWN };
