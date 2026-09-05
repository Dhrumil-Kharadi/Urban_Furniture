const { withTransaction } = require('../shared/withTransaction');
const auditService = require('../shared/audit.service');
const { PRODUCT_STATUS } = require('../shared/constants');
const {
  findBlockingReferences,
  PRODUCT_REFERENCE_SOURCES,
} = require('../shared/references');
const productsRepository = require('./products.repository');

/**
 * Products Service
 *
 * ACCOUNTING INVARIANT — nothing in this file rewrites history.
 *
 * Changing a price or archiving a product updates the master record and only
 * the master record. Document lines (Phases 8/9) copy the price, name and tax
 * rate at the moment of sale and never join back here for money, so last
 * year's invoice still reprints at last year's price. If a future change makes
 * a document line read its amount from this table, that is a correctness bug,
 * not an optimisation.
 */

/** Foreign keys that must resolve inside the same organization. */
const REFERENCE_CHECKS = Object.freeze([
  { field: 'category_id', table: 'product_categories', label: 'Category' },
  { field: 'sales_tax_id', table: 'taxes', label: 'Sales tax' },
  { field: 'purchase_tax_id', table: 'taxes', label: 'Purchase tax' },
  { field: 'income_account_id', table: 'accounts', label: 'Income account' },
  { field: 'expense_account_id', table: 'accounts', label: 'Expense account' },
]);

/** @private */
function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * A product in another organization is reported as missing, never as
 * forbidden — a 403 would confirm it exists.
 * @private
 */
async function loadOrFail(client, organizationId, productId) {
  const product = await productsRepository.findByIdAndOrg(client, organizationId, productId);
  if (!product) fail('Product not found', 404);
  return product;
}

/**
 * Verify every supplied reference resolves to an active row in this tenant.
 *
 * The database foreign keys guarantee the row exists somewhere; they do not
 * guarantee it belongs to this organization, which is the check that matters.
 * @private
 */
async function assertReferences(client, organizationId, data) {
  for (const { field, table, label } of REFERENCE_CHECKS) {
    const value = data[field];
    if (!value) continue;

    const usable = await productsRepository.referenceIsUsable(client, table, organizationId, value);
    if (!usable) fail(`${label} was not found or is not active`, 400);
  }
}

const productsService = {
  /**
   * @param {string} organizationId
   * @param {object} query
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async listProducts(organizationId, query) {
    return productsRepository.list(null, organizationId, query);
  },

  /**
   * @param {string} organizationId
   * @param {string} productId
   * @returns {Promise<object>}
   */
  async getProduct(organizationId, productId) {
    return loadOrFail(null, organizationId, productId);
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async createProduct({ organizationId, actorUserId, data, ipAddress = null }) {
    if (data.sku) {
      const duplicate = await productsRepository.findBySku(null, organizationId, data.sku);
      if (duplicate) fail('A product with that SKU already exists', 409);
    }

    await assertReferences(null, organizationId, data);

    return withTransaction(async (client) => {
      const product = await productsRepository.insert(client, {
        organization_id: organizationId,
        actor_user_id: actorUserId,
        ...data,
      });

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'product',
        entityId: product.id,
        after: product,
        ipAddress,
      });

      return product;
    });
  },

  /**
   * Update a product, prices included.
   *
   * The route restricts this to admin — project.md §3 states that only the
   * business owner may change a price. The audit row records the before and
   * after, so a price change is always answerable.
   *
   * @param {object} params
   * @returns {Promise<object>}
   */
  async updateProduct({ organizationId, actorUserId, productId, data, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, productId);

    if (data.sku) {
      const duplicate = await productsRepository.findBySku(
        null, organizationId, data.sku, productId
      );
      if (duplicate) fail('A product with that SKU already exists', 409);
    }

    await assertReferences(null, organizationId, data);

    return withTransaction(async (client) => {
      const updated = await productsRepository.update(
        client, organizationId, productId, data, actorUserId
      );
      if (!updated) fail('Product not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'product',
        entityId: productId,
        before: existing,
        after: updated,
        ipAddress,
      });

      return updated;
    });
  },

  /**
   * Archive a product.
   *
   * Blocked with a 409 naming the blocker when documents already reference it,
   * per project.md §9.6 — a product with transactions is archived, never
   * deleted. Archiving does not touch a single historical line.
   *
   * @param {object} params
   * @returns {Promise<object>}
   */
  async archiveProduct({ organizationId, actorUserId, productId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, productId);

    if (existing.status === PRODUCT_STATUS.ARCHIVED) {
      fail('Product is already archived', 409);
    }

    const blockers = await findBlockingReferences(
      null, PRODUCT_REFERENCE_SOURCES, productId, organizationId
    );
    if (blockers.length > 0) {
      const detail = blockers.map((b) => `${b.table} (${b.count})`).join(', ');
      fail(`Product cannot be archived while it is referenced by: ${detail}`, 409);
    }

    return withTransaction(async (client) => {
      const archived = await productsRepository.setStatus(
        client, organizationId, productId, PRODUCT_STATUS.ARCHIVED, actorUserId
      );
      if (!archived) fail('Product not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'archive',
        entityType: 'product',
        entityId: productId,
        before: existing,
        after: archived,
        ipAddress,
      });

      return archived;
    });
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async unarchiveProduct({ organizationId, actorUserId, productId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, productId);

    if (existing.status === PRODUCT_STATUS.ACTIVE) {
      fail('Product is already active', 409);
    }

    return withTransaction(async (client) => {
      const restored = await productsRepository.setStatus(
        client, organizationId, productId, PRODUCT_STATUS.ACTIVE, actorUserId
      );
      if (!restored) fail('Product not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'unarchive',
        entityType: 'product',
        entityId: productId,
        before: existing,
        after: restored,
        ipAddress,
      });

      return restored;
    });
  },
};

module.exports = productsService;
