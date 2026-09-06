/**
 * Database Reset and Seed Script
 *
 * 1. Drops and recreates the public schema (wiping all tables, types, triggers, and data).
 * 2. Runs all database migrations in order.
 * 3. Seeds comprehensive data for Urban Furniture.
 *
 * Usage:
 *   node src/database/reset-db.js
 *   npm run db:reset
 */

const { Pool } = require('pg');
const { env, validateEnv } = require('../config/env');
const logger = require('../utils/logger');
const { runMigrations } = require('./migrations/run-migrations');
const { seedUrbanFurniture } = require('./seeds/seed_urban_furniture');

async function resetAndSeedDatabase() {
  validateEnv();

  console.log('================================================================');
  console.log('🧹 [Step 1/3] Dropping all tables, types, and schema in PostgreSQL...');
  console.log('================================================================');

  const pool = new Pool({
    host: env.db.host,
    port: env.db.port,
    database: env.db.name,
    user: env.db.user,
    password: env.db.password,
  });

  const client = await pool.connect();

  try {
    // Terminate other active connections to this database if necessary (except current connection)
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND leader_pid IS NULL;
    `);

    // Drop and recreate schema public
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('✔ All tables and data deleted. Clean "public" schema recreated.');
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log('🚀 [Step 2/3] Running migrations...');
  console.log('================================================================');
  await runMigrations();
  console.log('✔ Migrations completed successfully.');

  console.log('\n================================================================');
  console.log('🌱 [Step 3/3] Seeding database...');
  console.log('================================================================');
  await seedUrbanFurniture();
  console.log('✔ Seeding completed successfully.');

  console.log('\n================================================================');
  console.log('✨ DATABASE RESET, MIGRATION & SEEDING FINISHED SUCCESSFULLY!');
  console.log('================================================================');
}

if (require.main === module) {
  resetAndSeedDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Reset and seed failed:', err);
      process.exit(1);
    });
}

module.exports = { resetAndSeedDatabase };
