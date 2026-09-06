/**
 * Migration Runner
 *
 * Executes database migrations in order.
 * Tracks applied migrations in a `migrations` table.
 * Idempotent — safe to run multiple times.
 *
 * Usage: node src/database/migrations/run-migrations.js
 *        npm run migrate
 */

const path = require('path');
const { env, validateEnv } = require('../../config/env');
const logger = require('../../utils/logger');

// We create a standalone Pool here instead of importing from db.js
// because db.js imports logger which is fine, but we want this script
// to be runnable independently without starting the full app.
const { Pool } = require('pg');

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
});

// Import migrations in order
const migrations = [
  require('./001_create_users_table'),
  require('./002_create_otp_verifications_table'),
  require('./003_drop_duplicate_email_index'),
  require('./004_add_token_version_to_users'),
  require('./005_create_refresh_tokens_table'),
  require('./006_create_organizations'),
  require('./007_add_organization_to_users'),
  require('./008_create_accounts'),
  require('./009_create_contacts'),
  require('./010_create_product_categories'),
  require('./011_create_taxes'),
  require('./012_create_products'),
  require('./013_create_journals'),
  require('./014_create_analytic_accounts'),
  require('./015_create_budgets'),
  require('./016_create_journal_entries'),
  require('./017_create_journal_entry_lines'),
  require('./018_create_document_sequences'),
  require('./019_create_purchase_orders'),
  require('./020_create_vendor_bills'),
  require('./021_create_sales_orders'),
  require('./022_create_customer_invoices'),
  require('./023_create_payments'),
  require('./024_create_payment_allocations'),
  require('./025_create_attachments'),
  require('./026_create_audit_logs'),
  require('./027_create_notifications'),
  require('./028_ledger_integrity_triggers'),
  require('./029_rename_roles'),
  require('./030_add_product_description'),
  require('./031_add_product_available_qty'),
];

/**
 * Create the migrations tracking table if it doesn't exist.
 */
async function createMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Get list of already-applied migration names.
 */
async function getAppliedMigrations(client) {
  const result = await client.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(row => row.name);
}

/**
 * Run all pending migrations inside a transaction.
 */
async function runMigrations() {
  validateEnv();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Ensure migrations table exists
    await createMigrationsTable(client);

    // Get already-applied migrations
    const applied = await getAppliedMigrations(client);
    logger.info('Applied migrations', { count: applied.length, names: applied });

    // Run pending migrations
    let newCount = 0;
    for (const migration of migrations) {
      if (applied.includes(migration.name)) {
        logger.debug(`Skipping already-applied migration: ${migration.name}`);
        continue;
      }

      logger.info(`Running migration: ${migration.name}`);
      await client.query(migration.up);
      await client.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        [migration.name]
      );
      newCount++;
      logger.info(`Applied migration: ${migration.name}`);
    }

    await client.query('COMMIT');

    if (newCount === 0) {
      logger.info('No new migrations to apply — database is up to date');
    } else {
      logger.info(`Successfully applied ${newCount} migration(s)`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Migration failed — rolled back', { error: err.message });
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if executed directly
runMigrations()
  .then(() => {
    logger.info('Migration runner finished');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Migration runner failed', { error: err.message });
    process.exit(1);
  });
