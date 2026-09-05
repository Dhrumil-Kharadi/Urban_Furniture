/**
 * Migration: Create payments table
 *
 * project.md §5.1.5, §5.2.5, §5.3 · technicalrequirement.md §4.1, §6.11, §6.12
 *
 * Records customer inbound payments and vendor outbound payments, including
 * card payments originating from the contact portal via payment gateway.
 */

const UP = `
  CREATE TABLE IF NOT EXISTS payments (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    payment_number       VARCHAR(50) NOT NULL,
    payment_type         VARCHAR(20) NOT NULL CHECK (payment_type IN ('inbound', 'outbound')),
    contact_id           UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    payment_method       VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'bank', 'card')),
    journal_id           UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
    payment_date         DATE NOT NULL,
    amount               NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    status               VARCHAR(20) NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'cancelled')),
    journal_entry_id     UUID UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
    gateway_provider     VARCHAR(50) NULL,
    gateway_payment_id   VARCHAR(100) NULL,
    gateway_order_id     VARCHAR(100) NULL,
    gateway_signature    VARCHAR(255) NULL,
    gateway_status       VARCHAR(50) NULL,
    notes                TEXT NULL,
    created_by           UUID REFERENCES users(id),
    updated_by           UUID REFERENCES users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payments_org_number UNIQUE (organization_id, payment_number)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_org_gateway_payment
    ON payments (organization_id, gateway_payment_id)
    WHERE gateway_payment_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_payments_organization_id
    ON payments(organization_id);

  CREATE INDEX IF NOT EXISTS idx_payments_org_contact
    ON payments(organization_id, contact_id);

  CREATE INDEX IF NOT EXISTS idx_payments_org_date
    ON payments(organization_id, payment_date);

  CREATE INDEX IF NOT EXISTS idx_payments_org_status
    ON payments(organization_id, status);
`;

const DOWN = `
  DROP TABLE IF EXISTS payments CASCADE;
`;

module.exports = { name: '023_create_payments', up: UP, down: DOWN };
