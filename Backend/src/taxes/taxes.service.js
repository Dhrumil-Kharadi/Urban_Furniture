const { withTransaction } = require('../shared/withTransaction');
const auditService = require('../shared/audit.service');
const { TAX_STATUS, ACCOUNT_TYPES, ACCOUNT_STATUS } = require('../shared/constants');
const { findBlockingReferences, TAX_REFERENCE_SOURCES } = require('../shared/references');
const accountsRepository = require('../accounts/accounts.repository');
const taxesRepository = require('./taxes.repository');

/**
 * Taxes Service
 *
 * project.md §7: tax posts to its OWN Chart of Accounts account and is never
 * folded into Sale Income. That is why `tax_account_id` matters, and why the
 * account it points at has to be the right kind:
 *
 *   - tax COLLECTED on a sale is money owed to the government → a LIABILITY
 *   - tax PAID on a purchase is a claim against the government → an ASSET
 *
 * Pointing a tax at an income or expense account instead does not fail loudly.
 * It silently misstates the Balance Sheet for as long as nobody notices, which
 * is exactly why it is refused here.
 */

/** Account types a tax may legitimately post to. */
const VALID_TAX_ACCOUNT_TYPES = Object.freeze([
  ACCOUNT_TYPES.LIABILITY,
  ACCOUNT_TYPES.ASSET,
]);

/** @private */
function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * A tax in another organization is reported as missing, never as forbidden.
 * @private
 */
async function loadOrFail(client, organizationId, taxId) {
  const tax = await taxesRepository.findByIdAndOrg(client, organizationId, taxId);
  if (!tax) fail('Tax not found', 404);
  return tax;
}

/**
 * Confirm the tax account exists in this tenant, is active, and is of a type
 * that can legitimately hold tax.
 * @private
 */
async function assertTaxAccountIsUsable(client, organizationId, accountId) {
  const account = await accountsRepository.findByIdAndOrg(client, organizationId, accountId);
  if (!account) fail('Tax account was not found', 400);

  if (account.status !== ACCOUNT_STATUS.ACTIVE) {
    fail('Tax account is archived', 400);
  }

  if (!VALID_TAX_ACCOUNT_TYPES.includes(account.account_type)) {
    fail(
      'Tax account must be a liability (tax collected) or an asset (tax paid)',
      400
    );
  }
}

const taxesService = {
  /**
   * @param {string} organizationId
   * @param {object} query
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async listTaxes(organizationId, query) {
    return taxesRepository.list(null, organizationId, query);
  },

  /**
   * @param {string} organizationId
   * @param {string} taxId
   * @returns {Promise<object>}
   */
  async getTax(organizationId, taxId) {
    return loadOrFail(null, organizationId, taxId);
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async createTax({ organizationId, actorUserId, data, ipAddress = null }) {
    const duplicate = await taxesRepository.findByName(null, organizationId, data.name);
    if (duplicate) fail('A tax with that name already exists', 409);

    if (data.tax_account_id) {
      await assertTaxAccountIsUsable(null, organizationId, data.tax_account_id);
    }

    return withTransaction(async (client) => {
      const tax = await taxesRepository.insert(client, {
        organization_id: organizationId,
        actor_user_id: actorUserId,
        ...data,
      });

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'tax',
        entityId: tax.id,
        after: tax,
        ipAddress,
      });

      return tax;
    });
  },

  /**
   * Update a tax.
   *
   * Changing a rate affects documents raised from now on and nothing already
   * posted — a posted line stores the rate it was taxed at, the same way it
   * stores the price it was sold at.
   *
   * @param {object} params
   * @returns {Promise<object>}
   */
  async updateTax({ organizationId, actorUserId, taxId, data, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, taxId);

    if (data.name) {
      const duplicate = await taxesRepository.findByName(null, organizationId, data.name, taxId);
      if (duplicate) fail('A tax with that name already exists', 409);
    }

    if (data.tax_account_id) {
      await assertTaxAccountIsUsable(null, organizationId, data.tax_account_id);
    }

    return withTransaction(async (client) => {
      const updated = await taxesRepository.update(
        client, organizationId, taxId, data, actorUserId
      );
      if (!updated) fail('Tax not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'tax',
        entityId: taxId,
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
  async archiveTax({ organizationId, actorUserId, taxId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, taxId);

    if (existing.status === TAX_STATUS.ARCHIVED) {
      fail('Tax is already archived', 409);
    }

    const blockers = await findBlockingReferences(
      null, TAX_REFERENCE_SOURCES, taxId, organizationId
    );
    if (blockers.length > 0) {
      const detail = blockers.map((b) => `${b.table} (${b.count})`).join(', ');
      fail(`Tax cannot be archived while it is referenced by: ${detail}`, 409);
    }

    return withTransaction(async (client) => {
      const archived = await taxesRepository.setStatus(
        client, organizationId, taxId, TAX_STATUS.ARCHIVED, actorUserId
      );
      if (!archived) fail('Tax not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'archive',
        entityType: 'tax',
        entityId: taxId,
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
  async unarchiveTax({ organizationId, actorUserId, taxId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, taxId);

    if (existing.status === TAX_STATUS.ACTIVE) {
      fail('Tax is already active', 409);
    }

    return withTransaction(async (client) => {
      const restored = await taxesRepository.setStatus(
        client, organizationId, taxId, TAX_STATUS.ACTIVE, actorUserId
      );
      if (!restored) fail('Tax not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'unarchive',
        entityType: 'tax',
        entityId: taxId,
        before: existing,
        after: restored,
        ipAddress,
      });

      return restored;
    });
  },
};

module.exports = taxesService;
