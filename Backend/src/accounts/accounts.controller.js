'use strict';

const accountsService = require('./accounts.service');
const { validateCreateAccount, validateUpdateAccount } = require('./accounts.validation');
const { success, created, error } = require('../utils/response');

/**
 * List accounts.
 */
async function listAccounts(req, res, next) {
  try {
    const orgId = req.organizationId;
    const result = await accountsService.listAccounts(orgId, req.query);
    return success(res, 'Accounts retrieved successfully', result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get account tree.
 */
async function getAccountTree(req, res, next) {
  try {
    const orgId = req.organizationId;
    const tree = await accountsService.getAccountTree(orgId);
    return success(res, 'Account tree retrieved successfully', tree);
  } catch (err) {
    next(err);
  }
}

/**
 * Get single account by ID.
 */
async function getAccountById(req, res, next) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;
    const account = await accountsService.getAccountById(orgId, id);
    return success(res, 'Account retrieved successfully', account);
  } catch (err) {
    next(err);
  }
}

/**
 * Create new account.
 */
async function createAccount(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;

    const validation = validateCreateAccount(req.body);
    if (!validation.isValid) {
      return error(res, validation.errors[0] || 'Validation failed', 400, validation.errors);
    }

    const account = await accountsService.createAccount(orgId, userId, validation.data);
    return created(res, 'Account created successfully', account);
  } catch (err) {
    next(err);
  }
}

/**
 * Update account.
 */
async function updateAccount(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const validation = validateUpdateAccount(req.body);
    if (!validation.isValid) {
      return error(res, validation.errors[0] || 'Validation failed', 400, validation.errors);
    }

    const updated = await accountsService.updateAccount(orgId, id, userId, validation.data);
    return success(res, 'Account updated successfully', updated);
  } catch (err) {
    next(err);
  }
}

/**
 * Archive account.
 */
async function archiveAccount(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const archived = await accountsService.archiveAccount(orgId, id, userId);
    return success(res, 'Account archived successfully', archived);
  } catch (err) {
    next(err);
  }
}

/**
 * Unarchive account.
 */
async function unarchiveAccount(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const unarchived = await accountsService.unarchiveAccount(orgId, id, userId);
    return success(res, 'Account unarchived successfully', unarchived);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAccounts,
  getAccountTree,
  getAccountById,
  createAccount,
  updateAccount,
  archiveAccount,
  unarchiveAccount,
};
