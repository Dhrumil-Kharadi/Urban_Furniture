const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, searchTerm, listResult } = require('../shared/listQuery');

/**
 * Products Repository
 *
 * Parameterised SQL only.
 *
 * MONEY: sales_price and cost_price are NUMERIC(15,2) and node-postgres hands
 * them back as STRINGS. That is correct and deliberate — they are passed
 * through untouched. Do not install a global type parser to "fix" it; that
 * converts every amount in the system to a float.
 */

const ALLOWED_SORT_COLUMNS = [
  'created_at', 'updated_at', 'name', 'sku', 'product_type', 'sales_price', 'cost_price', 'status',
];

const SELECT_COLUMNS = `
  p.id, p.organization_id, p.name, p.sku, p.product_type, p.category_id,
  p.sales_price, p.cost_price, p.sales_tax_id, p.purchase_tax_id,
  p.income_account_id, p.expense_account_id, p.status,
  p.created_by, p.updated_by, p.created_at, p.updated_at
`;

const productsRepository = {
  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query] - page, limit, search, status, type, categoryId, sortBy, sortOrder
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async list(client, organizationId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['p.organization_id = $1'];
    const params = [organizationId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`p.status = $${params.length}`);
    }

    if (query.type) {
      params.push(query.type);
      conditions.push(`p.product_type = $${params.length}`);
    }

    if (query.categoryId) {
      params.push(query.categoryId);
      conditions.push(`p.category_id = $${params.length}`);
    }

    const search = searchTerm(query);
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM products p ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    // The sort column is resolved from an allow-list, then qualified with the
    // table alias so it cannot be ambiguous against the joined category.
    const orderBy = buildSort(query, ALLOWED_SORT_COLUMNS, 'created_at').replace(/^"/, 'p."');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT ${SELECT_COLUMNS}, c.name AS category_name
         FROM products p
         LEFT JOIN product_categories c
                ON c.id = p.category_id
               AND c.organization_id = p.organization_id
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return listResult(dataRes.rows, page, limit, total);
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} productId
   * @returns {Promise<object|null>}
   */
  async findByIdAndOrg(client, organizationId, productId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT ${SELECT_COLUMNS}, c.name AS category_name
         FROM products p
         LEFT JOIN product_categories c
                ON c.id = p.category_id
               AND c.organization_id = p.organization_id
        WHERE p.id = $1 AND p.organization_id = $2`,
      [productId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Find a product in this organization with the same SKU.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} sku
   * @param {string|null} [excludeId]
   * @returns {Promise<object|null>}
   */
  async findBySku(client, organizationId, sku, excludeId = null) {
    const db = client || pool;
    const params = [organizationId, sku];
    let sql = `SELECT id, name, sku FROM products
                WHERE organization_id = $1 AND sku = $2`;

    if (excludeId) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }

    const res = await db.query(`${sql} LIMIT 1`, params);
    return res.rows[0] || null;
  },

  /**
   * Confirm that a referenced row exists, is active and belongs to the same
   * organization. A cross-tenant reference must be impossible to save, not
   * merely unlikely.
   *
   * @param {object|null} client
   * @param {'product_categories'|'taxes'|'accounts'} table - Fixed by the
   *   caller from a literal, never from a request.
   * @param {string} organizationId
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async referenceIsUsable(client, table, organizationId, id) {
    const db = client || pool;

    const exists = await db.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    if (!exists.rows[0]?.reg) return false;

    const res = await db.query(
      `SELECT 1
         FROM ${table}
        WHERE id = $1 AND organization_id = $2 AND status = 'active'
        LIMIT 1`,
      [id, organizationId]
    );
    return res.rowCount > 0;
  },

  /**
   * @param {object|null} client
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async insert(client, payload) {
    const db = client || pool;
    const res = await db.query(
      `INSERT INTO products (
         organization_id, name, sku, product_type, category_id,
         sales_price, cost_price, sales_tax_id, purchase_tax_id,
         income_account_id, expense_account_id, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING id`,
      [
        payload.organization_id,
        payload.name,
        payload.sku,
        payload.product_type,
        payload.category_id,
        payload.sales_price,
        payload.cost_price,
        payload.sales_tax_id,
        payload.purchase_tax_id,
        payload.income_account_id,
        payload.expense_account_id,
        payload.actor_user_id,
      ]
    );

    return productsRepository.findByIdAndOrg(db, payload.organization_id, res.rows[0].id);
  },

  /**
   * Update a product's editable fields.
   *
   * The SET list is built from a fixed whitelist of column names, so no
   * request value ever reaches the SQL text.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} productId
   * @param {object} fields
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async update(client, organizationId, productId, fields, actorUserId) {
    const db = client || pool;
    const editable = [
      'name', 'sku', 'product_type', 'category_id',
      'sales_price', 'cost_price', 'sales_tax_id', 'purchase_tax_id',
      'income_account_id', 'expense_account_id',
    ];

    const assignments = [];
    const params = [];

    for (const column of editable) {
      if (fields[column] !== undefined) {
        params.push(fields[column]);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    if (assignments.length === 0) {
      return productsRepository.findByIdAndOrg(db, organizationId, productId);
    }

    params.push(actorUserId);
    assignments.push(`updated_by = $${params.length}`);
    assignments.push('updated_at = NOW()');

    params.push(productId);
    const idIdx = params.length;
    params.push(organizationId);
    const orgIdx = params.length;

    const res = await db.query(
      `UPDATE products
          SET ${assignments.join(', ')}
        WHERE id = $${idIdx} AND organization_id = $${orgIdx}
        RETURNING id`,
      params
    );

    if (res.rowCount === 0) return null;
    return productsRepository.findByIdAndOrg(db, organizationId, productId);
  },

  /**
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} productId
   * @param {string} status
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async setStatus(client, organizationId, productId, status, actorUserId) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE products
          SET status = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING id`,
      [status, actorUserId, productId, organizationId]
    );

    if (res.rowCount === 0) return null;
    return productsRepository.findByIdAndOrg(db, organizationId, productId);
  },
};

module.exports = productsRepository;
