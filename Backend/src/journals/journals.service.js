const { withTransaction } = require('../shared/withTransaction');
const auditService = require('../shared/audit.service');
const { JOURNAL_STATUS, JOURNAL_TYPES, ACCOUNT_STATUS } = require('../shared/constants');
const { findBlockingReferences, JOURNAL_REFERENCE_SOURCES } = require('../shared/references');
const accountsRepository = require('../accounts/accounts.repository');
const journalsRepository = require('./journals.repository');

/**
 * Journals Service
 *
 * A journal is the book a document posts into, so two guards matter:
 *
 *   - Its default accounts must be active and belong to the same tenant. A
 *     default pointing at another organization's account is a cross-tenant
 *     leak dressed up as a convenience.
 *
 *   - The last active journal of a type the posting rules reach for (sales,
 *     purchase, bank, cash) cannot be archived. project.md §9.6 forbids
 *     posting to an archived journal, so archiving the only Sales journal
 *     would stop invoicing entirely, with an error pointing somewhere else.
 */

/** Journal types the posting rules depend on existing. */
const REQUIRED_JOURNAL_TYPES = Object.freeze([
  JOURNAL_TYPES.SALES,
  JOURNAL_TYPES.PURCHASE,
  JOURNAL_TYPES.BANK,
  JOURNAL_TYPES.CASH,
]);

/** @private */
function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * A journal in another organization is reported as missing, never as
 * forbidden — a 403 would confirm it exists.
 * @private
 */
async function loadOrFail(client, organizationId, journalId) {
  const journal = await journalsRepository.findByIdAndOrg(client, organizationId, journalId);
  if (!journal) fail('Journal not found', 404);
  return journal;
}

/**
 * Confirm each supplied default account exists in this tenant and is active.
 * @private
 */
async function assertDefaultAccounts(client, organizationId, data) {
  const checks = [
    ['default_debit_account_id', 'Default debit account'],
    ['default_credit_account_id', 'Default credit account'],
  ];

  for (const [field, label] of checks) {
    const accountId = data[field];
    if (!accountId) continue;

    const account = await accountsRepository.findByIdAndOrg(client, organizationId, accountId);
    if (!account) fail(`${label} was not found`, 400);
    if (account.status !== ACCOUNT_STATUS.ACTIVE) fail(`${label} is archived`, 400);
  }
}

const journalsService = {
  /**
   * @param {string} organizationId
   * @param {object} query
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async listJournals(organizationId, query) {
    return journalsRepository.list(null, organizationId, query);
  },

  /**
   * @param {string} organizationId
   * @param {string} journalId
   * @returns {Promise<object>}
   */
  async getJournal(organizationId, journalId) {
    return loadOrFail(null, organizationId, journalId);
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async createJournal({ organizationId, actorUserId, data, ipAddress = null }) {
    const duplicate = await journalsRepository.findByName(null, organizationId, data.name);
    if (duplicate) fail('A journal with that name already exists', 409);

    await assertDefaultAccounts(null, organizationId, data);

    return withTransaction(async (client) => {
      const journal = await journalsRepository.insert(client, {
        organization_id: organizationId,
        actor_user_id: actorUserId,
        ...data,
      });

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'journal',
        entityId: journal.id,
        after: journal,
        ipAddress,
      });

      return journal;
    });
  },

  /**
   * @param {object} params
   * @returns {Promise<object>}
   */
  async updateJournal({ organizationId, actorUserId, journalId, data, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, journalId);

    if (data.name) {
      const duplicate = await journalsRepository.findByName(
        null, organizationId, data.name, journalId
      );
      if (duplicate) fail('A journal with that name already exists', 409);
    }

    // Retyping a journal that already holds posted entries would reclassify
    // history: last year's invoices would suddenly sit in a Cash book.
    if (data.journal_type && data.journal_type !== existing.journal_type) {
      const blockers = await findBlockingReferences(
        null, JOURNAL_REFERENCE_SOURCES, journalId, organizationId
      );
      if (blockers.length > 0) {
        fail('A journal with posted entries cannot change type', 409);
      }
    }

    await assertDefaultAccounts(null, organizationId, data);

    return withTransaction(async (client) => {
      const updated = await journalsRepository.update(
        client, organizationId, journalId, data, actorUserId
      );
      if (!updated) fail('Journal not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'journal',
        entityId: journalId,
        before: existing,
        after: updated,
        ipAddress,
      });

      return updated;
    });
  },

  /**
   * Archive a journal.
   *
   * Refused when it holds posted entries, and refused when it is the last
   * active journal of a type the posting rules require.
   *
   * @param {object} params
   * @returns {Promise<object>}
   */
  async archiveJournal({ organizationId, actorUserId, journalId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, journalId);

    if (existing.status === JOURNAL_STATUS.ARCHIVED) {
      fail('Journal is already archived', 409);
    }

    const blockers = await findBlockingReferences(
      null, JOURNAL_REFERENCE_SOURCES, journalId, organizationId
    );
    if (blockers.length > 0) {
      const detail = blockers.map((b) => `${b.table} (${b.count})`).join(', ');
      fail(`Journal cannot be archived while it is referenced by: ${detail}`, 409);
    }

    if (REQUIRED_JOURNAL_TYPES.includes(existing.journal_type)) {
      const remaining = await journalsRepository.countActiveOfType(
        null, organizationId, existing.journal_type
      );
      if (remaining <= 1) {
        fail(
          `This is the only active ${existing.journal_type} journal; documents of that kind could not be posted without it`,
          409
        );
      }
    }

    return withTransaction(async (client) => {
      const archived = await journalsRepository.setStatus(
        client, organizationId, journalId, JOURNAL_STATUS.ARCHIVED, actorUserId
      );
      if (!archived) fail('Journal not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'archive',
        entityType: 'journal',
        entityId: journalId,
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
  async unarchiveJournal({ organizationId, actorUserId, journalId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, journalId);

    if (existing.status === JOURNAL_STATUS.ACTIVE) {
      fail('Journal is already active', 409);
    }

    return withTransaction(async (client) => {
      const restored = await journalsRepository.setStatus(
        client, organizationId, journalId, JOURNAL_STATUS.ACTIVE, actorUserId
      );
      if (!restored) fail('Journal not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'unarchive',
        entityType: 'journal',
        entityId: journalId,
        before: existing,
        after: restored,
        ipAddress,
      });

      return restored;
    });
  },
};

module.exports = journalsService;
