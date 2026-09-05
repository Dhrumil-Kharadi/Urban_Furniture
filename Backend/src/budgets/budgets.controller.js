/**
 * Budgets Controller
 *
 * Handles HTTP in/out. No SQL, no business logic.
 * Responses use utils/response.js.
 */

const budgetsService = require('./budgets.service');
const budgetsValidation = require('./budgets.validation');
const { success, created, error } = require('../utils/response');

const budgetsController = {
  async listBudgets(req, res, next) {
    try {
      const validation = budgetsValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await budgetsService.listBudgets(req.organizationId, req.query);
      return success(res, 'Budgets retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  async getBudget(req, res, next) {
    try {
      const result = await budgetsService.getBudgetDetail(req.organizationId, req.params.id);
      return success(res, 'Budget retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  async createBudget(req, res, next) {
    try {
      const validation = budgetsValidation.validateCreate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const budget = await budgetsService.createBudget(
        req.organizationId,
        validation.data,
        req.user.id
      );
      return created(res, 'Budget created successfully', budget);
    } catch (err) {
      next(err);
    }
  },

  async updateBudget(req, res, next) {
    try {
      const validation = budgetsValidation.validateUpdate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const budget = await budgetsService.updateBudget(
        req.organizationId,
        req.params.id,
        validation.data,
        req.user.id
      );
      return success(res, 'Budget updated successfully', budget);
    } catch (err) {
      next(err);
    }
  },

  async archiveBudget(req, res, next) {
    try {
      const budget = await budgetsService.archiveBudget(
        req.organizationId,
        req.params.id,
        req.user.id
      );
      return success(res, 'Budget archived successfully', budget);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = budgetsController;
