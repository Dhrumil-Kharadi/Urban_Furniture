/**
 * Dashboard Routes
 *
 * GET /api/dashboard/summary?period=
 * Technical recommendation: unified summary in one request.
 * Reference: project.md §9 · phase.md Phase 13
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const dashboardController = require('./dashboard.controller');

router.use(authMiddleware.authenticate, resolveTenant);

router.get(
  '/summary',
  authMiddleware.authorize('business_owner', 'accountant', 'customer', 'vendor'),
  dashboardController.getSummary
);

module.exports = router;
