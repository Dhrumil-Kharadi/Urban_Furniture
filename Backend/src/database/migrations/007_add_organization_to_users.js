/**
 * Migration: Add organization_id, contact_id, and must_change_password to users
 *
 * Scopes users to organizations (NULL for platform super_admin).
 * Prepares contact_id (FK constraint deferred to Phase 6 when contacts table exists).
 * Adds must_change_password flag for invited/reset accounts.
 */

const UP = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS organization_id UUID NULL REFERENCES organizations(id),
    ADD COLUMN IF NOT EXISTS contact_id UUID NULL,
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

  CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
`;

const DOWN = `
  DROP INDEX IF EXISTS idx_users_organization_id;

  ALTER TABLE users
    DROP COLUMN IF EXISTS organization_id,
    DROP COLUMN IF EXISTS contact_id,
    DROP COLUMN IF EXISTS must_change_password;
`;

module.exports = { name: '007_add_organization_to_users', up: UP, down: DOWN };
