const { withTransaction } = require('../shared/withTransaction');
const auditService = require('../shared/audit.service');
const { ACCOUNT_STATUS } = require('../shared/constants');
const {
  findBlockingReferences,
  ACCOUNT_REFERENCE_SOURCES,
} = require('../shared/references');
const accountsRepository = require('./accounts.repository');

/**
 * Accounts Service (Chart of Accounts)
 *
 * The CoA is the spine of every financial report, so three rules here are not
 * conveniences:
 *
 *   1. A parent must share its child's account_type. A Balance Sheet that
 *      rolls an expense up under an asset is not a rounding problem, it is a
 *      wrong report.
 *
 *   2. The ancestor chain is walked before saving a parent. A cycle would hang
 *      the tree renderer and make any recursive balance query non-terminating.
 *
 *   3. System accounts (is_system) cannot be archived or retyped. The ledger
 *      engine posts to them by name — Debtors, Creditors, Output Tax Payable —
 *      and losing one breaks posting for the whole organization.
 */

/** @private */
function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * An account in another organization is reported as missing, never as
 * forbidden — a 403 would confirm it exists.
 * @private
 */
async function loadOrFail(client, organizationId, accountId) {
  const account = await accountsRepository.findByIdAndOrg(client, organizationId, accountId);
  if (!account) fail('Account not found', 404);
  return account;
}

/**
 * Validate a proposed parent: it must exist in this tenant, be active, share
 * the child's type, and not already sit below the child.
 *
 * @param {object|null} client
 * @param {string} organizationId
 * @param {string} parentId
 * @param {string} accountType - The child's type, after any change.
 * @param {string|null} childId - null when creating.
 * @private
 */
async function assertParentIsUsable(client, organizationId, parentId, accountType, childId) {
  if (childId && parentId === childId) {
    fail('An account cannot be its own parent', 400);
  }

  const parent = await accountsRepository.findByIdAndOrg(client, organizationId, parentId);
  if (!parent) fail('Parent account was not found', 400);

  if (parent.status !== ACCOUNT_STATUS.ACTIVE) {
    fail('Parent account is archived', 400);
  }

  if (parent.account_type !== accountType) {
    fail(`Parent account must be of type '${accountType}'`, 400);
  }

  // Walking up from the proposed parent: if the child appears anywhere in that
  // chain, attaching here would close a loop.
  if (childId) {
    const ancestors = await accountsRepository.findAncestorIds(client, organizationId, parentId);
    if (ancestors.includes(childId)) {
      fail('That parent would create a cycle in the account hierarchy', 400);
    }
  }
}

/**
 * Assemble a flat account list into a tree.
 *
 * Two passes over the rows, no recursion into the database. An account whose
 * parent is missing from the set (archived and filtered out, say) is surfaced
 * at the root rather than silently dropped.
 *
 * @param {Array} rows
 * @returns {Array} Root nodes, each with a `children` array.
 * @private
 */
function buildTree(rows) {
  const byId = new Map();
  for (const row of rows) {
    byId.set(row.id, { ...row, children: [] });
  }

  const roots = [];
  for (const node of byId.values()) {
    const parent = node.parent_account_id ? byId.get(node.parent_account_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

const accountsService = {
  /**
   * @param {string} organizationId
   * @param {object} query
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async listAccounts(organizationId, query) {
    return accountsRepository.list(null, organizationId, query);
  },

  /**
   * The full hierarchy, from a single query.
   *
   * @param {string} organizationId
   * @param {object} [query] - { status }
   * @returns {Promise<{ tree: Array, count: number }>}
   */
  async getAccountTree(organizationId, query = {}) {
    const rows = await accountsRepository.listAll(null, organizationId, query);
    return { tree: buildTree(rows), count: rows.length };
  },

  /**
   * @param {string} organizationId
   * @param {string} accountId
   * @returns {Promise<object>}
   */
  async getAccount(organizationId, accountId) {
    return loadOrFail(null, organizationId, accountId);
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async createAccount({ organizationId, actorUserId, data, ipAddress = null }) {
    const duplicate = await accountsRepository.findByCode(null, organizationId, data.code);
    if (duplicate) fail('An account with that code already exists', 409);

    if (data.parent_account_id) {
      await assertParentIsUsable(
        null, organizationId, data.parent_account_id, data.account_type, null
      );
    }

    return withTransaction(async (client) => {
      const account = await accountsRepository.insert(client, {
        organization_id: organizationId,
        actor_user_id: actorUserId,
        ...data,
      });

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'account',
        entityId: account.id,
        after: account,
        ipAddress,
      });

      return account;
    });
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async updateAccount({ organizationId, actorUserId, accountId, data, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, accountId);

    // A system account may be renamed, but never retyped: the posting rules
    // reach for it by role, and changing its type silently rewires the
    // Balance Sheet.
    if (existing.is_system && data.account_type && data.account_type !== existing.account_type) {
      fail('A system account\'s type cannot be changed', 409);
    }

    if (existing.is_system && data.code && data.code !== existing.code) {
      fail('A system account\'s code cannot be changed', 409);
    }

    if (data.code) {
      const duplicate = await accountsRepository.findByCode(
        null, organizationId, data.code, accountId
      );
      if (duplicate) fail('An account with that code already exists', 409);
    }

    const nextType = data.account_type || existing.account_type;

    // Retyping an account with children would leave the children mismatched,
    // so the whole subtree has to move together or not at all.
    if (data.account_type && data.account_type !== existing.account_type) {
      const children = await accountsRepository.countChildren(null, organizationId, accountId);
      if (children > 0) {
        fail('Change the type of this account\'s children first', 409);
      }
    }

    if (data.parent_account_id) {
      await assertParentIsUsable(
        null, organizationId, data.parent_account_id, nextType, accountId
      );
    }

    return withTransaction(async (client) => {
      const updated = await accountsRepository.update(
        client, organizationId, accountId, data, actorUserId
      );
      if (!updated) fail('Account not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'account',
        entityId: accountId,
        before: existing,
        after: updated,
        ipAddress,
      });

      return updated;
    });
  },

  /**
   * Archive an account.
   *
   * Refused for a system account, and refused with a 409 naming the blocker
   * when anything still points at it — project.md §9.6 forbids posting to an
   * archived account, so archiving one that a journal or a posted line depends
   * on would break that document rather than tidy the list.
   *
   * @param {object} params
   * @returns {Promise<object>}
   */
  async archiveAccount({ organizationId, actorUserId, accountId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, accountId);

    if (existing.is_system) {
      fail('A system account cannot be archived', 409);
    }

    if (existing.status === ACCOUNT_STATUS.ARCHIVED) {
      fail('Account is already archived', 409);
    }

    const blockers = await findBlockingReferences(
      null, ACCOUNT_REFERENCE_SOURCES, accountId, organizationId
    );
    if (blockers.length > 0) {
      const detail = blockers.map((b) => `${b.table} (${b.count})`).join(', ');
      fail(`Account cannot be archived while it is referenced by: ${detail}`, 409);
    }

    return withTransaction(async (client) => {
      const archived = await accountsRepository.setStatus(
        client, organizationId, accountId, ACCOUNT_STATUS.ARCHIVED, actorUserId
      );
      if (!archived) fail('Account not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'archive',
        entityType: 'account',
        entityId: accountId,
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
  async unarchiveAccount({ organizationId, actorUserId, accountId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, accountId);

    if (existing.status === ACCOUNT_STATUS.ACTIVE) {
      fail('Account is already active', 409);
    }

    // Restoring a child under a still-archived parent would produce a node the
    // tree cannot place.
    if (existing.parent_account_id) {
      const parent = await accountsRepository.findByIdAndOrg(
        null, organizationId, existing.parent_account_id
      );
      if (parent && parent.status !== ACCOUNT_STATUS.ACTIVE) {
        fail('Restore the parent account first', 409);
      }
    }

    return withTransaction(async (client) => {
      const restored = await accountsRepository.setStatus(
        client, organizationId, accountId, ACCOUNT_STATUS.ACTIVE, actorUserId
      );
      if (!restored) fail('Account not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'unarchive',
        entityType: 'account',
        entityId: accountId,
        before: existing,
        after: restored,
        ipAddress,
      });

      return restored;
    });
  },
};

module.exports = accountsService;
module.exports.buildTree = buildTree;
