const { money, toDb, sum, eq } = require('../shared/money');
const sequenceService = require('../shared/sequence.service');
const auditService = require('../shared/audit.service');
const accountingRepository = require('./accounting.repository');

/**
 * Accounting Service — THE LEDGER ENGINE
 *
 * This is the only place in the system that writes a journal entry. Sales,
 * purchases and payments all call `postJournalEntry`; none of them posts on
 * its own. That is deliberate: four modules each growing their own copy of
 * double-entry posting is how three of them end up subtly wrong.
 *
 * This module mounts no routes. It is called with the CALLER'S transaction
 * client, so a posting either commits with the document that caused it or
 * disappears with it. Any failure here throws, and the caller's transaction
 * rolls back — including the sequence number, which is why the number is
 * consumed on the shared client rather than a connection of its own.
 *
 * MONEY: every comparison and every sum goes through shared/money.js
 * (decimal.js). `SUM(debit) === SUM(credit)` compared as JS numbers is exactly
 * the bug this engine exists to prevent — 0.1 + 0.2 !== 0.3.
 *
 * The database enforces all of this again in migration 028. If the two ever
 * disagree, the database wins and the transaction aborts.
 */

/** Document type key for the JE sequence, matching what the org seed created. */
const JE_DOC_TYPE = 'JE';

/** @private */
function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * The fiscal year an entry date falls in.
 *
 * Phase 0 Decision A3 puts the Indian financial year start at April, so
 * 2026-02-14 belongs to FY 2025, not 2026. Numbering by calendar year would
 * restart the sequence three months into the books.
 *
 * @param {Date|string} entryDate
 * @param {number} [fiscalStartMonth=4] - 1-based.
 * @returns {string}
 * @private
 */
function fiscalYearFor(entryDate, fiscalStartMonth = 4) {
  const date = entryDate instanceof Date ? entryDate : new Date(`${entryDate}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return String(month >= fiscalStartMonth ? year : year - 1);
}

/**
 * Validate the shape and arithmetic of the proposed lines.
 *
 * Returns the normalised lines with debit and credit as fixed-2dp strings.
 * @private
 */
function normaliseLines(lines) {
  // 1. At least two lines. A one-line "double entry" is not one.
  if (!Array.isArray(lines) || lines.length < 2) {
    fail('A journal entry needs at least two lines');
  }

  const normalised = [];

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    if (!line || typeof line !== 'object') {
      fail(`Line ${lineNo} is malformed`);
    }
    if (!line.account_id) {
      fail(`Line ${lineNo} has no account`);
    }

    const debit = money(line.debit ?? 0);
    const credit = money(line.credit ?? 0);

    if (debit.isNegative() || credit.isNegative()) {
      fail(`Line ${lineNo} cannot be negative`);
    }

    const debitIsZero = debit.isZero();
    const creditIsZero = credit.isZero();

    // 2. Exactly one of debit/credit non-zero and positive.
    if (!debitIsZero && !creditIsZero) {
      fail(`Line ${lineNo} cannot be both a debit and a credit`);
    }
    if (debitIsZero && creditIsZero) {
      fail(`Line ${lineNo} must carry a debit or a credit amount`);
    }

    normalised.push({
      line_no: lineNo,
      account_id: line.account_id,
      partner_contact_id: line.partner_contact_id || null,
      analytic_account_id: line.analytic_account_id || null,
      debit: toDb(debit),
      credit: toDb(credit),
      description: line.description ? String(line.description).trim() : null,
    });
  });

  // 3. SUM(debit) === SUM(credit), compared through decimal.js — project.md §4.5.
  const totalDebit = sum(normalised.map((line) => line.debit));
  const totalCredit = sum(normalised.map((line) => line.credit));

  if (!eq(totalDebit, totalCredit)) {
    fail(
      `Journal entry is unbalanced: debit ${totalDebit} does not equal credit ${totalCredit}`,
      422
    );
  }

  return { lines: normalised, totalDebit, totalCredit };
}

const accountingService = {
  /**
   * Post a balanced journal entry. THE ONLY WAY an entry enters the ledger.
   *
   * Runs entirely on the caller's transaction client. Every failure throws, so
   * the caller's transaction — the invoice, the bill, the payment — rolls back
   * with it and no orphan document is left behind.
   *
   * @param {object} client - ACTIVE transaction client. Mandatory.
   * @param {object} payload
   * @param {string} payload.organizationId
   * @param {string} payload.journalId
   * @param {string} payload.entryDate      - ISO date (YYYY-MM-DD).
   * @param {Array}  payload.lines          - [{ account_id, debit, credit, … }]
   * @param {string} [payload.reference]
   * @param {string} [payload.narration]
   * @param {boolean} [payload.isAutoGenerated=false]
   * @param {string} [payload.sourceType]   - 'invoice' | 'bill' | 'payment' | …
   * @param {string} [payload.sourceId]
   * @param {string} [payload.actorUserId]
   * @param {string} [payload.ipAddress]
   * @param {number} [payload.fiscalStartMonth=4]
   * @returns {Promise<object>} The entry with its lines.
   */
  async postJournalEntry(client, payload) {
    if (!client || typeof client.query !== 'function') {
      throw new Error('postJournalEntry requires an active transaction client');
    }

    const {
      organizationId,
      journalId,
      entryDate,
      lines,
      reference = null,
      narration = null,
      isAutoGenerated = false,
      sourceType = null,
      sourceId = null,
      actorUserId = null,
      ipAddress = null,
      fiscalStartMonth = 4,
    } = payload;

    if (!organizationId) fail('Organization context is required', 403);
    if (!journalId) fail('A journal is required');
    if (!entryDate) fail('An entry date is required');

    // Steps 1–3: line shape, sides, and the balance check.
    const { lines: normalised, totalDebit } = normaliseLines(lines);

    // Step 4: the journal is active and belongs to this organization —
    // project.md §9.6 forbids posting to an archived journal.
    const journal = await accountingRepository.findPostableJournal(
      client, organizationId, journalId
    );
    if (!journal) {
      fail('Journal was not found or is archived', 400);
    }

    // Step 5: every account is active and belongs to this organization. Done
    // as ONE query over the distinct ids, not one query per line.
    const accountIds = [...new Set(normalised.map((line) => line.account_id))];
    const postable = await accountingRepository.findPostableAccounts(
      client, organizationId, accountIds
    );
    const postableIds = new Set(postable.map((account) => account.id));

    for (const accountId of accountIds) {
      if (!postableIds.has(accountId)) {
        // Same treatment as everywhere else: an account in another tenant is
        // reported as missing, never as forbidden.
        fail('An account on this entry was not found or is archived', 400);
      }
    }

    // Referenced contacts and analytic accounts must also be this tenant's.
    await accountingRepository.assertLineReferencesAreTenants(client, organizationId, normalised);

    // Step 6: consume the JE sequence on the SHARED client, so a rollback
    // releases the row lock and the number is never burned.
    const entryNumber = await sequenceService.nextDocumentNumber(
      client,
      organizationId,
      JE_DOC_TYPE,
      fiscalYearFor(entryDate, fiscalStartMonth)
    );

    // Step 7: insert the header, posted immediately.
    const entry = await accountingRepository.insertEntry(client, {
      organization_id: organizationId,
      journal_id: journalId,
      entry_number: entryNumber,
      entry_date: entryDate,
      reference,
      narration,
      status: 'posted',
      is_auto_generated: isAutoGenerated,
      source_type: sourceType,
      source_id: sourceId,
      actor_user_id: actorUserId,
    });

    // Step 8: bulk-insert the lines — one statement, not one per line.
    await accountingRepository.insertLines(client, organizationId, entry.id, normalised);

    // Step 9: the audit row, inside this same transaction.
    await auditService.recordAudit(client, {
      organizationId,
      actorUserId,
      action: 'post',
      entityType: 'journal_entry',
      entityId: entry.id,
      after: {
        entry_number: entry.entry_number,
        entry_date: entry.entry_date,
        journal_id: journalId,
        total: totalDebit,
        line_count: normalised.length,
        source_type: sourceType,
        source_id: sourceId,
      },
      ipAddress,
    });

    // Step 10: return the entry with its lines.
    return accountingRepository.findEntryWithLines(client, organizationId, entry.id);
  },

  /**
   * Reverse a posted entry.
   *
   * A reversal is a NEW entry whose debits and credits are the original's,
   * swapped. The original is left exactly as it was and flagged 'reversed'
   * with a pointer to its mirror.
   *
   * Nothing here mutates a posted line, and nothing could: the triggers in
   * migration 028 would abort the transaction. That is the point —
   * technicalrequirement.md §3.8 makes reversal the only correction mechanism,
   * so the audit trail shows what was originally posted AND what corrected it.
   *
   * @param {object} client - ACTIVE transaction client.
   * @param {string} entryId
   * @param {string} reason
   * @param {object} actor - { organizationId, actorUserId, ipAddress }
   * @returns {Promise<{ original: object, reversal: object }>}
   */
  async reverseJournalEntry(client, entryId, reason, actor = {}) {
    if (!client || typeof client.query !== 'function') {
      throw new Error('reverseJournalEntry requires an active transaction client');
    }

    const { organizationId, actorUserId = null, ipAddress = null, reversalDate = null } = actor;
    if (!organizationId) fail('Organization context is required', 403);

    const original = await accountingRepository.findEntryWithLines(client, organizationId, entryId);
    if (!original) fail('Journal entry not found', 404);

    if (original.status === 'draft') {
      fail('A draft entry has not been posted, so there is nothing to reverse', 409);
    }
    if (original.status === 'reversed') {
      fail('This entry has already been reversed', 409);
    }

    // Debits become credits and credits become debits. Everything else about
    // the line — account, partner, analytic tag — is carried across, so the
    // reversal lands on exactly the same dimensions as the original.
    const mirroredLines = original.lines.map((line) => ({
      account_id: line.account_id,
      partner_contact_id: line.partner_contact_id,
      analytic_account_id: line.analytic_account_id,
      debit: line.credit,
      credit: line.debit,
      description: line.description,
    }));

    const reversal = await accountingService.postJournalEntry(client, {
      organizationId,
      journalId: original.journal_id,
      // A reversal is dated when the correction is made, not backdated into a
      // period that may already be reported on.
      entryDate: reversalDate || new Date().toISOString().slice(0, 10),
      lines: mirroredLines,
      reference: original.entry_number,
      narration: reason
        ? `Reversal of ${original.entry_number}: ${reason}`
        : `Reversal of ${original.entry_number}`,
      isAutoGenerated: true,
      sourceType: 'reversal',
      sourceId: original.id,
      actorUserId,
      ipAddress,
    });

    const flagged = await accountingRepository.markReversed(
      client, organizationId, original.id, reversal.id, actorUserId
    );

    await auditService.recordAudit(client, {
      organizationId,
      actorUserId,
      action: 'reverse',
      entityType: 'journal_entry',
      entityId: original.id,
      before: { status: original.status },
      after: {
        status: 'reversed',
        reversed_by_entry_id: reversal.id,
        reversal_number: reversal.entry_number,
        reason: reason || null,
      },
      ipAddress,
    });

    return { original: flagged, reversal };
  },
};

module.exports = accountingService;
module.exports.fiscalYearFor = fiscalYearFor;
module.exports.normaliseLines = normaliseLines;
