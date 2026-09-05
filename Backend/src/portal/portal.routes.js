/**
 * Portal Routes
 *
 * Exposes contact portal endpoints.
 * Reference: project.md §5.3 · technicalrequirement.md §6.12
 *
 * Security:
 * - authorize('customer', 'vendor') + requirePortalContact guard asserting req.user.contact_id exists
 * - Rate limiting on pay-intent creation
 * - Webhooks are public and signature-verified
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const portalController = require('./portal.controller');
const { pool } = require('../config/db');
const { error } = require('../utils/response');

const router = express.Router();

/**
 * Guard asserting the caller is a contact portal account linked to an active portal-enabled contact.
 */
async function requirePortalContact(req, res, next) {
  if (!req.user || req.user.role !== 'customer' || !req.user.contact_id) {
    return error(res, 'Access restricted to contact portal accounts', 403);
  }

  try {
    const contactRes = await pool.query(
      `SELECT id, name, contact_type, portal_access_enabled, status
         FROM contacts
        WHERE id = $1 AND organization_id = $2`,
      [req.user.contact_id, req.organizationId]
    );

    const contact = contactRes.rows[0];
    if (!contact || contact.status !== 'active' || !contact.portal_access_enabled) {
      return error(res, 'Contact portal access is inactive or revoked', 403);
    }

    req.contact = contact;
    next();
  } catch (err) {
    next(err);
  }
}

// Rate limiter for payment intent creation
const payIntentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { success: false, message: 'Too many payment requests, please try again later' },
});

// Authenticated portal routes
router.get(
  '/summary',
  authMiddleware.authenticate,
  resolveTenant,
  authMiddleware.authorize('customer', 'vendor'),
  requirePortalContact,
  portalController.getSummary
);

router.get(
  '/invoices',
  authMiddleware.authenticate,
  resolveTenant,
  authMiddleware.authorize('customer', 'vendor'),
  requirePortalContact,
  portalController.listInvoices
);

router.get(
  '/invoices/:id',
  authMiddleware.authenticate,
  resolveTenant,
  authMiddleware.authorize('customer', 'vendor'),
  requirePortalContact,
  portalController.getInvoice
);

router.get(
  '/bills',
  authMiddleware.authenticate,
  resolveTenant,
  authMiddleware.authorize('customer', 'vendor'),
  requirePortalContact,
  portalController.listBills
);

router.post(
  '/invoices/:id/pay-intent',
  payIntentLimiter,
  authMiddleware.authenticate,
  resolveTenant,
  authMiddleware.authorize('customer', 'vendor'),
  requirePortalContact,
  portalController.createPayIntent
);

router.post(
  '/payments/verify',
  authMiddleware.authenticate,
  resolveTenant,
  authMiddleware.authorize('customer', 'vendor'),
  requirePortalContact,
  portalController.verifyPayment
);

// Public webhook route (mounted separately or via router)
router.post('/webhooks/:provider', portalController.handleWebhook);

module.exports = router;
