/**
 * Migration: Create organizations table
 *
 * Multi-tenant root table.
 * Every domain table references organizations(id).
 *
 * Columns:
 * - id: UUID primary key (gen_random_uuid)
 * - name: Organization display name
 * - slug: URL-friendly unique identifier with collision suffixing
 * - currency_code: CHAR(3) default 'INR'
 * - fiscal_year_start_month: SMALLINT default 4 (April)
 * - status: 'active' | 'archived'
 * - created_by / updated_by: audit UUID references to users(id)
 * - created_at / updated_at: TIMESTAMPTZ
 */

const UP = `
  CREATE TABLE IF NOT EXISTS organizations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(150) NOT NULL,
    slug                    VARCHAR(150) UNIQUE NOT NULL,
    currency_code           CHAR(3) NOT NULL DEFAULT 'INR',
    fiscal_year_start_month SMALLINT NOT NULL DEFAULT 4,
    status                  VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
`;

const DOWN = `
  DROP TABLE IF EXISTS organizations CASCADE;
`;

module.exports = { name: '006_create_organizations', up: UP, down: DOWN };
