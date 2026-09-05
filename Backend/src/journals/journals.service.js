'use strict';

const journalsRepository = require('./journals.repository');
const accountsRepository = require('../accounts/accounts.repository');
const AppError = require('../shared/AppError');
const { parse } = require('../shared/pagination');
const { recordAudit } = require('../shared/audit.service');
const { AUDIT_ACTIONS } = require('../shared/constants');

/**
 * Validate that an account ID belongs to the same organization and is active.
 */
async function validateAccount(orgId, accountId, fieldName) {
  if (!accountId) return;
  const acc = await accountsRepository.findAccountById(null, orgId, accountId);
  if (!acc) {
    throw new AppError(`${fieldName} does not exist in this organization`, 404, 'ACCOUNT_NOT_FOUND');
  }
  if (acc.status === 'archived') {
    throw new AppError(`Cannot assign archived account as ${fieldName}`, 400, 'ACCOUNT_ARCHIVED');
  }
}

/**
 * Create a new journal.
 */
async function createJournal(orgId, userId, data) {
  // Validate default accounts if provided
  if (data.default_debit_account_id) {
    await validateAccount(orgId, data.default_debit_account_id, 'Default debit account');
  }
  if (data.default_credit_account_id) {
    await validateAccount(orgId, data.default_credit_account_id, 'Default credit account');
  }

  const journal = await journalsRepository.createJournal(null, orgId, userId, data);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.CREATE,
    entityType: 'journals',
    entityId: journal.id,
    before: null,
    after: journal,
  }).catch(() => {});

  return journal;
}

/**
 * Get journal by ID.
 */
async function getJournalById(orgId, id) {
  const journal = await journalsRepository.findJournalById(null, orgId, id);
  if (!journal) {
    throw new AppError('Journal not found', 404, 'JOURNAL_NOT_FOUND');
  }
  return journal;
}

/**
 * List journals with pagination and filters.
 */
async function listJournals(orgId, query = {}) {
  const { page, limit, offset } = parse(query);
  return journalsRepository.listJournals(null, orgId, {
    page,
    limit,
    offset,
    search: query.search,
    status: query.status,
    journalType: query.journal_type || query.journalType,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });
}

/**
 * Update an existing journal.
 */
async function updateJournal(orgId, id, userId, data) {
  const existing = await journalsRepository.findJournalById(null, orgId, id);
  if (!existing) {
    throw new AppError('Journal not found', 404, 'JOURNAL_NOT_FOUND');
  }

  if (data.default_debit_account_id) {
    await validateAccount(orgId, data.default_debit_account_id, 'Default debit account');
  }
  if (data.default_credit_account_id) {
    await validateAccount(orgId, data.default_credit_account_id, 'Default credit account');
  }

  const updated = await journalsRepository.updateJournal(null, orgId, id, userId, data);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'journals',
    entityId: id,
    before: existing,
    after: updated,
  }).catch(() => {});

  return updated;
}

/**
 * Archive a journal.
 */
async function archiveJournal(orgId, id, userId) {
  const existing = await journalsRepository.findJournalById(null, orgId, id);
  if (!existing) {
    throw new AppError('Journal not found', 404, 'JOURNAL_NOT_FOUND');
  }

  if (existing.status === 'archived') {
    return existing;
  }

  const blocker = await journalsRepository.checkJournalBlockers(null, orgId, id);
  if (blocker) {
    throw new AppError(`Cannot archive journal: ${blocker}`, 409, 'JOURNAL_ARCHIVE_BLOCKED');
  }

  const archived = await journalsRepository.archiveJournal(null, orgId, id, userId);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'journals',
    entityId: id,
    before: existing,
    after: archived,
  }).catch(() => {});

  return archived;
}

/**
 * Unarchive a journal.
 */
async function unarchiveJournal(orgId, id, userId) {
  const existing = await journalsRepository.findJournalById(null, orgId, id);
  if (!existing) {
    throw new AppError('Journal not found', 404, 'JOURNAL_NOT_FOUND');
  }

  if (existing.status === 'active') {
    return existing;
  }

  const unarchived = await journalsRepository.unarchiveJournal(null, orgId, id, userId);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'journals',
    entityId: id,
    before: existing,
    after: unarchived,
  }).catch(() => {});

  return unarchived;
}

module.exports = {
  createJournal,
  getJournalById,
  listJournals,
  updateJournal,
  archiveJournal,
  unarchiveJournal,
};
