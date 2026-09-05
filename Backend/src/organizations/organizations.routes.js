const express = require('express');
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const { error } = require('../utils/response');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const organizationsController = require('./organizations.controller');

const router = express.Router();

/**
 * Standard rate limiter for organizations routes
 */
const orgRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs || 15 * 60 * 1000,
  max: env.rateLimitMax || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return error(res, 'Too many requests, please try again later.', 429);
  },
});

router.use(orgRateLimiter);

/**
 * GET /api/organizations/current
 * Access: admin, manager
 * Returns current tenant organization details
 */
router.get(
  '/current',
  authMiddleware.authenticate,
  resolveTenant,
  authMiddleware.authorize('admin', 'manager'),
  organizationsController.getCurrent
);

/**
 * PATCH /api/organizations/current
 * Access: admin only
 * Updates organization settings (name, currency, fiscal_year_start_month)
 */
router.patch(
  '/current',
  authMiddleware.authenticate,
  resolveTenant,
  authMiddleware.authorize('admin'),
  organizationsController.updateCurrent
);

module.exports = router;
