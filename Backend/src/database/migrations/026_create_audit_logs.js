/**
 * Migration: Create audit_logs table
 *
 * Captures all state-changing actions on financial documents and master data.
 * Written inside the caller's transaction.
 *
 * Columns:
 * - id: UUID PK
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - actor_user_id: UUID REFERENCES users(id) ON DELETE SET NULL
 * - action: VARCHAR(50) NOT NULL (e.g. create, update, post, reverse, archive)
 * - entity_type: VARCHAR(50) NOT NULL (e.g. invoice, bill, payment, product, contact)
 * - entity_id: UUID NOT NULL
 * - before: JSONB
 * - after: JSONB
 * - ip_address: INET
 * - created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 */

const UP = `
  CREATE TABLE IF NOT EXISTS audit_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    actor_user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
    action                  VARCHAR(50) NOT NULL,
    entity_type             VARCHAR(50) NOT NULL,
    entity_id               UUID NOT NULL,
    before                  JSONB,
    after                   JSONB,
    ip_address              INET,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_lookup
    ON audit_logs (organization_id, entity_type, entity_id, created_at DESC);
`;

const DOWN = `
  DROP TABLE IF EXISTS audit_logs CASCADE;
`;

module.exports = { name: '026_create_audit_logs', up: UP, down: DOWN };
