const { withTransaction } = require('../shared/withTransaction');
const auditService = require('../shared/audit.service');
const { ANALYTIC_STATUS } = require('../shared/constants');
const { findBlockingReferences, ANALYTIC_REFERENCE_SOURCES } = require('../shared/references');
const analyticsRepository = require('./analytics.repository');

/**
 * Analytic Accounts Service
 *
 * project.md §8 — the cost-centre dimension. A transaction line optionally
 * carries an analytic account, and the Budget Report compares a budget's
 * planned amount against the sum of journal lines carrying that tag.
 *
 * Archiving one that already has posted lines is refused: those lines are the
 * "actual" side of a budget comparison, and hiding the dimension they hang off
 * would make an existing Budget Report change its answer.
 */

/** @private */
function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * An analytic account in another organization is reported as missing, never as
 * forbidden — a 403 would confirm it exists.
 * @private
 */
async function loadOrFail(client, organizationId, analyticId) {
  const analytic = await analyticsRepository.findByIdAndOrg(client, organizationId, analyticId);
  if (!analytic) fail('Analytic account not found', 404);
  return analytic;
}

const analyticsService = {
  /**
   * @param {string} organizationId
   * @param {object} query
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async listAnalyticAccounts(organizationId, query) {
    return analyticsRepository.list(null, organizationId, query);
  },

  /**
   * @param {string} organizationId
   * @param {string} analyticId
   * @returns {Promise<object>}
   */
  async getAnalyticAccount(organizationId, analyticId) {
    return loadOrFail(null, organizationId, analyticId);
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async createAnalyticAccount({ organizationId, actorUserId, data, ipAddress = null }) {
    const duplicateName = await analyticsRepository.findByName(null, organizationId, data.name);
    if (duplicateName) fail('An analytic account with that name already exists', 409);

    if (data.code) {
      const duplicateCode = await analyticsRepository.findByCode(null, organizationId, data.code);
      if (duplicateCode) fail('An analytic account with that code already exists', 409);
    }

    return withTransaction(async (client) => {
      const analytic = await analyticsRepository.insert(client, {
        organization_id: organizationId,
        actor_user_id: actorUserId,
        ...data,
      });

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'analytic_account',
        entityId: analytic.id,
        after: analytic,
        ipAddress,
      });

      return analytic;
    });
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async updateAnalyticAccount({ organizationId, actorUserId, analyticId, data, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, analyticId);

    if (data.name) {
      const duplicate = await analyticsRepository.findByName(
        null, organizationId, data.name, analyticId
      );
      if (duplicate) fail('An analytic account with that name already exists', 409);
    }

    if (data.code) {
      const duplicate = await analyticsRepository.findByCode(
        null, organizationId, data.code, analyticId
      );
      if (duplicate) fail('An analytic account with that code already exists', 409);
    }

    // Flipping income to expense on a dimension that already carries posted
    // lines would reclassify every one of them at once.
    if (data.analytic_type && data.analytic_type !== existing.analytic_type) {
      const blockers = await findBlockingReferences(
        null, ANALYTIC_REFERENCE_SOURCES, analyticId, organizationId
      );
      if (blockers.length > 0) {
        fail('An analytic account already used by postings cannot change type', 409);
      }
    }

    return withTransaction(async (client) => {
      const updated = await analyticsRepository.update(
        client, organizationId, analyticId, data, actorUserId
      );
      if (!updated) fail('Analytic account not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'analytic_account',
        entityId: analyticId,
        before: existing,
        after: updated,
        ipAddress,
      });

      return updated;
    });
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async archiveAnalyticAccount({ organizationId, actorUserId, analyticId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, analyticId);

    if (existing.status === ANALYTIC_STATUS.ARCHIVED) {
      fail('Analytic account is already archived', 409);
    }

    const blockers = await findBlockingReferences(
      null, ANALYTIC_REFERENCE_SOURCES, analyticId, organizationId
    );
    if (blockers.length > 0) {
      const detail = blockers.map((b) => `${b.table} (${b.count})`).join(', ');
      fail(`Analytic account cannot be archived while it is referenced by: ${detail}`, 409);
    }

    return withTransaction(async (client) => {
      const archived = await analyticsRepository.setStatus(
        client, organizationId, analyticId, ANALYTIC_STATUS.ARCHIVED, actorUserId
      );
      if (!archived) fail('Analytic account not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'archive',
        entityType: 'analytic_account',
        entityId: analyticId,
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
  async unarchiveAnalyticAccount({ organizationId, actorUserId, analyticId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, analyticId);

    if (existing.status === ANALYTIC_STATUS.ACTIVE) {
      fail('Analytic account is already active', 409);
    }

    return withTransaction(async (client) => {
      const restored = await analyticsRepository.setStatus(
        client, organizationId, analyticId, ANALYTIC_STATUS.ACTIVE, actorUserId
      );
      if (!restored) fail('Analytic account not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'unarchive',
        entityType: 'analytic_account',
        entityId: analyticId,
        before: existing,
        after: restored,
        ipAddress,
      });

      return restored;
    });
  },
};

module.exports = analyticsService;
