const { success, created, error } = require('../utils/response');
const productsValidation = require('./products.validation');
const productsService = require('./products.service');

/**
 * Products Controller
 *
 * Reads the request, validates, delegates, responds. No SQL, no rules.
 */

const productsController = {
  /** GET /api/products */
  async listProducts(req, res, next) {
    try {
      const validation = productsValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await productsService.listProducts(req.organizationId, {
        ...req.query,
        ...validation.data,
      });

      return success(res, 'Products retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/products/:id */
  async getProduct(req, res, next) {
    try {
      const product = await productsService.getProduct(req.organizationId, req.params.id);
      return success(res, 'Product retrieved successfully', { product });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/products */
  async createProduct(req, res, next) {
    try {
      const validation = productsValidation.validateCreate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const product = await productsService.createProduct({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return created(res, 'Product created successfully', { product });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/products/:id
   * Admin only — project.md §3: only the business owner may change a price.
   */
  async updateProduct(req, res, next) {
    try {
      const validation = productsValidation.validateUpdate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const product = await productsService.updateProduct({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        productId: req.params.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return success(res, 'Product updated successfully', { product });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/products/:id/archive */
  async archiveProduct(req, res, next) {
    try {
      const product = await productsService.archiveProduct({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        productId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Product archived successfully', { product });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/products/:id/unarchive */
  async unarchiveProduct(req, res, next) {
    try {
      const product = await productsService.unarchiveProduct({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        productId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Product restored successfully', { product });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = productsController;
