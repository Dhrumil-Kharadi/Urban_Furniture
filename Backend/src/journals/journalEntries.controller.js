const { success, created, error } = require('../utils/response');
const journalEntriesValidation = require('./journalEntries.validation');
const journalEntriesService = require('./journalEntries.service');

/**
 * Journal Entries Controller
 *
 * Reads the request, validates, delegates, responds.
 *
 * There is deliberately NO update and NO delete handler here. A posted entry
 * is immutable — technicalrequirement.md §3.8 — and correction is by reversing
 * entry only. The absence is the feature; adding either one back would need
 * the database triggers removed too, which is the point at which somebody
 * should stop and ask why.
 */

const journalEntriesController = {
  /** GET /api/journal-entries */
  async listEntries(req, res, next) {
    try {
      const validation = journalEntriesValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await journalEntriesService.listEntries(req.organizationId, {
        ...req.query,
        ...validation.data,
      });

      return success(res, 'Journal entries retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/journal-entries/:id */
  async getEntry(req, res, next) {
    try {
      const entry = await journalEntriesService.getEntry(req.organizationId, req.params.id);
      return success(res, 'Journal entry retrieved successfully', { entry });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/journal-entries — a manual entry, posted immediately. */
  async createEntry(req, res, next) {
    try {
      const validation = journalEntriesValidation.validateCreate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const entry = await journalEntriesService.createEntry({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return created(res, 'Journal entry posted successfully', { entry });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/journal-entries/:id/reverse */
  async reverseEntry(req, res, next) {
    try {
      const validation = journalEntriesValidation.validateReverse(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await journalEntriesService.reverseEntry({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        entryId: req.params.id,
        reason: validation.data.reason,
        reversalDate: validation.data.reversalDate,
        ipAddress: req.ip,
      });

      return created(res, 'Journal entry reversed successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/journal-entries/opening-balances */
  async postOpeningBalances(req, res, next) {
    try {
      const { journal_id: journalId, entry_date: entryDate } = req.body || {};

      if (!journalId) {
        return error(res, 'A journal is required', 400);
      }
      if (!entryDate || !journalEntriesValidation.isRealDate(String(entryDate))) {
        return error(res, 'A valid entry date (YYYY-MM-DD) is required', 400);
      }

      const entry = await journalEntriesService.postOpeningBalances({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        journalId,
        entryDate,
        ipAddress: req.ip,
      });

      if (!entry) {
        return success(res, 'No opening balances to post', { entry: null });
      }

      return created(res, 'Opening balances posted successfully', { entry });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = journalEntriesController;
