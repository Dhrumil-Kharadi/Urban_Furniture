/**
 * Migration: Create payments table
 *
 * project.md §5.1.5 / §5.2.5 — money actually moving, in either direction.
 *
 * ONE table for both directions rather than receipts and disbursements
 * separately: the lifecycle, the allocation model and the cancellation rules
 * are identical, and `direction` is the only thing that differs. Two tables
 * would mean maintaining the same overpayment guard twice.
 *
 *   direction = 'inbound'   money received from a customer  (Dr Cash/Bank, Cr Debtors)
 *   direction = 'outbound'  money paid to a vendor          (Dr Creditors, Cr Cash/Bank)
 *
 * THE JOURNAL MUST MATCH THE METHOD — a cash payment posts through a cash
 * journal, a bank payment through a bank journal. Getting this wrong credits
 * the WRONG ASSET ACCOUNT, and the error is invisible until someone
 * reconciles the bank. The service enforces it; `method` is stored so the
 * check is auditable after the fact.
 *
 * Cancellation REVERSES, never deletes: a payment that has hit the ledger is
 * history, and history is corrected by a reversing entry
 * (technicalrequirement.md §3.8).
 */

const UP = `
  CREATE TABLE IF NOT EXISTS payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    payment_number      VARCHAR(50) NOT NULL,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    direction           VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    method              VARCHAR(10) NOT NULL CHECK (method IN ('cash', 'bank', 'card')),
    payment_date        DATE NOT NULL,
    amount              NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    reference           VARCHAR(100) NULL,
    notes               TEXT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'posted'
                        CHECK (status IN ('posted', 'cancelled')),
    journal_id          UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
    journal_entry_id    UUID NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    -- The Cash / Bank / Gateway Clearing account the money moved through.
    cash_account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    -- Set when a card payment came through the gateway, for reconciliation.
    gateway_payment_id  VARCHAR(100) NULL,
    posted_at           TIMESTAMPTZ NULL,
    cancelled_at        TIMESTAMPTZ NULL,
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payments_org_number UNIQUE (organization_id, payment_number)
  );

  CREATE INDEX IF NOT EXISTS idx_payments_org_status
    ON payments(organization_id, status);

  CREATE INDEX IF NOT EXISTS idx_payments_org_contact
    ON payments(organization_id, contact_id);

  CREATE INDEX IF NOT EXISTS idx_payments_org_date
    ON payments(organization_id, payment_date);

  CREATE INDEX IF NOT EXISTS idx_payments_org_direction
    ON payments(organization_id, direction, status);

  CREATE INDEX IF NOT EXISTS idx_payments_org_je
    ON payments(organization_id, journal_entry_id)
    WHERE journal_entry_id IS NOT NULL;
`;

const DOWN = `
  DROP TABLE IF EXISTS payments CASCADE;
`;

module.exports = { name: '023_create_payments', up: UP, down: DOWN };
