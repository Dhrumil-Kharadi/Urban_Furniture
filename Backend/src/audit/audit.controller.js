/**
 * Audit Controller
 */

const auditService = require('./audit.service');
const { success } = require('../utils/response');

const auditController = {
  async list(req, res, next) {
    try {
      const data = await auditService.listAuditLogs(
        req.user.organization_id,
        req.query
      );
      return success(res, 'Audit logs retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const data = await auditService.getAuditLogById(
        req.user.organization_id,
        req.params.id
      );
      return success(res, 'Audit log retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = auditController;
