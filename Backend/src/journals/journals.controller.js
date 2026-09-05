'use strict';

const journalsService = require('./journals.service');
const { validateCreateJournal, validateUpdateJournal } = require('./journals.validation');
const { success, created, error } = require('../utils/response');

/**
 * List journals.
 */
async function listJournals(req, res, next) {
  try {
    const orgId = req.organizationId;
    const result = await journalsService.listJournals(orgId, req.query);
    return success(res, 'Journals retrieved successfully', result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get single journal by ID.
 */
async function getJournalById(req, res, next) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;
    const journal = await journalsService.getJournalById(orgId, id);
    return success(res, 'Journal retrieved successfully', journal);
  } catch (err) {
    next(err);
  }
}

/**
 * Create new journal.
 */
async function createJournal(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;

    const validation = validateCreateJournal(req.body);
    if (!validation.isValid) {
      return error(res, validation.errors[0] || 'Validation failed', 400, validation.errors);
    }

    const journal = await journalsService.createJournal(orgId, userId, validation.data);
    return created(res, 'Journal created successfully', journal);
  } catch (err) {
    next(err);
  }
}

/**
 * Update journal.
 */
async function updateJournal(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const validation = validateUpdateJournal(req.body);
    if (!validation.isValid) {
      return error(res, validation.errors[0] || 'Validation failed', 400, validation.errors);
    }

    const updated = await journalsService.updateJournal(orgId, id, userId, validation.data);
    return success(res, 'Journal updated successfully', updated);
  } catch (err) {
    next(err);
  }
}

/**
 * Archive journal.
 */
async function archiveJournal(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const archived = await journalsService.archiveJournal(orgId, id, userId);
    return success(res, 'Journal archived successfully', archived);
  } catch (err) {
    next(err);
  }
}

/**
 * Unarchive journal.
 */
async function unarchiveJournal(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const unarchived = await journalsService.unarchiveJournal(orgId, id, userId);
    return success(res, 'Journal unarchived successfully', unarchived);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listJournals,
  getJournalById,
  createJournal,
  updateJournal,
  archiveJournal,
  unarchiveJournal,
};
