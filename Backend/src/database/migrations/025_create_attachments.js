/**
 * Migration: Create attachments table
 *
 * Scoped file attachments for financial documents (vendor bills, customer invoices, etc.).
 * Reference: project.md §9.5 · technicalrequirement.md §6.13 · phase.md Phase 13
 *
 * Columns:
 * - id: UUID PK
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - entity_type: VARCHAR(50) NOT NULL (e.g. vendor_bill, customer_invoice)
 * - entity_id: UUID NOT NULL
 * - file_name: VARCHAR(255) NOT NULL (original user filename)
 * - file_path: TEXT NOT NULL (storage path outside web root)
 * - file_size: INTEGER NOT NULL (max 5MB = 5,242,880 bytes)
 * - mime_type: VARCHAR(100) NOT NULL (validated by magic bytes)
 * - created_by: UUID REFERENCES users(id) ON DELETE SET NULL
 * - created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 */

const UP = `
  CREATE TABLE IF NOT EXISTS attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_path       TEXT NOT NULL,
    file_size       INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
    mime_type       VARCHAR(100) NOT NULL,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_attachments_lookup
    ON attachments (organization_id, entity_type, entity_id, created_at DESC);
`;

const DOWN = `
  DROP TABLE IF EXISTS attachments CASCADE;
`;

module.exports = { name: '025_create_attachments', up: UP, down: DOWN };
