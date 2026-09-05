const { success, created, error } = require('../utils/response');
const analyticsValidation = require('./analytics.validation');
const analyticsService = require('./analytics.service');

/**
 * Analytic Accounts Controller
 *
 * Reads the request, validates, delegates, responds. No SQL, no rules.
 */

const analyticsController = {
  /** GET /api/analytic-accounts */
  async listAnalyticAccounts(req, res, next) {
    try {
      const validation = analyticsValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await analyticsService.listAnalyticAccounts(req.organizationId, {
        ...req.query,
        ...validation.data,
      });

      return success(res, 'Analytic accounts retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/analytic-accounts/:id */
  async getAnalyticAccount(req, res, next) {
    try {
      const analyticAccount = await analyticsService.getAnalyticAccount(
        req.organizationId, req.params.id
      );
      return success(res, 'Analytic account retrieved successfully', { analyticAccount });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/analytic-accounts */
  async createAnalyticAccount(req, res, next) {
    try {
      const validation = analyticsValidation.validateCreate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const analyticAccount = await analyticsService.createAnalyticAccount({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return created(res, 'Analytic account created successfully', { analyticAccount });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/analytic-accounts/:id */
  async updateAnalyticAccount(req, res, next) {
    try {
      const validation = analyticsValidation.validateUpdate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const analyticAccount = await analyticsService.updateAnalyticAccount({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        analyticId: req.params.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return success(res, 'Analytic account updated successfully', { analyticAccount });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/analytic-accounts/:id/archive */
  async archiveAnalyticAccount(req, res, next) {
    try {
      const analyticAccount = await analyticsService.archiveAnalyticAccount({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        analyticId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Analytic account archived successfully', { analyticAccount });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/analytic-accounts/:id/unarchive */
  async unarchiveAnalyticAccount(req, res, next) {
    try {
      const analyticAccount = await analyticsService.unarchiveAnalyticAccount({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        analyticId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Analytic account restored successfully', { analyticAccount });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = analyticsController;
