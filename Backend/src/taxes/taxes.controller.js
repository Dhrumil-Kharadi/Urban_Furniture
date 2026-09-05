const { success, created, error } = require('../utils/response');
const taxesValidation = require('./taxes.validation');
const taxesService = require('./taxes.service');

/**
 * Taxes Controller
 *
 * Reads the request, validates, delegates, responds. No SQL, no rules.
 */

const taxesController = {
  /** GET /api/taxes */
  async listTaxes(req, res, next) {
    try {
      const validation = taxesValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await taxesService.listTaxes(req.organizationId, {
        ...req.query,
        ...validation.data,
      });

      return success(res, 'Taxes retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/taxes/:id */
  async getTax(req, res, next) {
    try {
      const tax = await taxesService.getTax(req.organizationId, req.params.id);
      return success(res, 'Tax retrieved successfully', { tax });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/taxes */
  async createTax(req, res, next) {
    try {
      const validation = taxesValidation.validateCreate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const tax = await taxesService.createTax({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return created(res, 'Tax created successfully', { tax });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/taxes/:id */
  async updateTax(req, res, next) {
    try {
      const validation = taxesValidation.validateUpdate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const tax = await taxesService.updateTax({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        taxId: req.params.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return success(res, 'Tax updated successfully', { tax });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/taxes/:id/archive */
  async archiveTax(req, res, next) {
    try {
      const tax = await taxesService.archiveTax({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        taxId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Tax archived successfully', { tax });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/taxes/:id/unarchive */
  async unarchiveTax(req, res, next) {
    try {
      const tax = await taxesService.unarchiveTax({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        taxId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Tax restored successfully', { tax });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = taxesController;
