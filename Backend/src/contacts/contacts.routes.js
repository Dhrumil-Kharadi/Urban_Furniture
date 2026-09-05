const express = require('express');
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const { error } = require('../utils/response');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const { MAX_IMAGE_BYTES, ALLOWED_MIME_TYPES } = require('../shared/imageMagic');
const contactsController = require('./contacts.controller');

const router = express.Router();

/**
 * Contacts Routes
 *
 * Middleware chain on every route, in this order:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * Roles follow project.md §3 as finalised by §10 Decision 1: admin and manager
 * both create and read master data; modify, archive and unarchive are the
 * business owner's alone.
 */

/**
 * Portal provisioning sends mail and mints credentials, so it gets its own,
 * tighter limiter — the generic write path should not be the throttle that
 * protects an outbound mail server.
 */
const portalRateLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs || 15 * 60 * 1000,
  max: env.authRateLimitMax || 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => error(res, 'Too many requests, please try again later.', 429),
});

/** Image uploads are bounded well below the write limiter's allowance. */
const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => error(res, 'Too many uploads, please try again later.', 429),
});

/**
 * Raw body parser for the image endpoint only.
 *
 * The app-wide express.json cap is 10 kB, which is right for JSON and useless
 * for an image, so the larger allowance is scoped to this one route rather
 * than raised globally. Anything above 2 MB is rejected by the parser before a
 * byte reaches the service.
 */
const imageBodyParser = express.raw({
  type: ALLOWED_MIME_TYPES,
  limit: MAX_IMAGE_BYTES,
});

router.use(authMiddleware.authenticate, resolveTenant);

// ─── Read ───────────────────────────────────────────────
router.get('/', authMiddleware.authorize('admin', 'manager'), contactsController.listContacts);
router.get('/:id', authMiddleware.authorize('admin', 'manager'), contactsController.getContact);

// ─── Create — both roles (project.md §3) ────────────────
router.post('/', authMiddleware.authorize('admin', 'manager'), contactsController.createContact);

// ─── Modify / archive — admin only (§10 Decision 1) ─────
router.patch('/:id', authMiddleware.authorize('admin'), contactsController.updateContact);
router.patch('/:id/archive', authMiddleware.authorize('admin'), contactsController.archiveContact);
router.patch('/:id/unarchive', authMiddleware.authorize('admin'), contactsController.unarchiveContact);

// ─── Portal provisioning — admin only ───────────────────
router.post(
  '/:id/portal-access',
  authMiddleware.authorize('admin'),
  portalRateLimiter,
  contactsController.setPortalAccess
);

// ─── Profile image — admin only (it is a modification) ──
router.post(
  '/:id/profile-image',
  authMiddleware.authorize('admin'),
  uploadRateLimiter,
  imageBodyParser,
  contactsController.uploadProfileImage
);

module.exports = router;
