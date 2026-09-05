/**
 * Migration: Create payment_allocations table
 *
 * WHY THIS TABLE IS REQUIRED, NOT OPTIONAL
 *
 * project.md §5.1.6 and §5.2.6 define a 'partially_paid' status. That status
 * is only reachable if a payment can be SMALLER than the balance — and once
 * that is true, the relationship is many-to-many in both directions:
 *
 *   - one payment may settle several invoices (a customer pays three at once)
 *   - one invoice may receive several partial payments (a deposit, then the
 *     balance)
 *
 * A nullable invoice_id on the payment row cannot express either. Without this
 * resolution table, 'partially_paid' is a status nothing can produce and the
 * two lifecycles in project.md are unimplementable.
 *
 * EXACTLY ONE of customer_invoice_id / vendor_bill_id is non-null. An
 * allocation pointing at both, or at neither, is money with no home — the
 * CHECK constraint below makes that unrepresentable rather than merely
 * discouraged.
 *
 * The UNIQUE constraints stop the same payment being allocated to the same
 * document twice, which would double-count against amount_due.
 */

const UP = `
  CREATE TABLE IF NOT EXISTS payment_allocations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    payment_id            UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    customer_invoice_id   UUID NULL REFERENCES customer_invoices(id) ON DELETE RESTRICT,
    vendor_bill_id        UUID NULL REFERENCES vendor_bills(id) ON DELETE RESTRICT,
    allocated_amount      NUMERIC(15,2) NOT NULL CHECK (allocated_amount > 0),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Exactly one target. Money allocated to both documents or to none is
    -- money the ledger cannot account for.
    CONSTRAINT ck_payment_allocations_one_target CHECK (
      (customer_invoice_id IS NOT NULL AND vendor_bill_id IS NULL)
      OR
      (customer_invoice_id IS NULL AND vendor_bill_id IS NOT NULL)
    )
  );

  -- One payment settles a given document at most once. A second allocation to
  -- the same pair would be counted twice against amount_due.
  CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_allocations_payment_invoice
    ON payment_allocations(payment_id, customer_invoice_id)
    WHERE customer_invoice_id IS NOT NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_allocations_payment_bill
    ON payment_allocations(payment_id, vendor_bill_id)
    WHERE vendor_bill_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment
    ON payment_allocations(payment_id);

  -- "What has been paid against this invoice?" — the query the detail page and
  -- the open-items statement both run.
  CREATE INDEX IF NOT EXISTS idx_payment_allocations_org_invoice
    ON payment_allocations(organization_id, customer_invoice_id)
    WHERE customer_invoice_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_payment_allocations_org_bill
    ON payment_allocations(organization_id, vendor_bill_id)
    WHERE vendor_bill_id IS NOT NULL;
`;

const DOWN = `
  DROP TABLE IF EXISTS payment_allocations CASCADE;
`;

module.exports = { name: '024_create_payment_allocations', up: UP, down: DOWN };
