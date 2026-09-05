/**
 * Migration: Create journal_entry_lines table
 *
 * project.md §4.5 — each line is Account, Debit, Credit.
 *
 * - journal_entry_id: ON DELETE CASCADE, so a draft entry's lines go with it
 * - organization_id: denormalised from the header so every reporting index can
 *   lead with the tenant. Joining back to the header on every balance query
 *   would make the hottest query in the system pay for that join.
 * - line_no: the line's position, unique within its entry
 * - account_id: what is debited or credited
 * - partner_contact_id: the customer or vendor a receivable/payable line is
 *   against, so an open-items statement does not have to walk back to the
 *   source document
 * - analytic_account_id: project.md §8 — the cost-centre tag the Budget Report
 *   sums its "actual" figures from. Without it §8 is unimplementable.
 * - debit / credit: NUMERIC(15,2). Never FLOAT.
 *
 * THE LINE CHECK CONSTRAINT:
 *   CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit + credit) > 0)
 * A line is a debit or a credit, never both, never neither, never negative.
 * A negative credit is arithmetically the same as a debit but reports read the
 * two columns separately, so allowing it would quietly break every one of them.
 *
 * Indexes:
 * - (journal_entry_id) — fetch an entry with its lines
 * - (organization_id, account_id, journal_entry_id) — the hottest report query:
 *   every trial balance, Balance Sheet and P&L groups lines by account
 * - (organization_id, analytic_account_id) WHERE NOT NULL — Budget Report
 */

const UP = `
  CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    journal_entry_id     UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_no              INTEGER NOT NULL,
    account_id           UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    partner_contact_id   UUID NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    analytic_account_id  UUID NULL REFERENCES analytic_accounts(id) ON DELETE RESTRICT,
    debit                NUMERIC(15,2) NOT NULL DEFAULT 0,
    credit               NUMERIC(15,2) NOT NULL DEFAULT 0,
    description          TEXT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_journal_entry_lines_sides CHECK (
      debit >= 0
      AND credit >= 0
      AND (debit = 0 OR credit = 0)
      AND (debit + credit) > 0
    ),
    CONSTRAINT uq_journal_entry_lines_entry_line UNIQUE (journal_entry_id, line_no)
  );

  CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry
    ON journal_entry_lines(journal_entry_id);

  CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_org_account_entry
    ON journal_entry_lines(organization_id, account_id, journal_entry_id);

  CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_org_analytic
    ON journal_entry_lines(organization_id, analytic_account_id)
    WHERE analytic_account_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_org_partner
    ON journal_entry_lines(organization_id, partner_contact_id)
    WHERE partner_contact_id IS NOT NULL;
`;

const DOWN = `
  DROP TABLE IF EXISTS journal_entry_lines CASCADE;
`;

module.exports = { name: '017_create_journal_entry_lines', up: UP, down: DOWN };
