/**
 * Migration: Add available_qty column to products table
 *
 * Tracks quantity on hand / available stock for products (goods).
 * Defaults to 0.
 */

const UP = `
  ALTER TABLE products
    ADD COLUMN IF NOT EXISTS available_qty NUMERIC(15,2) NOT NULL DEFAULT 0;

  CREATE INDEX IF NOT EXISTS idx_products_org_stock
    ON products(organization_id, available_qty);
`;

const DOWN = `
  DROP INDEX IF EXISTS idx_products_org_stock;
  ALTER TABLE products DROP COLUMN IF EXISTS available_qty;
`;

module.exports = { name: '031_add_product_available_qty', up: UP, down: DOWN };
