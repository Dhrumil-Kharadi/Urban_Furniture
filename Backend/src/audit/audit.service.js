/**
 * Audit Service
 *
 * Querying and analyzing audit logs.
 * Reference: project.md §9.2 · phase.md Phase 13
 */

const auditRepository = require('./audit.repository');

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

const auditService = {
  async listAuditLogs(organizationId, query) {
    return auditRepository.list(null, organizationId, query);
  },

  async getAuditLogById(organizationId, id) {
    const log = await auditRepository.findById(null, organizationId, id);
    if (!log) {
      fail('Audit log not found', 404);
    }
    return log;
  },
};

module.exports = auditService;
