/**
 * Notifications Controller
 */

const notificationsService = require('./notifications.service');
const { success } = require('../utils/response');

const notificationsController = {
  async list(req, res, next) {
    try {
      const data = await notificationsService.listNotifications(
        req.user.organization_id,
        req.query
      );
      return success(res, 'Notifications retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  },

  async retry(req, res, next) {
    try {
      const result = await notificationsService.retryPendingOrFailed(
        req.user.organization_id
      );
      return success(res, 'Retried pending/failed notifications', result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = notificationsController;
