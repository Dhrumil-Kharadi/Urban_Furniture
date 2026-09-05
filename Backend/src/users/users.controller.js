const { success, created, error } = require('../utils/response');
const usersValidation = require('./users.validation');
const usersService = require('./users.service');

/**
 * Users Controller
 *
 * Handles HTTP requests for organization user management.
 */

const usersController = {
  /**
   * GET /api/users
   * List organization users.
   */
  async listUsers(req, res, next) {
    try {
      const result = await usersService.listUsers(req.organizationId, req.query);
      return success(res, 'Users retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/users/invite
   * Invite an Accountant (role='manager').
   */
  async inviteUser(req, res, next) {
    try {
      const validation = usersValidation.validateInvite(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await usersService.inviteUser(
        req.organizationId,
        req.user.id,
        validation.data
      );

      return created(res, 'Invitation sent', result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/users/:id/status
   * Activate or deactivate an organization user.
   */
  async updateStatus(req, res, next) {
    try {
      const validation = usersValidation.validateStatusUpdate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const updated = await usersService.updateStatus(
        req.organizationId,
        req.user.id,
        req.params.id,
        validation.data.status
      );

      return success(res, 'User status updated successfully', { user: updated });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = usersController;
