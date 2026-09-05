const { success, created, error } = require('../utils/response');
const accountsValidation = require('./accounts.validation');
const accountsService = require('./accounts.service');

/**
 * Accounts Controller (Chart of Accounts)
 *
 * Reads the request, validates, delegates, responds. No SQL, no rules.
 */

const accountsController = {
  /** GET /api/accounts */
  async listAccounts(req, res, next) {
    try {
      const validation = accountsValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await accountsService.listAccounts(req.organizationId, {
        ...req.query,
        ...validation.data,
      });

      return success(res, 'Accounts retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/accounts/tree */
  async getAccountTree(req, res, next) {
    try {
      const validation = accountsValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await accountsService.getAccountTree(req.organizationId, validation.data);
      return success(res, 'Account tree retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/accounts/:id */
  async getAccount(req, res, next) {
    try {
      const account = await accountsService.getAccount(req.organizationId, req.params.id);
      return success(res, 'Account retrieved successfully', { account });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/accounts */
  async createAccount(req, res, next) {
    try {
      const validation = accountsValidation.validateCreate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const account = await accountsService.createAccount({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return created(res, 'Account created successfully', { account });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/accounts/:id */
  async updateAccount(req, res, next) {
    try {
      const validation = accountsValidation.validateUpdate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const account = await accountsService.updateAccount({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        accountId: req.params.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return success(res, 'Account updated successfully', { account });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/accounts/:id/archive */
  async archiveAccount(req, res, next) {
    try {
      const account = await accountsService.archiveAccount({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        accountId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Account archived successfully', { account });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/accounts/:id/unarchive */
  async unarchiveAccount(req, res, next) {
    try {
      const account = await accountsService.unarchiveAccount({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        accountId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Account restored successfully', { account });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = accountsController;
