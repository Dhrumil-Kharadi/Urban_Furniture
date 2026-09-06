const express = require('express');
const rateLimit = require('express-rate-limit');
const { error } = require('../utils/response');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const gatewayController = require('./gateway.controller');

const router = express.Router();

/**
 * Payment Gateway Routes — Razorpay Standard Checkout.
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * NOTHING HERE IS PUBLIC. An unauthenticated create-order endpoint lets anyone
 * on the internet create orders against the merchant account, which is both a
 * billing problem and a way to pollute reconciliation with orders nobody can
 * account for.
 *
 * Roles: 'customer' is the Contact paying their own invoice from the portal
 * (project.md §5.3); admin and manager are included so staff can exercise the
 * flow. project.md §3 keeps Cash/Bank recording away from Contacts — that is
 * Phase 10's payments module, not this one.
 */

/**
 * Order creation reaches a third party and costs money to abuse, so it gets a
 * tighter limiter than the app-wide default.
 */
const orderRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => error(res, 'Too many payment attempts, please try again later.', 429),
});

/**
 * Verification is where a forged signature would be attempted, so brute force
 * is bounded here too — even though a 64-hex-character HMAC is not realistically
 * guessable, an unbounded endpoint is free compute for an attacker.
 */
const verifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => error(res, 'Too many verification attempts, please try again later.', 429),
});

// Public Gateway Endpoints (no auth required for direct customer invoice links)
router.get('/public/config', gatewayController.getConfig);
router.post('/public/create-order', orderRateLimiter, gatewayController.createPublicOrder);
router.post('/public/verify-payment', verifyRateLimiter, gatewayController.verifyPublicPayment);

router.use(authMiddleware.authenticate, resolveTenant);

const PAYING_ROLES = ['customer', 'business_owner', 'accountant'];

router.get('/config', authMiddleware.authorize(...PAYING_ROLES), gatewayController.getConfig);

router.post(
  '/create-order',
  authMiddleware.authorize(...PAYING_ROLES),
  orderRateLimiter,
  gatewayController.createOrder
);

router.post(
  '/verify-payment',
  authMiddleware.authorize(...PAYING_ROLES),
  verifyRateLimiter,
  gatewayController.verifyPayment
);

module.exports = router;
