'use strict';

const analyticsRepository = require('./analytics.repository');
const AppError = require('../shared/AppError');
const { parse } = require('../shared/pagination');
const { recordAudit } = require('../shared/audit.service');
const { AUDIT_ACTIONS } = require('../shared/constants');

/**
 * Create a new analytic account.
 */
async function createAnalyticAccount(orgId, userId, data) {
  const existing = await analyticsRepository.findAnalyticAccountByName(null, orgId, data.name);
  if (existing) {
    throw new AppError(
      `Analytic account "${data.name}" already exists in this organization`,
      409,
      'DUPLICATE_ANALYTIC_ACCOUNT_NAME'
    );
  }

  const account = await analyticsRepository.createAnalyticAccount(null, orgId, userId, data);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.CREATE,
    entityType: 'analytic_accounts',
    entityId: account.id,
    before: null,
    after: account,
  }).catch(() => {});

  return account;
}

/**
 * Get analytic account by ID.
 */
async function getAnalyticAccountById(orgId, id) {
  const account = await analyticsRepository.findAnalyticAccountById(null, orgId, id);
  if (!account) {
    throw new AppError('Analytic account not found', 404, 'ANALYTIC_ACCOUNT_NOT_FOUND');
  }
  return account;
}

/**
 * List analytic accounts with pagination and filters.
 */
async function listAnalyticAccounts(orgId, query = {}) {
  const { page, limit, offset } = parse(query);
  return analyticsRepository.listAnalyticAccounts(null, orgId, {
    page,
    limit,
    offset,
    search: query.search,
    status: query.status,
    analyticType: query.analytic_type || query.analyticType || query.type,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });
}

/**
 * Update an existing analytic account.
 */
async function updateAnalyticAccount(orgId, id, userId, data) {
  const existing = await analyticsRepository.findAnalyticAccountById(null, orgId, id);
  if (!existing) {
    throw new AppError('Analytic account not found', 404, 'ANALYTIC_ACCOUNT_NOT_FOUND');
  }

  if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
    const conflict = await analyticsRepository.findAnalyticAccountByName(null, orgId, data.name);
    if (conflict && conflict.id !== id) {
      throw new AppError(
        `Analytic account "${data.name}" already exists in this organization`,
        409,
        'DUPLICATE_ANALYTIC_ACCOUNT_NAME'
      );
    }
  }

  const updated = await analyticsRepository.updateAnalyticAccount(null, orgId, id, userId, data);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'analytic_accounts',
    entityId: id,
    before: existing,
    after: updated,
  }).catch(() => {});

  return updated;
}

/**
 * Archive an analytic account.
 */
async function archiveAnalyticAccount(orgId, id, userId) {
  const existing = await analyticsRepository.findAnalyticAccountById(null, orgId, id);
  if (!existing) {
    throw new AppError('Analytic account not found', 404, 'ANALYTIC_ACCOUNT_NOT_FOUND');
  }

  if (existing.status === 'archived') {
    return existing;
  }

  const blocker = await analyticsRepository.checkAnalyticAccountBlockers(null, orgId, id);
  if (blocker) {
    throw new AppError(`Cannot archive analytic account: ${blocker}`, 409, 'ANALYTIC_ACCOUNT_ARCHIVE_BLOCKED');
  }

  const archived = await analyticsRepository.archiveAnalyticAccount(null, orgId, id, userId);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'analytic_accounts',
    entityId: id,
    before: existing,
    after: archived,
  }).catch(() => {});

  return archived;
}

/**
 * Unarchive an analytic account.
 */
async function unarchiveAnalyticAccount(orgId, id, userId) {
  const existing = await analyticsRepository.findAnalyticAccountById(null, orgId, id);
  if (!existing) {
    throw new AppError('Analytic account not found', 404, 'ANALYTIC_ACCOUNT_NOT_FOUND');
  }

  if (existing.status === 'active') {
    return existing;
  }

  const unarchived = await analyticsRepository.unarchiveAnalyticAccount(null, orgId, id, userId);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'analytic_accounts',
    entityId: id,
    before: existing,
    after: unarchived,
  }).catch(() => {});

  return unarchived;
}

module.exports = {
  createAnalyticAccount,
  getAnalyticAccountById,
  listAnalyticAccounts,
  updateAnalyticAccount,
  archiveAnalyticAccount,
  unarchiveAnalyticAccount,
};
