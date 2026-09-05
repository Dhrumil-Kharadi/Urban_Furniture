const express = require('express');
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const { error } = require('../utils/response');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const usersController = require('./users.controller');

const router = express.Router();

// Rate limiter for user invite actions
const inviteRateLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs || 15 * 60 * 1000,
  max: env.authRateLimitMax || 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return error(res, 'Too many requests, please try again later.', 429);
  },
});

// All routes require authentication, tenant resolution, and admin authorization
router.use(
  authMiddleware.authenticate,
  resolveTenant,
  authMiddleware.authorize('admin')
);

// GET /api/users - List org users
router.get('/', usersController.listUsers);

// POST /api/users/invite - Invite Accountant (role='manager')
router.post('/invite', inviteRateLimiter, usersController.inviteUser);

// PATCH /api/users/:id/status - Activate/deactivate user
router.patch('/:id/status', usersController.updateStatus);

module.exports = router;
