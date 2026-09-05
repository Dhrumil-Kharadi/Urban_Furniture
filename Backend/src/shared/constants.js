'use strict';

/**
 * constants.js — single source of truth for every system enum.
 *
 * Rules:
 *  1. Never define a status/role/type string anywhere else in the codebase.
 *  2. Import what you need: const { ROLES, DOC_TYPES } = require('../shared/constants');
 *  3. Add new values here first, then reference them everywhere else.
 */

// ─── User / Auth ──────────────────────────────────────────────────────────────

/** Maps to the `role` column on the `users` table. */
const ROLES = Object.freeze({
  ADMIN: 'admin',       // full access; manages org settings
  MANAGER: 'manager',   // accountant; create-only master data
  USER: 'user',         // contact-provisioned login; view-only
});

/** Values accepted by the `status` column on `users`. */
const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
});

// ─── Organisation ─────────────────────────────────────────────────────────────

const ORG_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

/** ISO 4217 currency codes accepted by this system (INR only per Phase 0). */
const CURRENCIES = Object.freeze(['INR']);

// ─── Chart of Accounts ───────────────────────────────────────────────────────

/** Top-level account categories (technicalrequirement.md §3.3). */
const ACCOUNT_TYPES = Object.freeze({
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  INCOME: 'income',
  EXPENSE: 'expense',
});

const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

// ─── Tax ─────────────────────────────────────────────────────────────────────

/** Which transactions a tax rate applies to (both = sales AND purchases). */
const TAX_SCOPE = Object.freeze({
  SALES: 'sales',
  PURCHASES: 'purchases',
  BOTH: 'both',
});

const TAX_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

// ─── Contacts ────────────────────────────────────────────────────────────────

/** Contact classification (customer, supplier, or both). */
const CONTACT_TYPE = Object.freeze({
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
  BOTH: 'both',
});

const CONTACT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

// ─── Documents ───────────────────────────────────────────────────────────────

/**
 * Document types used by the sequence service.
 * The prefix must match the format defined in technicalrequirement.md §3.5.
 */
const DOC_TYPES = Object.freeze({
  SALES_INVOICE: 'SI',
  PURCHASE_INVOICE: 'PI',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE: 'DN',
  JOURNAL_ENTRY: 'JE',
  PAYMENT: 'PMT',
  RECEIPT: 'RCP',
});

/** Invoice / transaction statuses. */
const DOC_STATUS = Object.freeze({
  DRAFT: 'draft',
  POSTED: 'posted',
  CANCELLED: 'cancelled',
  PAID: 'paid',
  PARTIAL: 'partial',
  OVERDUE: 'overdue',
});

// ─── Journal / Ledger ─────────────────────────────────────────────────────────

const ENTRY_TYPE = Object.freeze({
  DEBIT: 'debit',
  CREDIT: 'credit',
});

// ─── Pagination defaults ──────────────────────────────────────────────────────

const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

// ─── Audit ───────────────────────────────────────────────────────────────────

const AUDIT_ACTIONS = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
});

module.exports = {
  ROLES,
  USER_STATUS,
  ORG_STATUS,
  CURRENCIES,
  ACCOUNT_TYPES,
  ACCOUNT_STATUS,
  TAX_SCOPE,
  TAX_STATUS,
  CONTACT_TYPE,
  CONTACT_STATUS,
  DOC_TYPES,
  DOC_STATUS,
  ENTRY_TYPE,
  PAGINATION,
  AUDIT_ACTIONS,
};
