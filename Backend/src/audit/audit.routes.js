/**
 * Audit Routes
 * Reference: project.md §9.2 · phase.md Phase 13
 */

const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');

// Strict Admin-only access. Managers and users get 403.
router.use(
  authMiddleware.authenticate,
  resolveTenant,
  authMiddleware.authorize('business_owner')
);

router.get('/', auditController.list);
router.get('/:id', auditController.getById);

module.exports = router;
