const { success, created, error } = require('../utils/response');
const journalsValidation = require('./journals.validation');
const journalsService = require('./journals.service');

/**
 * Journals Controller
 *
 * Reads the request, validates, delegates, responds. No SQL, no rules.
 */

const journalsController = {
  /** GET /api/journals */
  async listJournals(req, res, next) {
    try {
      const validation = journalsValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await journalsService.listJournals(req.organizationId, {
        ...req.query,
        ...validation.data,
      });

      return success(res, 'Journals retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/journals/:id */
  async getJournal(req, res, next) {
    try {
      const journal = await journalsService.getJournal(req.organizationId, req.params.id);
      return success(res, 'Journal retrieved successfully', { journal });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/journals */
  async createJournal(req, res, next) {
    try {
      const validation = journalsValidation.validateCreate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const journal = await journalsService.createJournal({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return created(res, 'Journal created successfully', { journal });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/journals/:id */
  async updateJournal(req, res, next) {
    try {
      const validation = journalsValidation.validateUpdate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const journal = await journalsService.updateJournal({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        journalId: req.params.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return success(res, 'Journal updated successfully', { journal });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/journals/:id/archive */
  async archiveJournal(req, res, next) {
    try {
      const journal = await journalsService.archiveJournal({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        journalId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Journal archived successfully', { journal });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/journals/:id/unarchive */
  async unarchiveJournal(req, res, next) {
    try {
      const journal = await journalsService.unarchiveJournal({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        journalId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Journal restored successfully', { journal });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = journalsController;
