/**
 * Migration: Create notifications table
 *
 * Scoped notifications log for emails and trigger events.
 * Written as 'pending' inside the business transaction, dispatched after commit.
 * Reference: project.md §9.7 · technicalrequirement.md §9.6 · phase.md Phase 13
 *
 * Columns:
 * - id: UUID PK
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - recipient_email: VARCHAR(255) NOT NULL
 * - subject: VARCHAR(255) NOT NULL
 * - body_html: TEXT NOT NULL
 * - trigger_event: VARCHAR(50) NOT NULL
 * - entity_type: VARCHAR(50) NULL
 * - entity_id: UUID NULL
 * - status: VARCHAR(20) NOT NULL DEFAULT 'pending'
 * - retry_count: INTEGER NOT NULL DEFAULT 0
 * - error_message: TEXT NULL
 * - sent_at: TIMESTAMPTZ NULL
 * - created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 */

const UP = `
  CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    recipient_email VARCHAR(255) NOT NULL,
    subject         VARCHAR(255) NOT NULL,
    body_html       TEXT NOT NULL,
    trigger_event   VARCHAR(50) NOT NULL,
    entity_type     VARCHAR(50) NULL,
    entity_id       UUID NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    retry_count     INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT NULL,
    sent_at         TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_org_status
    ON notifications (organization_id, status, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_notifications_retry
    ON notifications (status, retry_count)
    WHERE status = 'pending';
`;

const DOWN = `
  DROP TABLE IF EXISTS notifications CASCADE;
`;

module.exports = { name: '027_create_notifications', up: UP, down: DOWN };
