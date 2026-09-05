const { withTransaction } = require('../shared/withTransaction');
const auditService = require('../shared/audit.service');
const { PRODUCT_CATEGORY_STATUS } = require('../shared/constants');
const {
  findBlockingReferences,
  PRODUCT_CATEGORY_REFERENCE_SOURCES,
} = require('../shared/references');
const productCategoriesRepository = require('./product-categories.repository');

/**
 * Product Categories Service
 *
 * Business logic only. organizationId always arrives from the caller, which
 * took it from req.user.
 */

/** @private */
function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * A category in another organization is reported as missing, never as
 * forbidden — a 403 would confirm it exists.
 * @private
 */
async function loadOrFail(client, organizationId, categoryId) {
  const category = await productCategoriesRepository.findByIdAndOrg(client, organizationId, categoryId);
  if (!category) fail('Product category not found', 404);
  return category;
}

const productCategoriesService = {
  /**
   * @param {string} organizationId
   * @param {object} query
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async listCategories(organizationId, query) {
    return productCategoriesRepository.list(null, organizationId, query);
  },

  /**
   * @param {string} organizationId
   * @param {string} categoryId
   * @returns {Promise<object>}
   */
  async getCategory(organizationId, categoryId) {
    return loadOrFail(null, organizationId, categoryId);
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async createCategory({ organizationId, actorUserId, data, ipAddress = null }) {
    const duplicate = await productCategoriesRepository.findByName(null, organizationId, data.name);
    if (duplicate) fail('A category with that name already exists', 409);

    return withTransaction(async (client) => {
      const category = await productCategoriesRepository.insert(client, {
        organization_id: organizationId,
        name: data.name,
        description: data.description,
        actor_user_id: actorUserId,
      });

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'product_category',
        entityId: category.id,
        after: category,
        ipAddress,
      });

      return category;
    });
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async updateCategory({ organizationId, actorUserId, categoryId, data, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, categoryId);

    if (data.name !== undefined) {
      const duplicate = await productCategoriesRepository.findByName(
        null, organizationId, data.name, categoryId
      );
      if (duplicate) fail('A category with that name already exists', 409);
    }

    return withTransaction(async (client) => {
      const updated = await productCategoriesRepository.update(
        client, organizationId, categoryId, data, actorUserId
      );
      if (!updated) fail('Product category not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'product_category',
        entityId: categoryId,
        before: existing,
        after: updated,
        ipAddress,
      });

      return updated;
    });
  },

  /**
   * Archive a category. Blocked while products still point at it — silently
   * archiving it would leave those products classified under something the
   * operator can no longer see.
   *
   * @param {object} params
   * @returns {Promise<object>}
   */
  async archiveCategory({ organizationId, actorUserId, categoryId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, categoryId);

    if (existing.status === PRODUCT_CATEGORY_STATUS.ARCHIVED) {
      fail('Product category is already archived', 409);
    }

    const blockers = await findBlockingReferences(
      null, PRODUCT_CATEGORY_REFERENCE_SOURCES, categoryId, organizationId
    );
    if (blockers.length > 0) {
      const detail = blockers.map((b) => `${b.table} (${b.count})`).join(', ');
      fail(`Category cannot be archived while it is referenced by: ${detail}`, 409);
    }

    return withTransaction(async (client) => {
      const archived = await productCategoriesRepository.setStatus(
        client, organizationId, categoryId, PRODUCT_CATEGORY_STATUS.ARCHIVED, actorUserId
      );
      if (!archived) fail('Product category not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'archive',
        entityType: 'product_category',
        entityId: categoryId,
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
  async unarchiveCategory({ organizationId, actorUserId, categoryId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, categoryId);

    if (existing.status === PRODUCT_CATEGORY_STATUS.ACTIVE) {
      fail('Product category is already active', 409);
    }

    return withTransaction(async (client) => {
      const restored = await productCategoriesRepository.setStatus(
        client, organizationId, categoryId, PRODUCT_CATEGORY_STATUS.ACTIVE, actorUserId
      );
      if (!restored) fail('Product category not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'unarchive',
        entityType: 'product_category',
        entityId: categoryId,
        before: existing,
        after: restored,
        ipAddress,
      });

      return restored;
    });
  },
};

module.exports = productCategoriesService;
