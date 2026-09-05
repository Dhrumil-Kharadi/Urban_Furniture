/**
 * Migration: Create sales_orders and sales_order_lines tables
 *
 * Sales Flow (project.md §5.2):
 * - sales_orders: Header record for customer sales orders
 * - sales_order_lines: Line items with product, quantity, pricing, tax, and analytic tagging
 *
 * Status Lifecycle: 'draft' -> 'confirmed' -> 'invoiced' -> 'cancelled'
 */

const UP = `
  CREATE TABLE IF NOT EXISTS sales_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    so_number           VARCHAR(50) NOT NULL,
    customer_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    order_date          DATE NOT NULL,
    expected_date       DATE NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'confirmed', 'invoiced', 'cancelled')),
    untaxed_amount      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (untaxed_amount >= 0),
    tax_amount          NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount        NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    notes               TEXT NULL,
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_orders_org_number UNIQUE (organization_id, so_number)
  );

  CREATE INDEX IF NOT EXISTS idx_sales_orders_org_status
    ON sales_orders(organization_id, status);

  CREATE INDEX IF NOT EXISTS idx_sales_orders_org_customer
    ON sales_orders(organization_id, customer_contact_id);

  CREATE INDEX IF NOT EXISTS idx_sales_orders_org_date
    ON sales_orders(organization_id, order_date);

  CREATE TABLE IF NOT EXISTS sales_order_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    sales_order_id      UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
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
    income_account_id   UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_order_lines_so_line UNIQUE (sales_order_id, line_no)
  );

  CREATE INDEX IF NOT EXISTS idx_so_lines_so_id
    ON sales_order_lines(sales_order_id);

  CREATE INDEX IF NOT EXISTS idx_so_lines_org_product
    ON sales_order_lines(organization_id, product_id);

  CREATE INDEX IF NOT EXISTS idx_so_lines_org_analytic
    ON sales_order_lines(organization_id, analytic_account_id)
    WHERE analytic_account_id IS NOT NULL;
`;

const DOWN = `
  DROP TABLE IF EXISTS sales_order_lines CASCADE;
  DROP TABLE IF EXISTS sales_orders CASCADE;
`;

module.exports = { name: '021_create_sales_orders', up: UP, down: DOWN };
