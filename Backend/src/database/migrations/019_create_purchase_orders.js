/**
 * Migration: Create purchase_orders and purchase_order_lines tables
 *
 * Purchase Flow (project.md §5.1):
 * - purchase_orders: Header record for procurement orders from vendors
 * - purchase_order_lines: Line-level items with product, quantity, pricing, tax, and analytic tagging
 *
 * Status Lifecycle: 'draft' -> 'confirmed' -> 'billed' -> 'cancelled'
 */

const UP = `
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    po_number           VARCHAR(50) NOT NULL,
    vendor_contact_id   UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    order_date          DATE NOT NULL,
    expected_date       DATE NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'confirmed', 'billed', 'cancelled')),
    untaxed_amount      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (untaxed_amount >= 0),
    tax_amount          NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount        NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    notes               TEXT NULL,
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_purchase_orders_org_number UNIQUE (organization_id, po_number)
  );

  CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_status
    ON purchase_orders(organization_id, status);

  CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_vendor
    ON purchase_orders(organization_id, vendor_contact_id);

  CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_date
    ON purchase_orders(organization_id, order_date);

  CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
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
    expense_account_id  UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_purchase_order_lines_po_line UNIQUE (purchase_order_id, line_no)
  );

  CREATE INDEX IF NOT EXISTS idx_po_lines_po_id
    ON purchase_order_lines(purchase_order_id);

  CREATE INDEX IF NOT EXISTS idx_po_lines_org_product
    ON purchase_order_lines(organization_id, product_id);

  CREATE INDEX IF NOT EXISTS idx_po_lines_org_analytic
    ON purchase_order_lines(organization_id, analytic_account_id)
    WHERE analytic_account_id IS NOT NULL;
`;

const DOWN = `
  DROP TABLE IF EXISTS purchase_order_lines CASCADE;
  DROP TABLE IF EXISTS purchase_orders CASCADE;
`;

module.exports = { name: '019_create_purchase_orders', up: UP, down: DOWN };
