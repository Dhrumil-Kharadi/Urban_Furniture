/**
 * Dashboard Controller
 * Reference: project.md §9 · phase.md Phase 13
 */

const dashboardService = require('./dashboard.service');
const portalRepository = require('../portal/portal.repository');
const { success, error } = require('../utils/response');

async function getSummary(req, res, next) {
  try {
    const orgId = req.organizationId || req.user.organization_id;

    // PORTAL DASHBOARD (role 'user'): Total Outstanding, Overdue, Paid This Year,
    // own recent documents — NO ORG-WIDE FIGURES WHATSOEVER.
    if (req.user.role === 'customer') {
      if (!req.user.contact_id) {
        return error(res, 'Access restricted to contact portal accounts', 403);
      }

      const portalSummary = await portalRepository.getCustomerSummary(
        null,
        orgId,
        req.user.contact_id
      );

      return success(
        res,
        'Portal dashboard summary retrieved successfully',
        {
          role: 'customer',
          kpis: {
            totalOutstanding: portalSummary.totalOutstanding,
            totalOverdue: portalSummary.totalOverdue,
            paidThisYear: portalSummary.paidThisYear,
            unpaidCount: portalSummary.unpaidCount,
          },
          recentDocuments: portalSummary.recentDocuments,
        }
      );
    }

    // Role 'admin' or 'manager': Full unified org-wide summary
    const summary = await dashboardService.getSummary(orgId, req.query);
    return success(res, 'Dashboard summary retrieved successfully', summary);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSummary,
};
