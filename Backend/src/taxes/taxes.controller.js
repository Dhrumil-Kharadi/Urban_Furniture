'use strict';

const taxesService = require('./taxes.service');
const { validateCreateTax, validateUpdateTax } = require('./taxes.validation');
const { success, created, error } = require('../utils/response');

/**
 * List taxes.
 */
async function listTaxes(req, res, next) {
  try {
    const orgId = req.organizationId;
    const result = await taxesService.listTaxes(orgId, req.query);
    return success(res, 'Taxes retrieved successfully', result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get single tax by ID.
 */
async function getTaxById(req, res, next) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;
    const tax = await taxesService.getTaxById(orgId, id);
    return success(res, 'Tax retrieved successfully', tax);
  } catch (err) {
    next(err);
  }
}

/**
 * Create new tax.
 */
async function createTax(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;

    const validation = validateCreateTax(req.body);
    if (!validation.isValid) {
      return error(res, validation.errors[0] || 'Validation failed', 400, validation.errors);
    }

    const tax = await taxesService.createTax(orgId, userId, validation.data);
    return created(res, 'Tax created successfully', tax);
  } catch (err) {
    next(err);
  }
}

/**
 * Update tax.
 */
async function updateTax(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const validation = validateUpdateTax(req.body);
    if (!validation.isValid) {
      return error(res, validation.errors[0] || 'Validation failed', 400, validation.errors);
    }

    const updated = await taxesService.updateTax(orgId, id, userId, validation.data);
    return success(res, 'Tax updated successfully', updated);
  } catch (err) {
    next(err);
  }
}

/**
 * Archive tax.
 */
async function archiveTax(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const archived = await taxesService.archiveTax(orgId, id, userId);
    return success(res, 'Tax archived successfully', archived);
  } catch (err) {
    next(err);
  }
}

/**
 * Unarchive tax.
 */
async function unarchiveTax(req, res, next) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const unarchived = await taxesService.unarchiveTax(orgId, id, userId);
    return success(res, 'Tax unarchived successfully', unarchived);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTaxes,
  getTaxById,
  createTax,
  updateTax,
  archiveTax,
  unarchiveTax,
};
