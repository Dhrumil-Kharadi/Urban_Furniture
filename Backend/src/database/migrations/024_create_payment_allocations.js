/**
 * Migration: Create payment_allocations table
 *
 * project.md §5.1.6, §5.2.6 · technicalrequirement.md §4.1, §4.2, §6.11
 *
 * Many-to-many allocation between payments and invoices or bills, enabling
 * partial payments and multi-document settlement.
 */

const UP = `
  CREATE TABLE IF NOT EXISTS payment_allocations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    payment_id       UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id       UUID NULL REFERENCES customer_invoices(id) ON DELETE RESTRICT,
    bill_id          UUID NULL REFERENCES vendor_bills(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(15,2) NOT NULL CHECK (allocated_amount > 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_allocations_target CHECK (
      (invoice_id IS NOT NULL AND bill_id IS NULL) OR
      (invoice_id IS NULL AND bill_id IS NOT NULL)
    )
  );

  CREATE INDEX IF NOT EXISTS idx_payment_allocations_org_id
    ON payment_allocations(organization_id);

  CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id
    ON payment_allocations(payment_id);

  CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id
    ON payment_allocations(invoice_id);

  CREATE INDEX IF NOT EXISTS idx_payment_allocations_bill_id
    ON payment_allocations(bill_id);
`;

const DOWN = `
  DROP TABLE IF EXISTS payment_allocations CASCADE;
`;

module.exports = { name: '024_create_payment_allocations', up: UP, down: DOWN };
