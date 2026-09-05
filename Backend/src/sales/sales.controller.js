/**
 * Sales Controller
 *
 * HTTP handlers for Sales Order and Customer Invoice endpoints.
 * Delegates business logic to salesOrders.service and customerInvoices.service.
 */

const { success, created, error } = require('../utils/response');
const salesOrdersService = require('./salesOrders.service');
const customerInvoicesService = require('./customerInvoices.service');
const salesValidation = require('./sales.validation');
const logger = require('../utils/logger');

const salesController = {
  // ─── SALES ORDERS ─────────────────────────────────────────

  async listSalesOrders(req, res, next) {
    try {
      const result = await salesOrdersService.listSalesOrders(
        req.organizationId,
        req.query
      );
      return success(res, 'Sales orders retrieved', result);
    } catch (err) {
      next(err);
    }
  },

  async getSalesOrder(req, res, next) {
    try {
      const so = await salesOrdersService.getSalesOrderById(
        req.organizationId,
        req.params.id
      );
      return success(res, 'Sales order retrieved', so);
    } catch (err) {
      next(err);
    }
  },

  async createSalesOrder(req, res, next) {
    try {
      const validationErrors = salesValidation.validateCreateSO(req.body);
      if (validationErrors) {
        return error(res, 'Validation failed', 400, validationErrors);
      }

      const so = await salesOrdersService.createSalesOrder(
        req.organizationId,
        req.user.id,
        req.body
      );
      return created(res, 'Sales order created', so);
    } catch (err) {
      next(err);
    }
  },

  async updateSalesOrder(req, res, next) {
    try {
      const validationErrors = salesValidation.validateUpdateSO(req.body);
      if (validationErrors) {
        return error(res, 'Validation failed', 400, validationErrors);
      }

      const so = await salesOrdersService.updateSalesOrder(
        req.organizationId,
        req.user.id,
        req.params.id,
        req.body
      );
      return success(res, 'Sales order updated', so);
    } catch (err) {
      next(err);
    }
  },

  async confirmSalesOrder(req, res, next) {
    try {
      const so = await salesOrdersService.confirmSalesOrder(
        req.organizationId,
        req.user.id,
        req.params.id
      );
      return success(res, 'Sales order confirmed', so);
    } catch (err) {
      next(err);
    }
  },

  async createInvoiceFromSO(req, res, next) {
    try {
      const { journal_id } = req.body;
      const invoice = await salesOrdersService.createInvoiceFromSO(
        req.organizationId,
        req.user.id,
        req.params.id,
        journal_id || null
      );
      return created(res, 'Customer invoice created from sales order', invoice);
    } catch (err) {
      next(err);
    }
  },

  async cancelSalesOrder(req, res, next) {
    try {
      const so = await salesOrdersService.cancelSalesOrder(
        req.organizationId,
        req.user.id,
        req.params.id
      );
      return success(res, 'Sales order cancelled', so);
    } catch (err) {
      next(err);
    }
  },

  // ─── CUSTOMER INVOICES ───────────────────────────────────

  async listCustomerInvoices(req, res, next) {
    try {
      const result = await customerInvoicesService.listCustomerInvoices(
        req.organizationId,
        req.query
      );
      return success(res, 'Customer invoices retrieved', result);
    } catch (err) {
      next(err);
    }
  },

  async getCustomerInvoice(req, res, next) {
    try {
      const invoice = await customerInvoicesService.getCustomerInvoiceById(
        req.organizationId,
        req.params.id
      );
      return success(res, 'Customer invoice retrieved', invoice);
    } catch (err) {
      next(err);
    }
  },

  async createCustomerInvoice(req, res, next) {
    try {
      const validationErrors = salesValidation.validateCreateInvoice(req.body);
      if (validationErrors) {
        return error(res, 'Validation failed', 400, validationErrors);
      }

      const invoice = await customerInvoicesService.createCustomerInvoice(
        req.organizationId,
        req.user.id,
        req.body
      );
      return created(res, 'Customer invoice created', invoice);
    } catch (err) {
      next(err);
    }
  },

  async updateCustomerInvoice(req, res, next) {
    try {
      const validationErrors = salesValidation.validateUpdateInvoice(req.body);
      if (validationErrors) {
        return error(res, 'Validation failed', 400, validationErrors);
      }

      const invoice = await customerInvoicesService.updateCustomerInvoice(
        req.organizationId,
        req.user.id,
        req.params.id,
        req.body
      );
      return success(res, 'Customer invoice updated', invoice);
    } catch (err) {
      next(err);
    }
  },

  async postCustomerInvoice(req, res, next) {
    try {
      const result = await customerInvoicesService.postCustomerInvoice(
        req.organizationId,
        req.user.id,
        req.params.id
      );
      return success(res, 'Invoice posted', result);
    } catch (err) {
      next(err);
    }
  },

  async sendCustomerInvoice(req, res, next) {
    try {
      const result = await customerInvoicesService.sendCustomerInvoice(
        req.organizationId,
        req.user.id,
        req.params.id
      );
      return success(res, result.message, result);
    } catch (err) {
      next(err);
    }
  },

  async cancelCustomerInvoice(req, res, next) {
    try {
      const invoice = await customerInvoicesService.cancelCustomerInvoice(
        req.organizationId,
        req.user.id,
        req.params.id
      );
      return success(res, 'Customer invoice cancelled', invoice);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = salesController;
