const { pool } = require('../config/db');

/**
 * Executes a callback within a managed PostgreSQL transaction.
 *
 * Rules:
 * - Acquires a dedicated client from pool.connect()
 * - Issues BEGIN
 * - Passes client to fn(client)
 * - On success: issues COMMIT and returns result
 * - On throw: issues ROLLBACK and re-throws the error
 * - Always releases client back to the pool in a finally block
 *
 * Re-entrant support: If an active transaction client is passed as the first argument,
 * executes within that existing transaction rather than acquiring another connection.
 *
 * @param {Function|object} fnOrClient - Callback fn(client) or active pg client
 * @param {Function} [maybeFn] - Callback fn(client) when first argument is a client
 * @returns {Promise<any>}
 */
async function withTransaction(fnOrClient, maybeFn) {
  // Check if called as withTransaction(existingClient, fn)
  if (fnOrClient && typeof fnOrClient.query === 'function' && typeof maybeFn === 'function') {
    return maybeFn(fnOrClient);
  }

  const fn = typeof fnOrClient === 'function' ? fnOrClient : maybeFn;
  if (typeof fn !== 'function') {
    throw new Error('withTransaction requires a callback function');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Ignore rollback failure if connection was severed
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
