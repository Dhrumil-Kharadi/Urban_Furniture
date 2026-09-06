/**
 * Migration: Add description to products table
 */
const UP = `
  ALTER TABLE products
    ADD COLUMN IF NOT EXISTS description TEXT NULL;
`;

const DOWN = `
  ALTER TABLE products
    DROP COLUMN IF EXISTS description;
`;

module.exports = { name: '030_add_product_description', up: UP, down: DOWN };
