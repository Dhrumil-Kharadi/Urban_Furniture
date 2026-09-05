const { success, error } = require('../utils/response');
const organizationsService = require('./organizations.service');
const { validateUpdateOrganization } = require('./organizations.validation');

/**
 * Organizations Controller
 *
 * Reads req, calls validation, calls service, and returns standardized response.
 * NO SQL, NO business rules.
 */

const organizationsController = {
  /**
   * GET /api/organizations/current
   * Allowed roles: admin, manager
   */
  async getCurrent(req, res, next) {
    try {
      const org = await organizationsService.getCurrentOrganization(req.organizationId);
      return success(res, 'Organization retrieved successfully', org);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/organizations/current
   * Allowed roles: admin
   */
  async updateCurrent(req, res, next) {
    try {
      const validation = validateUpdateOrganization(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const updated = await organizationsService.updateCurrentOrganization(
        req.organizationId,
        validation.data,
        req.user.id
      );

      return success(res, 'Organization updated successfully', updated);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = organizationsController;
