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

/**
 * Top-level account categories.
 *
 * project.md §4.3 names five: Asset / Liability / Expense / Income / Capital.
 * The stored value is 'capital', matching the CHECK constraint that migration
 * 008 already put on accounts.account_type — not 'equity'.
 */
const ACCOUNT_TYPES = Object.freeze({
  ASSET: 'asset',
  LIABILITY: 'liability',
  EXPENSE: 'expense',
  INCOME: 'income',
  CAPITAL: 'capital',
});

/** Master data is archived, never deleted (project.md §9.6). */
const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

/** Journal classification (project.md §4.4). */
const JOURNAL_TYPES = Object.freeze({
  SALES: 'sales',
  PURCHASE: 'purchase',
  BANK: 'bank',
  CASH: 'cash',
  GENERAL: 'general',
});

const JOURNAL_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

/** Analytic account classification (project.md §4.6). */
const ANALYTIC_TYPES = Object.freeze({
  INCOME: 'income',
  EXPENSE: 'expense',
});

const ANALYTIC_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

// ─── Tax ─────────────────────────────────────────────────────────────────────

/**
 * Which transactions a tax rate applies to.
 *
 * Phase 0 Decision 4 puts tax on both sides, so 'both' is the default. The
 * singular 'purchase' matches the CHECK constraint on taxes.tax_scope.
 */
const TAX_SCOPE = Object.freeze({
  SALES: 'sales',
  PURCHASE: 'purchase',
  BOTH: 'both',
});

const TAX_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

// ─── Contacts ────────────────────────────────────────────────────────────────

/**
 * Contact classification (project.md §4.1: Customer / Vendor / Both).
 * The spec says "vendor" throughout, so the stored value is 'vendor'.
 */
const CONTACT_TYPE = Object.freeze({
  CUSTOMER: 'customer',
  VENDOR: 'vendor',
  BOTH: 'both',
});

/**
 * Master-data lifecycle. project.md §9.6 forbids deleting a record that has
 * transactions, so 'archived' — not 'deleted', not 'inactive' — is the
 * terminal state for every master-data table.
 */
const CONTACT_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

// ─── Products ──────────────────────────────────────────────────────

/**
 * Product classification (project.md §4.2: Goods / Service / Combo).
 * 'combo' is a LABEL ONLY in v1 — there is no components table and no line
 * explosion on order. See AMBIGUITY A4.
 */
const PRODUCT_TYPE = Object.freeze({
  GOODS: 'goods',
  SERVICE: 'service',
  COMBO: 'combo',
});

const PRODUCT_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

const PRODUCT_CATEGORY_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
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
  JOURNAL_TYPES,
  JOURNAL_STATUS,
  ANALYTIC_TYPES,
  ANALYTIC_STATUS,
  TAX_SCOPE,
  TAX_STATUS,
  CONTACT_TYPE,
  CONTACT_STATUS,
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  PRODUCT_CATEGORY_STATUS,
  DOC_TYPES,
  DOC_STATUS,
  ENTRY_TYPE,
  PAGINATION,
  AUDIT_ACTIONS,
};
