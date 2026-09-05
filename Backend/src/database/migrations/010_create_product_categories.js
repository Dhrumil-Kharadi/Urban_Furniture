/**
 * Migration: Create product_categories table
 *
 * Products reference a category (project.md §4.2 "Category"). Modelling it as
 * its own table rather than a free-text column keeps category names spelled
 * consistently, which is what makes a category-grouped P&L meaningful later.
 *
 * - id: UUID PK default gen_random_uuid()
 * - organization_id: UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
 * - name: VARCHAR(100) NOT NULL
 * - description: TEXT NULL
 * - status: VARCHAR(10) NOT NULL DEFAULT 'active' CHECK IN (active, archived)
 * - created_by / updated_by: UUID REFERENCES users(id)
 * - created_at / updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *
 * Constraints & Indexes:
 * - UNIQUE (organization_id, lower(name)) — per-organization, never global
 * - Index (organization_id), (organization_id, status)
 */

const UP = `
  CREATE TABLE IF NOT EXISTS product_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name            VARCHAR(100) NOT NULL,
    description     TEXT NULL,
    status          VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_product_categories_org_name
    ON product_categories (organization_id, lower(name));

  CREATE INDEX IF NOT EXISTS idx_product_categories_organization_id
    ON product_categories(organization_id);

  CREATE INDEX IF NOT EXISTS idx_product_categories_org_status
    ON product_categories(organization_id, status);
`;

const DOWN = `
  DROP TABLE IF EXISTS product_categories CASCADE;
`;

module.exports = { name: '010_create_product_categories', up: UP, down: DOWN };
