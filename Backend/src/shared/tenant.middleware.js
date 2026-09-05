const { error } = require('../utils/response');

/**
 * Tenant resolution middleware.
 * Runs AFTER authenticate and BEFORE authorize on domain routes.
 *
 * Derives organizationId strictly from req.user.organization_id.
 * If missing (e.g. unassigned user or platform operator without an org),
 * returns 403 Forbidden with no further detail to avoid data leakage.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function resolveTenant(req, res, next) {
  const orgId = req.user?.organization_id;
  if (!orgId) {
    return error(res, 'No organization context for this account', 403);
  }
  req.organizationId = orgId;
  return next();
}

module.exports = { resolveTenant };
