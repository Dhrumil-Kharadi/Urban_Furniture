/**
 * utils/permissions.js
 * Client-side UI role matrix mirror for conditional rendering.
 * TECHNICAL REQUIREMENT: This is a UX layer optimization only.
 * The backend authorize() middleware remains the actual security boundary.
 *
 * Roles:
 *   business_owner — Full access (Master data CRUD, Transactions, Reports, Users, Org Settings)
 *   accountant     — Accountant (Master data Create/Read ONLY, Transactions CRUD, Reports, NO Users/Settings)
 *   customer       — Customer Contact (Portal ONLY: own Invoices, Payments)
 *   vendor         — Vendor Contact (Portal ONLY: own Bills)
 */

export const MODULE_PERMISSIONS = {
  // Master data
  contacts: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner'],
    archive: ['business_owner'],
  },
  products: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner'],
    archive: ['business_owner'],
  },
  accounts: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner'],
    archive: ['business_owner'],
  },
  journals: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner'],
    archive: ['business_owner'],
  },
  taxes: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner'],
    archive: ['business_owner'],
  },
  analyticAccounts: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner'],
    archive: ['business_owner'],
  },
  // Transactions & Financials
  purchaseOrders: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner', 'accountant'],
    post: ['business_owner', 'accountant'],
    cancel: ['business_owner', 'accountant'],
  },
  vendorBills: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner', 'accountant'],
    post: ['business_owner', 'accountant'],
    cancel: ['business_owner', 'accountant'],
  },
  salesOrders: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner', 'accountant'],
    post: ['business_owner', 'accountant'],
    cancel: ['business_owner', 'accountant'],
  },
  customerInvoices: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner', 'accountant'],
    post: ['business_owner', 'accountant'],
    cancel: ['business_owner', 'accountant'],
  },
  journalEntries: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner', 'accountant'],
    post: ['business_owner', 'accountant'],
    reverse: ['business_owner', 'accountant'],
  },
  payments: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner', 'accountant'],
    post: ['business_owner', 'accountant'],
  },
  budgets: {
    view: ['business_owner', 'accountant'],
    create: ['business_owner', 'accountant'],
    edit: ['business_owner', 'accountant'],
  },
  reports: {
    view: ['business_owner', 'accountant'],
  },
  // Platform & Team Admin
  users: {
    view: ['business_owner'],
    create: ['business_owner'],
    edit: ['business_owner'],
    deactivate: ['business_owner'],
  },
  settings: {
    view: ['business_owner'],
    edit: ['business_owner'],
  },
  // Contact Portal
  portal: {
    view: ['customer', 'vendor'],
    pay: ['customer', 'vendor'],
  },
};

/**
 * Checks if a given role can access a module feature.
 *
 * @param {string} module
 * @param {string} role
 * @param {string} [action='view']
 * @returns {boolean}
 */
export function canAccess(module, role, action = 'view') {
  if (!role || !module) return false;

  const rules = MODULE_PERMISSIONS[module];
  if (!rules) return false;

  const allowedRoles = rules[action] || rules.view;
  return Array.isArray(allowedRoles) && allowedRoles.includes(role);
}

/**
 * Checks if a given role has create permissions on master data.
 *
 * @param {string} module
 * @param {string} role
 * @returns {boolean}
 */
export function canCreate(module, role) {
  return canAccess(module, role, 'create');
}

/**
 * Checks if a given role has modification permissions.
 * Manager has Create-Only rights on master data; Admin has full edit/archive rights.
 *
 * @param {string} module
 * @param {string} role
 * @returns {boolean}
 */
export function canModify(module, role) {
  return canAccess(module, role, 'edit');
}
