/**
 * Notifications Routes
 * Reference: project.md §9.7 · phase.md Phase 13
 */

const express = require('express');
const router = express.Router();
const notificationsController = require('./notifications.controller');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');

router.use(authMiddleware.authenticate, resolveTenant);

// List notifications (Admin only)
router.get('/', authMiddleware.authorize('business_owner'), notificationsController.list);

// Retry pending/failed notifications (Admin only)
router.post('/retry', authMiddleware.authorize('business_owner'), notificationsController.retry);

module.exports = router;
