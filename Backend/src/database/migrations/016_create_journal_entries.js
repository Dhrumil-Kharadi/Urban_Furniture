/**
 * Migration: Create journal_entries table
 *
 * project.md §4.5 — the header of a double-entry posting.
 *
 * - id: UUID PK default gen_random_uuid()
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - journal_id: UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT
 * - entry_number: VARCHAR(50) NOT NULL — from the JE sequence
 * - entry_date: DATE NOT NULL — the accounting date, not the wall clock
 * - reference: VARCHAR(100) NULL — e.g. the invoice or bill number
 * - narration: TEXT NULL
 * - status: draft | posted | reversed
 * - is_auto_generated: BOOLEAN — §4.5's flag, true when a transaction created it
 * - source_type / source_id: what produced it (invoice, bill, payment)
 * - reversed_by_entry_id: the mirror entry that cancelled this one
 * - posted_at: TIMESTAMPTZ NULL — set at the moment of posting
 *
 * Constraints & Indexes:
 * - UNIQUE (organization_id, entry_number)
 * - Index (organization_id, entry_date) — every report filters on this
 * - Index (organization_id, source_type, source_id) — "show me this invoice's entry"
 *
 * IMMUTABILITY: a posted entry is never edited. Correction is by reversing
 * entry only, which is enforced by triggers in migration 028 rather than left
 * to the application — see that file for why.
 */

const UP = `
  CREATE TABLE IF NOT EXISTS journal_entries (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    journal_id            UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
    entry_number          VARCHAR(50) NOT NULL,
    entry_date            DATE NOT NULL,
    reference             VARCHAR(100) NULL,
    narration             TEXT NULL,
    status                VARCHAR(10) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'posted', 'reversed')),
    is_auto_generated     BOOLEAN NOT NULL DEFAULT false,
    source_type           VARCHAR(50) NULL,
    source_id             UUID NULL,
    reversed_by_entry_id  UUID NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    posted_at             TIMESTAMPTZ NULL,
    created_by            UUID REFERENCES users(id),
    updated_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_journal_entries_org_number UNIQUE (organization_id, entry_number)
  );

  CREATE INDEX IF NOT EXISTS idx_journal_entries_org_date
    ON journal_entries(organization_id, entry_date);

  CREATE INDEX IF NOT EXISTS idx_journal_entries_org_source
    ON journal_entries(organization_id, source_type, source_id);

  CREATE INDEX IF NOT EXISTS idx_journal_entries_org_status
    ON journal_entries(organization_id, status);

  CREATE INDEX IF NOT EXISTS idx_journal_entries_journal
    ON journal_entries(organization_id, journal_id);
`;

const DOWN = `
  DROP TABLE IF EXISTS journal_entries CASCADE;
`;

module.exports = { name: '016_create_journal_entries', up: UP, down: DOWN };
