/**
 * Migration: Create vendor_bills and vendor_bill_lines tables
 *
 * Vendor Bill (project.md §5.1, §7.2):
 * - vendor_bills: Accounts payable document generated from PO or direct vendor invoice
 * - vendor_bill_lines: Itemized lines that post to expense accounts and input tax accounts
 * - Links to journal_entries(id) upon posting
 *
 * Status Lifecycle: 'draft' -> 'posted' -> 'partially_paid' -> 'paid' -> 'overdue' -> 'cancelled'
 */

const UP = `
  CREATE TABLE IF NOT EXISTS vendor_bills (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    bill_number         VARCHAR(50) NOT NULL,
    purchase_order_id   UUID NULL REFERENCES purchase_orders(id) ON DELETE SET NULL,
    vendor_contact_id   UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    bill_date           DATE NOT NULL,
    due_date            DATE NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'posted', 'partially_paid', 'paid', 'overdue', 'cancelled')),
    untaxed_amount      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (untaxed_amount >= 0),
    tax_amount          NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount        NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    amount_due          NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount_due >= 0),
    amount_paid         NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    journal_id          UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
    journal_entry_id    UUID NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    notes               TEXT NULL,
    posted_at           TIMESTAMPTZ NULL,
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vendor_bills_org_number UNIQUE (organization_id, bill_number)
  );

  CREATE INDEX IF NOT EXISTS idx_vendor_bills_org_status
    ON vendor_bills(organization_id, status);

  CREATE INDEX IF NOT EXISTS idx_vendor_bills_org_vendor
    ON vendor_bills(organization_id, vendor_contact_id);

  CREATE INDEX IF NOT EXISTS idx_vendor_bills_org_date
    ON vendor_bills(organization_id, bill_date);

  CREATE INDEX IF NOT EXISTS idx_vendor_bills_org_po
    ON vendor_bills(organization_id, purchase_order_id)
    WHERE purchase_order_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_vendor_bills_org_je
    ON vendor_bills(organization_id, journal_entry_id)
    WHERE journal_entry_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS vendor_bill_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    vendor_bill_id      UUID NOT NULL REFERENCES vendor_bills(id) ON DELETE CASCADE,
    line_no             INTEGER NOT NULL,
    product_id          UUID NULL REFERENCES products(id) ON DELETE RESTRICT,
    description         TEXT NOT NULL,
    quantity            NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
    unit_price          NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
    tax_id              UUID NULL REFERENCES taxes(id) ON DELETE RESTRICT,
    tax_rate            NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    untaxed_amount      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (untaxed_amount >= 0),
    tax_amount          NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount        NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    analytic_account_id UUID NULL REFERENCES analytic_accounts(id) ON DELETE RESTRICT,
    expense_account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vendor_bill_lines_bill_line UNIQUE (vendor_bill_id, line_no)
  );

  CREATE INDEX IF NOT EXISTS idx_vendor_bill_lines_bill_id
    ON vendor_bill_lines(vendor_bill_id);

  CREATE INDEX IF NOT EXISTS idx_vendor_bill_lines_org_product
    ON vendor_bill_lines(organization_id, product_id);

  CREATE INDEX IF NOT EXISTS idx_vendor_bill_lines_org_analytic
    ON vendor_bill_lines(organization_id, analytic_account_id)
    WHERE analytic_account_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_vendor_bill_lines_org_expense
    ON vendor_bill_lines(organization_id, expense_account_id);
`;

const DOWN = `
  DROP TABLE IF EXISTS vendor_bill_lines CASCADE;
  DROP TABLE IF EXISTS vendor_bills CASCADE;
`;

module.exports = { name: '020_create_vendor_bills', up: UP, down: DOWN };
