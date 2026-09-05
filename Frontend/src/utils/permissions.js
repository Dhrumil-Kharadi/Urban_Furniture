/**
 * utils/permissions.js
 * Client-side UI role matrix mirror for conditional rendering.
 * TECHNICAL REQUIREMENT: This is a UX layer optimization only.
 * The backend authorize() middleware remains the actual security boundary.
 *
 * Roles:
 *   admin       — Full access (Master data CRUD, Transactions, Reports, Users, Org Settings)
 *   manager     — Accountant (Master data Create/Read ONLY, Transactions CRUD, Reports, NO Users/Settings)
 *   user        — Contact (Portal ONLY: own Invoices, Bills, Payments)
 *   super_admin — Platform operator
 */

export const MODULE_PERMISSIONS = {
  // Master data
  contacts: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin'],
    archive: ['admin'],
  },
  products: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin'],
    archive: ['admin'],
  },
  accounts: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin'],
    archive: ['admin'],
  },
  journals: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin'],
    archive: ['admin'],
  },
  taxes: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin'],
    archive: ['admin'],
  },
  analyticAccounts: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin'],
    archive: ['admin'],
  },
  // Transactions & Financials
  purchaseOrders: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin', 'manager'],
    post: ['admin', 'manager'],
    cancel: ['admin', 'manager'],
  },
  vendorBills: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin', 'manager'],
    post: ['admin', 'manager'],
    cancel: ['admin', 'manager'],
  },
  salesOrders: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin', 'manager'],
    post: ['admin', 'manager'],
    cancel: ['admin', 'manager'],
  },
  customerInvoices: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin', 'manager'],
    post: ['admin', 'manager'],
    cancel: ['admin', 'manager'],
  },
  journalEntries: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin', 'manager'],
    post: ['admin', 'manager'],
    reverse: ['admin', 'manager'],
  },
  payments: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin', 'manager'],
    post: ['admin', 'manager'],
  },
  budgets: {
    view: ['admin', 'manager'],
    create: ['admin', 'manager'],
    edit: ['admin', 'manager'],
  },
  reports: {
    view: ['admin', 'manager'],
  },
  // Platform & Team Admin
  users: {
    view: ['admin'],
    create: ['admin'],
    edit: ['admin'],
    deactivate: ['admin'],
  },
  settings: {
    view: ['admin'],
    edit: ['admin'],
  },
  // Contact Portal
  portal: {
    view: ['user'],
    pay: ['user'],
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
  if (role === 'super_admin') return true;

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
