'use strict';

const taxesRepository = require('./taxes.repository');
const accountsRepository = require('../accounts/accounts.repository');
const AppError = require('../shared/AppError');
const { parse } = require('../shared/pagination');
const { recordAudit } = require('../shared/audit.service');
const { AUDIT_ACTIONS } = require('../shared/constants');

/**
 * Validate that an account exists, belongs to same org, is active, and matches expected classification.
 */
async function validateTaxAccount(orgId, accountId, expectedType, fieldLabel) {
  if (!accountId) return;
  const acc = await accountsRepository.findAccountById(null, orgId, accountId);
  if (!acc) {
    throw new AppError(`${fieldLabel} does not exist in this organization`, 404, 'ACCOUNT_NOT_FOUND');
  }
  if (acc.status === 'archived') {
    throw new AppError(`Cannot assign archived account as ${fieldLabel}`, 400, 'ACCOUNT_ARCHIVED');
  }
  if (acc.account_type !== expectedType) {
    throw new AppError(
      `${fieldLabel} must have account classification "${expectedType}" (got "${acc.account_type}")`,
      400,
      'INVALID_TAX_ACCOUNT_TYPE'
    );
  }
}

/**
 * Create a new tax rate.
 */
async function createTax(orgId, userId, data) {
  // Check duplicate name
  const existingName = await taxesRepository.findTaxByName(null, orgId, data.name);
  if (existingName) {
    throw new AppError(`Tax rate "${data.name}" already exists in this organization`, 409, 'DUPLICATE_TAX_NAME');
  }

  // Validate tax accounts: Output tax = Liability, Input tax = Asset
  if (data.collected_account_id) {
    await validateTaxAccount(orgId, data.collected_account_id, 'liability', 'Collected tax account (Output Tax)');
  }
  if (data.paid_account_id) {
    await validateTaxAccount(orgId, data.paid_account_id, 'asset', 'Paid tax account (Input Tax)');
  }

  const tax = await taxesRepository.createTax(null, orgId, userId, data);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.CREATE,
    entityType: 'taxes',
    entityId: tax.id,
    before: null,
    after: tax,
  }).catch(() => {});

  return tax;
}

/**
 * Get tax rate by ID.
 */
async function getTaxById(orgId, id) {
  const tax = await taxesRepository.findTaxById(null, orgId, id);
  if (!tax) {
    throw new AppError('Tax rate not found', 404, 'TAX_NOT_FOUND');
  }
  return tax;
}

/**
 * List taxes with pagination and filters.
 */
async function listTaxes(orgId, query = {}) {
  const { page, limit, offset } = parse(query);
  return taxesRepository.listTaxes(null, orgId, {
    page,
    limit,
    offset,
    search: query.search,
    status: query.status,
    taxScope: query.tax_scope || query.taxScope,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });
}

/**
 * Update an existing tax.
 */
async function updateTax(orgId, id, userId, data) {
  const existing = await taxesRepository.findTaxById(null, orgId, id);
  if (!existing) {
    throw new AppError('Tax rate not found', 404, 'TAX_NOT_FOUND');
  }

  if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
    const conflict = await taxesRepository.findTaxByName(null, orgId, data.name);
    if (conflict && conflict.id !== id) {
      throw new AppError(`Tax rate "${data.name}" already exists in this organization`, 409, 'DUPLICATE_TAX_NAME');
    }
  }

  if (data.collected_account_id) {
    await validateTaxAccount(orgId, data.collected_account_id, 'liability', 'Collected tax account (Output Tax)');
  }
  if (data.paid_account_id) {
    await validateTaxAccount(orgId, data.paid_account_id, 'asset', 'Paid tax account (Input Tax)');
  }

  const updated = await taxesRepository.updateTax(null, orgId, id, userId, data);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'taxes',
    entityId: id,
    before: existing,
    after: updated,
  }).catch(() => {});

  return updated;
}

/**
 * Archive a tax rate.
 */
async function archiveTax(orgId, id, userId) {
  const existing = await taxesRepository.findTaxById(null, orgId, id);
  if (!existing) {
    throw new AppError('Tax rate not found', 404, 'TAX_NOT_FOUND');
  }

  if (existing.status === 'archived') {
    return existing;
  }

  const blocker = await taxesRepository.checkTaxBlockers(null, orgId, id);
  if (blocker) {
    throw new AppError(`Cannot archive tax: ${blocker}`, 409, 'TAX_ARCHIVE_BLOCKED');
  }

  const archived = await taxesRepository.archiveTax(null, orgId, id, userId);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'taxes',
    entityId: id,
    before: existing,
    after: archived,
  }).catch(() => {});

  return archived;
}

/**
 * Unarchive a tax rate.
 */
async function unarchiveTax(orgId, id, userId) {
  const existing = await taxesRepository.findTaxById(null, orgId, id);
  if (!existing) {
    throw new AppError('Tax rate not found', 404, 'TAX_NOT_FOUND');
  }

  if (existing.status === 'active') {
    return existing;
  }

  const unarchived = await taxesRepository.unarchiveTax(null, orgId, id, userId);

  await recordAudit(null, {
    actorUserId: userId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'taxes',
    entityId: id,
    before: existing,
    after: unarchived,
  }).catch(() => {});

  return unarchived;
}

module.exports = {
  createTax,
  getTaxById,
  listTaxes,
  updateTax,
  archiveTax,
  unarchiveTax,
};
