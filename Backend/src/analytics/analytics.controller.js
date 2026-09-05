'use strict';

const analyticsService = require('./analytics.service');
const { validateCreateAnalyticAccount, validateUpdateAnalyticAccount } = require('./analytics.validation');
const { success, created, error } = require('../utils/response');

/**
 * List analytic accounts.
 */
async function listAnalyticAccounts(req, res, next) {
  try {
    const orgId = req.organizationId;
    const result = await analyticsService.listAnalyticAccounts(orgId, req.query);
    return success(res, 'Analytic accounts retrieved successfully', result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get single analytic account by ID.
 */
async function getAnalyticAccountById(req, res, next) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;
    const account = await analyticsService.getAnalyticAccountById(orgId, id);
    return success(res, 'Analytic account retrieved successfully', account);
  } catch (err) {
    next(err);
  }
}

/**
 * Create new analytic account.
 */
async function createAnalyticAccount(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;

    const validation = validateCreateAnalyticAccount(req.body);
    if (!validation.isValid) {
      return error(res, validation.errors[0] || 'Validation failed', 400, validation.errors);
    }

    const account = await analyticsService.createAnalyticAccount(orgId, userId, validation.data);
    return created(res, 'Analytic account created successfully', account);
  } catch (err) {
    next(err);
  }
}

/**
 * Update analytic account.
 */
async function updateAnalyticAccount(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const validation = validateUpdateAnalyticAccount(req.body);
    if (!validation.isValid) {
      return error(res, validation.errors[0] || 'Validation failed', 400, validation.errors);
    }

    const updated = await analyticsService.updateAnalyticAccount(orgId, id, userId, validation.data);
    return success(res, 'Analytic account updated successfully', updated);
  } catch (err) {
    next(err);
  }
}

/**
 * Archive analytic account.
 */
async function archiveAnalyticAccount(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const archived = await analyticsService.archiveAnalyticAccount(orgId, id, userId);
    return success(res, 'Analytic account archived successfully', archived);
  } catch (err) {
    next(err);
  }
}

/**
 * Unarchive analytic account.
 */
async function unarchiveAnalyticAccount(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const unarchived = await analyticsService.unarchiveAnalyticAccount(orgId, id, userId);
    return success(res, 'Analytic account unarchived successfully', unarchived);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAnalyticAccounts,
  getAnalyticAccountById,
  createAnalyticAccount,
  updateAnalyticAccount,
  archiveAnalyticAccount,
  unarchiveAnalyticAccount,
};
