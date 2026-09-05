/**
 * Migration: Create products table (Product Master)
 *
 * Full column set per project.md §4.2:
 * - id: UUID PK default gen_random_uuid()
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - name: VARCHAR(150) NOT NULL
 * - sku: VARCHAR(64) NULL — optional, but unique within the organization when set
 * - product_type: VARCHAR(10) NOT NULL CHECK IN (goods, service, combo)
 * - category_id: UUID NULL REFERENCES product_categories(id) ON DELETE RESTRICT
 * - sales_price / cost_price: NUMERIC(15,2) — money is never FLOAT
 * - sales_tax_id / purchase_tax_id: UUID NULL REFERENCES taxes(id)
 * - income_account_id / expense_account_id: UUID NULL REFERENCES accounts(id)
 * - status: VARCHAR(10) NOT NULL DEFAULT 'active' CHECK IN (active, archived)
 * - created_by / updated_by: UUID REFERENCES users(id)
 * - created_at / updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *
 * Constraints & Indexes:
 * - UNIQUE (organization_id, sku) WHERE sku IS NOT NULL — partial, so many
 *   products may have no SKU while every SKU that exists is unique per tenant.
 * - Index (organization_id), (organization_id, status), (organization_id, category_id)
 *
 * ACCOUNTING NOTE — repricing or archiving a product must never alter a
 * historical document line. Document lines (Phases 8/9) copy name, price and
 * tax rate at the moment of sale; they do not join back to this table for
 * money. That is what keeps a reprint of last year's invoice identical to
 * what the customer was actually charged.
 */

const UP = `
  CREATE TABLE IF NOT EXISTS products (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name                VARCHAR(150) NOT NULL,
    sku                 VARCHAR(64) NULL,
    product_type        VARCHAR(10) NOT NULL CHECK (product_type IN ('goods', 'service', 'combo')),
    category_id         UUID NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
    sales_price         NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (sales_price >= 0),
    cost_price          NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    sales_tax_id        UUID NULL REFERENCES taxes(id) ON DELETE RESTRICT,
    purchase_tax_id     UUID NULL REFERENCES taxes(id) ON DELETE RESTRICT,
    income_account_id   UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    expense_account_id  UUID NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    status              VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_products_org_sku
    ON products (organization_id, sku)
    WHERE sku IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_products_organization_id
    ON products(organization_id);

  CREATE INDEX IF NOT EXISTS idx_products_org_status
    ON products(organization_id, status);

  CREATE INDEX IF NOT EXISTS idx_products_org_category
    ON products(organization_id, category_id);
`;

const DOWN = `
  DROP TABLE IF EXISTS products CASCADE;
`;

module.exports = { name: '012_create_products', up: UP, down: DOWN };
