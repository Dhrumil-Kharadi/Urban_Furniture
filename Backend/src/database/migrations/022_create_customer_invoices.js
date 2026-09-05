/**
 * Migration: Create customer_invoices and customer_invoice_lines tables
 *
 * Customer Invoice (project.md §5.2, §7.3):
 * - customer_invoices: Accounts receivable document generated from SO or direct customer invoice
 * - customer_invoice_lines: Itemized lines that post to income accounts and output tax accounts
 * - Links to journal_entries(id) upon posting
 *
 * Status Lifecycle: 'draft' -> 'posted' -> 'partially_paid' -> 'paid' -> 'overdue' -> 'cancelled'
 */

const UP = `
  CREATE TABLE IF NOT EXISTS customer_invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    invoice_number      VARCHAR(50) NOT NULL,
    sales_order_id      UUID NULL REFERENCES sales_orders(id) ON DELETE SET NULL,
    customer_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    invoice_date        DATE NOT NULL,
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
    CONSTRAINT uq_customer_invoices_org_number UNIQUE (organization_id, invoice_number)
  );

  CREATE INDEX IF NOT EXISTS idx_customer_invoices_org_status
    ON customer_invoices(organization_id, status);

  CREATE INDEX IF NOT EXISTS idx_customer_invoices_org_customer
    ON customer_invoices(organization_id, customer_contact_id);

  CREATE INDEX IF NOT EXISTS idx_customer_invoices_org_date
    ON customer_invoices(organization_id, invoice_date);

  CREATE INDEX IF NOT EXISTS idx_customer_invoices_org_so
    ON customer_invoices(organization_id, sales_order_id)
    WHERE sales_order_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_customer_invoices_org_je
    ON customer_invoices(organization_id, journal_entry_id)
    WHERE journal_entry_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS customer_invoice_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    customer_invoice_id UUID NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
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
    income_account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_invoice_lines_inv_line UNIQUE (customer_invoice_id, line_no)
  );

  CREATE INDEX IF NOT EXISTS idx_customer_inv_lines_inv_id
    ON customer_invoice_lines(customer_invoice_id);

  CREATE INDEX IF NOT EXISTS idx_customer_inv_lines_org_product
    ON customer_invoice_lines(organization_id, product_id);

  CREATE INDEX IF NOT EXISTS idx_customer_inv_lines_org_analytic
    ON customer_invoice_lines(organization_id, analytic_account_id)
    WHERE analytic_account_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_customer_inv_lines_org_income
    ON customer_invoice_lines(organization_id, income_account_id);
`;

const DOWN = `
  DROP TABLE IF EXISTS customer_invoice_lines CASCADE;
  DROP TABLE IF EXISTS customer_invoices CASCADE;
`;

module.exports = { name: '022_create_customer_invoices', up: UP, down: DOWN };
