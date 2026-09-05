'use strict';

const accountsRepository = require('./accounts.repository');
const AppError = require('../shared/AppError');
const { parse } = require('../shared/pagination');
const { recordAudit } = require('../shared/audit.service');
const { AUDIT_ACTIONS } = require('../shared/constants');

/**
 * Walk ancestor chain to ensure no circular reference when parenting accounts.
 */
async function assertNoAncestorCycle(client, orgId, accountId, targetParentId) {
  if (!targetParentId) return;
  if (accountId && targetParentId === accountId) {
    throw new AppError('An account cannot be its own parent', 400, 'CIRCULAR_PARENT_REFERENCE');
  }

  let currentParentId = targetParentId;
  const visited = new Set();
  if (accountId) visited.add(accountId);

  while (currentParentId) {
    if (visited.has(currentParentId)) {
      throw new AppError('Parent account creates a circular reference in the account hierarchy', 400, 'CIRCULAR_PARENT_REFERENCE');
    }
    visited.add(currentParentId);

    const ancestor = await accountsRepository.findAccountById(client, orgId, currentParentId);
    if (!ancestor) break;
    currentParentId = ancestor.parent_account_id;
  }
}

/**
 * Create a new account.
 */
async function createAccount(orgId, userId, data) {
  // 1. Check duplicate code
  const existing = await accountsRepository.findAccountByCode(null, orgId, data.code);
  if (existing) {
    throw new AppError(`Account code "${data.code}" already exists in this organization`, 409, 'DUPLICATE_ACCOUNT_CODE');
  }

  // 2. Validate parent if provided
  if (data.parent_account_id) {
    const parent = await accountsRepository.findAccountById(null, orgId, data.parent_account_id);
    if (!parent) {
      throw new AppError('Parent account not found', 404, 'PARENT_ACCOUNT_NOT_FOUND');
    }
    if (parent.account_type !== data.account_type) {
      throw new AppError(`Parent account must share the same account type (expected "${data.account_type}", got "${parent.account_type}")`, 400, 'PARENT_TYPE_MISMATCH');
    }
    await assertNoAncestorCycle(null, orgId, null, data.parent_account_id);
  }

  // 3. Insert account
  const account = await accountsRepository.createAccount(null, orgId, userId, data);

  // 4. Audit log
  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.CREATE,
    entityType: 'accounts',
    entityId: account.id,
    before: null,
    after: account,
  }).catch(() => {});

  return account;
}

/**
 * Get account by ID.
 */
async function getAccountById(orgId, id) {
  const account = await accountsRepository.findAccountById(null, orgId, id);
  if (!account) {
    throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
  }
  return account;
}

/**
 * List accounts with pagination & filters.
 */
async function listAccounts(orgId, query = {}) {
  const { page, limit, offset } = parse(query);
  return accountsRepository.listAccounts(null, orgId, {
    page,
    limit,
    offset,
    search: query.search,
    status: query.status,
    accountType: query.account_type || query.accountType || query.type,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });
}

/**
 * Update an existing account.
 */
async function updateAccount(orgId, id, userId, data) {
  const existing = await accountsRepository.findAccountById(null, orgId, id);
  if (!existing) {
    throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
  }

  // System account protections
  if (existing.is_system) {
    if (data.account_type && data.account_type !== existing.account_type) {
      throw new AppError('System account type cannot be changed', 400, 'SYSTEM_ACCOUNT_IMMUTABLE');
    }
  }

  // Code uniqueness check if changed
  if (data.code && data.code !== existing.code) {
    const codeConflict = await accountsRepository.findAccountByCode(null, orgId, data.code);
    if (codeConflict && codeConflict.id !== id) {
      throw new AppError(`Account code "${data.code}" already exists in this organization`, 409, 'DUPLICATE_ACCOUNT_CODE');
    }
  }

  const effectiveType = data.account_type || existing.account_type;

  // Validate parent if updating parent
  if (data.parent_account_id !== undefined && data.parent_account_id !== null) {
    const parent = await accountsRepository.findAccountById(null, orgId, data.parent_account_id);
    if (!parent) {
      throw new AppError('Parent account not found', 404, 'PARENT_ACCOUNT_NOT_FOUND');
    }
    if (parent.account_type !== effectiveType) {
      throw new AppError(`Parent account must share the same account type (expected "${effectiveType}", got "${parent.account_type}")`, 400, 'PARENT_TYPE_MISMATCH');
    }
    await assertNoAncestorCycle(null, orgId, id, data.parent_account_id);
  }

  const updated = await accountsRepository.updateAccount(null, orgId, id, userId, data);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'accounts',
    entityId: id,
    before: existing,
    after: updated,
  }).catch(() => {});

  return updated;
}

/**
 * Archive an account.
 */
async function archiveAccount(orgId, id, userId) {
  const existing = await accountsRepository.findAccountById(null, orgId, id);
  if (!existing) {
    throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
  }

  if (existing.is_system) {
    throw new AppError('System accounts cannot be archived', 400, 'SYSTEM_ACCOUNT_CANNOT_ARCHIVE');
  }

  if (existing.status === 'archived') {
    return existing;
  }

  const blocker = await accountsRepository.checkAccountBlockers(null, orgId, id);
  if (blocker) {
    throw new AppError(`Cannot archive account: ${blocker}`, 409, 'ACCOUNT_ARCHIVE_BLOCKED');
  }

  const archived = await accountsRepository.archiveAccount(null, orgId, id, userId);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'accounts',
    entityId: id,
    before: existing,
    after: archived,
  }).catch(() => {});

  return archived;
}

/**
 * Unarchive an account.
 */
async function unarchiveAccount(orgId, id, userId) {
  const existing = await accountsRepository.findAccountById(null, orgId, id);
  if (!existing) {
    throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
  }

  if (existing.status === 'active') {
    return existing;
  }

  const unarchived = await accountsRepository.unarchiveAccount(null, orgId, id, userId);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'accounts',
    entityId: id,
    before: existing,
    after: unarchived,
  }).catch(() => {});

  return unarchived;
}

/**
 * Build hierarchical account tree.
 */
async function getAccountTree(orgId) {
  const rows = await accountsRepository.listAllAccountsForTree(null, orgId);

  const byId = {};
  rows.forEach((r) => {
    byId[r.id] = { ...r, children: [] };
  });

  const roots = [];
  rows.forEach((r) => {
    if (r.parent_account_id && byId[r.parent_account_id]) {
      byId[r.parent_account_id].children.push(byId[r.id]);
    } else {
      roots.push(byId[r.id]);
    }
  });

  return roots;
}

module.exports = {
  createAccount,
  getAccountById,
  listAccounts,
  updateAccount,
  archiveAccount,
  unarchiveAccount,
  getAccountTree,
};
