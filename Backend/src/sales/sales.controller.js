const { success, created, error } = require('../utils/response');
const salesValidation = require('./sales.validation');
const salesOrdersService = require('./salesOrders.service');
const customerInvoicesService = require('./customerInvoices.service');

/**
 * Sales Controller
 *
 * Reads the request, validates, delegates, responds. No SQL, no business rules.
 *
 * Every :id reaches the service alongside req.organizationId, which came from
 * the verified session — never from the request.
 */

const salesController = {
  // ─── SALES ORDERS ────────────────────────────────────────

  /** GET /api/sales-orders */
  async listSalesOrders(req, res, next) {
    try {
      const validation = salesValidation.validateListQuery(req.query, 'so');
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await salesOrdersService.listSalesOrders(req.organizationId, {
        ...req.query,
        ...validation.data,
      });
      return success(res, 'Sales orders retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/sales-orders/:id */
  async getSalesOrder(req, res, next) {
    try {
      const salesOrder = await salesOrdersService.getSalesOrderById(
        req.organizationId, req.params.id
      );
      return success(res, 'Sales order retrieved successfully', { salesOrder });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/sales-orders */
  async createSalesOrder(req, res, next) {
    try {
      const validation = salesValidation.validateCreateSalesOrder(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const salesOrder = await salesOrdersService.createSalesOrder(
        req.organizationId, req.user.id, validation.data
      );
      return created(res, 'Sales order created successfully', { salesOrder });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/sales-orders/:id — draft only */
  async updateSalesOrder(req, res, next) {
    try {
      const validation = salesValidation.validateUpdateSalesOrder(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const salesOrder = await salesOrdersService.updateSalesOrder(
        req.organizationId, req.user.id, req.params.id, validation.data
      );
      return success(res, 'Sales order updated successfully', { salesOrder });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/sales-orders/:id/confirm */
  async confirmSalesOrder(req, res, next) {
    try {
      const salesOrder = await salesOrdersService.confirmSalesOrder(
        req.organizationId, req.user.id, req.params.id
      );
      return success(res, 'Sales order confirmed', { salesOrder });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/sales-orders/:id/create-invoice */
  async createInvoiceFromSO(req, res, next) {
    try {
      const validation = salesValidation.validateCreateInvoiceFromSO(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const invoice = await salesOrdersService.createInvoiceFromSO(
        req.organizationId, req.user.id, req.params.id, validation.data
      );
      return created(res, 'Customer invoice created from sales order', { invoice });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/sales-orders/:id/cancel */
  async cancelSalesOrder(req, res, next) {
    try {
      const salesOrder = await salesOrdersService.cancelSalesOrder(
        req.organizationId, req.user.id, req.params.id
      );
      return success(res, 'Sales order cancelled', { salesOrder });
    } catch (err) {
      next(err);
    }
  },

  // ─── CUSTOMER INVOICES ───────────────────────────────────

  /** GET /api/customer-invoices */
  async listCustomerInvoices(req, res, next) {
    try {
      const validation = salesValidation.validateListQuery(req.query, 'invoice');
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await customerInvoicesService.listCustomerInvoices(req.organizationId, {
        ...req.query,
        ...validation.data,
      });
      return success(res, 'Customer invoices retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/customer-invoices/:id */
  async getCustomerInvoice(req, res, next) {
    try {
      const invoice = await customerInvoicesService.getCustomerInvoiceById(
        req.organizationId, req.params.id
      );
      return success(res, 'Customer invoice retrieved successfully', { invoice });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/customer-invoices */
  async createCustomerInvoice(req, res, next) {
    try {
      const validation = salesValidation.validateCreateInvoice(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const invoice = await customerInvoicesService.createCustomerInvoice(
        req.organizationId, req.user.id, validation.data
      );
      return created(res, 'Customer invoice created successfully', { invoice });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/customer-invoices/:id — draft only */
  async updateCustomerInvoice(req, res, next) {
    try {
      const validation = salesValidation.validateUpdateInvoice(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const invoice = await customerInvoicesService.updateCustomerInvoice(
        req.organizationId, req.user.id, req.params.id, validation.data
      );
      return success(res, 'Customer invoice updated successfully', { invoice });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/customer-invoices/:id/post — generates the journal entry */
  async postCustomerInvoice(req, res, next) {
    try {
      const invoice = await customerInvoicesService.postCustomerInvoice(
        req.organizationId, req.user.id, req.params.id
      );
      return success(res, 'Customer invoice posted', { invoice });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/customer-invoices/:id/send */
  async sendCustomerInvoice(req, res, next) {
    try {
      const invoice = await customerInvoicesService.sendCustomerInvoice(
        req.organizationId, req.user.id, req.params.id
      );
      return success(res, 'Customer invoice sent', { invoice });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/customer-invoices/:id/cancel — admin only; reverses if posted */
  async cancelCustomerInvoice(req, res, next) {
    try {
      const invoice = await customerInvoicesService.cancelCustomerInvoice(
        req.organizationId, req.user.id, req.params.id
      );
      return success(res, 'Customer invoice cancelled', { invoice });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = salesController;
