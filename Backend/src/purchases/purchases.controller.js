/**
 * Purchases Controller
 *
 * HTTP handlers for Purchase Order and Vendor Bill endpoints.
 * Delegates business logic to purchaseOrders.service and vendorBills.service.
 */

const { success, created, error } = require('../utils/response');
const purchaseOrdersService = require('./purchaseOrders.service');
const vendorBillsService = require('./vendorBills.service');
const purchasesValidation = require('./purchases.validation');
const logger = require('../utils/logger');

const purchasesController = {
  // ─── PURCHASE ORDERS ─────────────────────────────────────

  async listPurchaseOrders(req, res, next) {
    try {
      const result = await purchaseOrdersService.listPurchaseOrders(
        req.organizationId,
        req.query
      );
      return success(res, 'Purchase orders retrieved', result);
    } catch (err) {
      next(err);
    }
  },

  async getPurchaseOrder(req, res, next) {
    try {
      const po = await purchaseOrdersService.getPurchaseOrderById(
        req.organizationId,
        req.params.id
      );
      return success(res, 'Purchase order retrieved', po);
    } catch (err) {
      next(err);
    }
  },

  async createPurchaseOrder(req, res, next) {
    try {
      const validationErrors = purchasesValidation.validateCreatePO(req.body);
      if (validationErrors) {
        return error(res, 'Validation failed', 400, validationErrors);
      }

      const po = await purchaseOrdersService.createPurchaseOrder(
        req.organizationId,
        req.user.id,
        req.body
      );
      return created(res, 'Purchase order created', po);
    } catch (err) {
      next(err);
    }
  },

  async updatePurchaseOrder(req, res, next) {
    try {
      const validationErrors = purchasesValidation.validateUpdatePO(req.body);
      if (validationErrors) {
        return error(res, 'Validation failed', 400, validationErrors);
      }

      const po = await purchaseOrdersService.updatePurchaseOrder(
        req.organizationId,
        req.user.id,
        req.params.id,
        req.body
      );
      return success(res, 'Purchase order updated', po);
    } catch (err) {
      next(err);
    }
  },

  async confirmPurchaseOrder(req, res, next) {
    try {
      const po = await purchaseOrdersService.confirmPurchaseOrder(
        req.organizationId,
        req.user.id,
        req.params.id
      );
      return success(res, 'Purchase order confirmed', po);
    } catch (err) {
      next(err);
    }
  },

  async createBillFromPO(req, res, next) {
    try {
      const { journal_id } = req.body;
      if (!journal_id) {
        return error(res, 'journal_id is required', 400);
      }

      const bill = await purchaseOrdersService.createBillFromPO(
        req.organizationId,
        req.user.id,
        req.params.id,
        journal_id
      );
      return created(res, 'Vendor bill created from purchase order', bill);
    } catch (err) {
      next(err);
    }
  },

  async cancelPurchaseOrder(req, res, next) {
    try {
      const po = await purchaseOrdersService.cancelPurchaseOrder(
        req.organizationId,
        req.user.id,
        req.params.id
      );
      return success(res, 'Purchase order cancelled', po);
    } catch (err) {
      next(err);
    }
  },

  // ─── VENDOR BILLS ────────────────────────────────────────

  async listVendorBills(req, res, next) {
    try {
      const result = await vendorBillsService.listVendorBills(
        req.organizationId,
        req.query
      );
      return success(res, 'Vendor bills retrieved', result);
    } catch (err) {
      next(err);
    }
  },

  async getVendorBill(req, res, next) {
    try {
      const bill = await vendorBillsService.getVendorBillById(
        req.organizationId,
        req.params.id
      );
      return success(res, 'Vendor bill retrieved', bill);
    } catch (err) {
      next(err);
    }
  },

  async createVendorBill(req, res, next) {
    try {
      const validationErrors = purchasesValidation.validateCreateBill(req.body);
      if (validationErrors) {
        return error(res, 'Validation failed', 400, validationErrors);
      }

      const bill = await vendorBillsService.createVendorBill(
        req.organizationId,
        req.user.id,
        req.body
      );
      return created(res, 'Vendor bill created', bill);
    } catch (err) {
      next(err);
    }
  },

  async updateVendorBill(req, res, next) {
    try {
      const validationErrors = purchasesValidation.validateUpdateBill(req.body);
      if (validationErrors) {
        return error(res, 'Validation failed', 400, validationErrors);
      }

      const bill = await vendorBillsService.updateVendorBill(
        req.organizationId,
        req.user.id,
        req.params.id,
        req.body
      );
      return success(res, 'Vendor bill updated', bill);
    } catch (err) {
      next(err);
    }
  },

  async postVendorBill(req, res, next) {
    try {
      const bill = await vendorBillsService.postVendorBill(
        req.organizationId,
        req.user.id,
        req.params.id
      );
      return success(res, 'Vendor bill posted and journal entry created', bill);
    } catch (err) {
      next(err);
    }
  },

  async cancelVendorBill(req, res, next) {
    try {
      const bill = await vendorBillsService.cancelVendorBill(
        req.organizationId,
        req.user.id,
        req.params.id
      );
      return success(res, 'Vendor bill cancelled', bill);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = purchasesController;
