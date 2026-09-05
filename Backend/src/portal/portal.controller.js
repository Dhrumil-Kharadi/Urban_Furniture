/**
 * Portal Controller
 *
 * Handles HTTP requests for contact portal endpoints.
 * Reference: project.md §5.3 · technicalrequirement.md §6.12
 */

const portalService = require('./portal.service');
const portalValidation = require('./portal.validation');
const { success, error } = require('../utils/response');

const portalController = {
  async getSummary(req, res, next) {
    try {
      const result = await portalService.getSummary(
        req.organizationId,
        req.user.contact_id,
        req.contact?.contact_type || 'customer'
      );
      return success(res, 'Portal summary retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  async listInvoices(req, res, next) {
    try {
      // Vendor cannot view customer invoice list
      if (req.contact && req.contact.contact_type === 'vendor') {
        return error(res, 'Vendors cannot access customer invoices', 403);
      }

      const validation = portalValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await portalService.listInvoices(
        req.organizationId,
        req.user.contact_id,
        req.query
      );
      return success(res, 'Invoices retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  async getInvoice(req, res, next) {
    try {
      if (req.contact && req.contact.contact_type === 'vendor') {
        return error(res, 'Vendors cannot access customer invoices', 403);
      }

      const result = await portalService.getInvoiceDetail(
        req.organizationId,
        req.user.contact_id,
        req.params.id
      );
      return success(res, 'Invoice details retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  async listBills(req, res, next) {
    try {
      // Customer cannot view vendor bills list
      if (req.contact && req.contact.contact_type === 'customer') {
        return error(res, 'Customers cannot access vendor bills', 403);
      }

      const validation = portalValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await portalService.listBills(
        req.organizationId,
        req.user.contact_id,
        req.query
      );
      return success(res, 'Bills statement retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  async createPayIntent(req, res, next) {
    try {
      // Strict rule project.md §5.3.7: "A VENDOR CALLING pay-intent GETS 403. The organization pays vendors, not the reverse."
      if (req.contact && req.contact.contact_type === 'vendor') {
        return error(res, 'Vendors cannot create payment intents', 403);
      }

      const validation = portalValidation.validatePayIntent(req.params);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const orderData = await portalService.createPayIntent(
        req.organizationId,
        req.user.contact_id,
        validation.data.invoiceId
      );
      return success(res, 'Payment intent created successfully', orderData);
    } catch (err) {
      next(err);
    }
  },

  async verifyPayment(req, res, next) {
    try {
      if (req.contact && req.contact.contact_type === 'vendor') {
        return error(res, 'Vendors cannot verify customer payments', 403);
      }

      const validation = portalValidation.validateVerifyPayment(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await portalService.verifyPayment(
        req.organizationId,
        req.user.contact_id,
        validation.data,
        req.user.id
      );
      return success(res, 'Payment processed successfully', result);
    } catch (err) {
      next(err);
    }
  },

  async handleWebhook(req, res, next) {
    try {
      const { provider } = req.params;
      const signature = req.headers['x-razorpay-signature'] || req.headers['stripe-signature'];
      const rawPayload = req.body;

      const result = await portalService.handleWebhook(
        provider,
        typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload),
        signature
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = portalController;
