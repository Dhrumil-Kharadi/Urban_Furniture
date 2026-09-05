const { success, created, error } = require('../utils/response');
const productCategoriesValidation = require('./product-categories.validation');
const productCategoriesService = require('./product-categories.service');

/**
 * Product Categories Controller
 *
 * Reads the request, validates, delegates, responds. No SQL, no rules.
 */

const productCategoriesController = {
  /** GET /api/product-categories */
  async listCategories(req, res, next) {
    try {
      const validation = productCategoriesValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await productCategoriesService.listCategories(req.organizationId, {
        ...req.query,
        ...validation.data,
      });

      return success(res, 'Product categories retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/product-categories/:id */
  async getCategory(req, res, next) {
    try {
      const category = await productCategoriesService.getCategory(
        req.organizationId, req.params.id
      );
      return success(res, 'Product category retrieved successfully', { category });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/product-categories */
  async createCategory(req, res, next) {
    try {
      const validation = productCategoriesValidation.validateCreate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const category = await productCategoriesService.createCategory({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return created(res, 'Product category created successfully', { category });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/product-categories/:id */
  async updateCategory(req, res, next) {
    try {
      const validation = productCategoriesValidation.validateUpdate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const category = await productCategoriesService.updateCategory({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        categoryId: req.params.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return success(res, 'Product category updated successfully', { category });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/product-categories/:id/archive */
  async archiveCategory(req, res, next) {
    try {
      const category = await productCategoriesService.archiveCategory({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        categoryId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Product category archived successfully', { category });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/product-categories/:id/unarchive */
  async unarchiveCategory(req, res, next) {
    try {
      const category = await productCategoriesService.unarchiveCategory({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        categoryId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Product category restored successfully', { category });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = productCategoriesController;
