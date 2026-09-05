const { pool } = require('../config/db');

/**
 * Organizations Repository
 *
 * Direct parameterized PostgreSQL queries for the organizations table.
 * Adheres to the multi-tenancy and layer contracts:
 * - All queries parameterized ($1, $2, etc.)
 * - Functions accepting client as first parameter fall back to pool
 * - No HTTP logic, no business rules
 */

const organizationsRepository = {
  /**
   * Find organization by ID.
   *
   * @param {object|null} client - pg transaction client or null
   * @param {string} id - Organization UUID
   * @returns {Promise<object|null>}
   */
  async findById(client, id) {
    const db = client || pool;
    const query = `
      SELECT id, name, slug, currency_code, fiscal_year_start_month, status,
             created_by, updated_by, created_at, updated_at
        FROM organizations
       WHERE id = $1
       LIMIT 1;
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  },

  /**
   * Find organization by unique slug.
   *
   * @param {object|null} client
   * @param {string} slug
   * @returns {Promise<object|null>}
   */
  async findBySlug(client, slug) {
    const db = client || pool;
    const query = `
      SELECT id, name, slug, currency_code, fiscal_year_start_month, status,
             created_by, updated_by, created_at, updated_at
        FROM organizations
       WHERE slug = $1
       LIMIT 1;
    `;
    const result = await db.query(query, [slug]);
    return result.rows[0] || null;
  },

  /**
   * Find all existing slugs matching a base pattern.
   * Used for collision detection and deterministic suffixing.
   *
   * @param {object|null} client
   * @param {string} baseSlug
   * @returns {Promise<string[]>}
   */
  async findSlugsStartingWith(client, baseSlug) {
    const db = client || pool;
    const query = `
      SELECT slug
        FROM organizations
       WHERE slug = $1 OR slug LIKE $2;
    `;
    const result = await db.query(query, [baseSlug, `${baseSlug}-%`]);
    return result.rows.map(r => r.slug);
  },

  /**
   * Create a new organization.
   *
   * @param {object|null} client
   * @param {object} params
   * @returns {Promise<object>}
   */
  async create(client, { name, slug, currency_code = 'INR', fiscal_year_start_month = 4, created_by = null }) {
    const db = client || pool;
    const query = `
      INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $5)
      RETURNING id, name, slug, currency_code, fiscal_year_start_month, status,
                created_by, updated_by, created_at, updated_at;
    `;
    const values = [name, slug, currency_code, fiscal_year_start_month, created_by];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  /**
   * Update organization fields by ID.
   *
   * @param {object|null} client
   * @param {string} id - Organization UUID
   * @param {object} fields - Key-value pairs to update
   * @returns {Promise<object|null>}
   */
  async update(client, id, fields) {
    const db = client || pool;
    const allowedColumns = ['name', 'currency_code', 'fiscal_year_start_month', 'status', 'updated_by'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (allowedColumns.includes(key) && value !== undefined) {
        setClauses.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      return this.findById(client, id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE organizations
         SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
      RETURNING id, name, slug, currency_code, fiscal_year_start_month, status,
                created_by, updated_by, created_at, updated_at;
    `;

    const result = await db.query(query, values);
    return result.rows[0] || null;
  },
};

module.exports = organizationsRepository;
