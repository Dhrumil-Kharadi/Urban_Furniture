// ============================================================
// FILE: src/services/masterdata.service.js
//
// One place that knows how a master-data collection talks to the API, so
// contacts, products and categories do not each grow their own dialect.
//
// Every collection endpoint shares the same contract:
//   GET  /api/<resource>?page&limit&search&status&sortBy&sortOrder
//     -> { items, pagination: { page, limit, total, totalPages, hasNext, hasPrev } }
//
// The factory below turns that contract into a small object of calls. A
// resource with an extra endpoint (contacts have portal access and an image
// upload) composes on top rather than reimplementing the common five.
// ============================================================

import api, { apiUpload } from '@/lib/api';

/**
 * Build a query string from a params object, dropping empty values so the URL
 * stays readable and two equivalent filter states produce one cache key.
 *
 * @param {object} params
 * @returns {string} e.g. '?page=2&search=chair'
 */
export function toQueryString(params = {}) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }

  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Create the standard call set for one master-data resource.
 *
 * @param {string} resource - API path segment, e.g. 'contacts'.
 * @param {string} itemKey  - Key the API wraps a single record in, e.g. 'contact'.
 * @returns {object} { list, get, create, update, archive, unarchive }
 */
export function createResourceService(resource, itemKey) {
  return {
    /**
     * @param {object} params - page, limit, search, status, sortBy, sortOrder, …
     * @param {AbortSignal} [signal]
     * @returns {Promise<{ items: Array, pagination: object }>}
     */
    async list(params, signal) {
      const res = await api.get(`/${resource}${toQueryString(params)}`, { signal });
      return res.data;
    },

    /**
     * @param {string} id
     * @param {AbortSignal} [signal]
     * @returns {Promise<object>}
     */
    async get(id, signal) {
      const res = await api.get(`/${resource}/${id}`, { signal });
      return res.data[itemKey];
    },

    /**
     * @param {object} payload
     * @returns {Promise<object>}
     */
    async create(payload) {
      const res = await api.post(`/${resource}`, payload);
      return res.data[itemKey];
    },

    /**
     * @param {string} id
     * @param {object} payload
     * @returns {Promise<object>}
     */
    async update(id, payload) {
      const res = await api.patch(`/${resource}/${id}`, payload);
      return res.data[itemKey];
    },

    /**
     * @param {string} id
     * @returns {Promise<object>}
     */
    async archive(id) {
      const res = await api.patch(`/${resource}/${id}/archive`);
      return res.data[itemKey];
    },

    /**
     * @param {string} id
     * @returns {Promise<object>}
     */
    async unarchive(id) {
      const res = await api.patch(`/${resource}/${id}/unarchive`);
      return res.data[itemKey];
    },
  };
}

// ─── Contacts ─────────────────────────────────────────────────────────────

export const contactsService = {
  ...createResourceService('contacts', 'contact'),

  /**
   * Grant or revoke a contact's portal login. Admin only on the server.
   *
   * @param {string} id
   * @param {boolean} enabled
   * @returns {Promise<object>}
   */
  async setPortalAccess(id, enabled) {
    const res = await api.post(`/contacts/${id}/portal-access`, { enabled });
    return res.data.contact;
  },

  /**
   * Replace the profile image. The file is sent as a raw body, and the server
   * decides what it actually is from its magic bytes.
   *
   * @param {string} id
   * @param {File} file
   * @returns {Promise<object>}
   */
  async uploadProfileImage(id, file) {
    const res = await apiUpload(`/contacts/${id}/profile-image`, file);
    return res.data.contact;
  },
};

// ─── Chart of Accounts ────────────────────────────────────────────────────

export const accountsService = {
  ...createResourceService('accounts', 'account'),

  /**
   * The full hierarchy, assembled server-side from a single query.
   *
   * @param {object} [params] - { status }
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ tree: Array, count: number }>}
   */
  async tree(params, signal) {
    const res = await api.get(`/accounts/tree${toQueryString(params)}`, { signal });
    return res.data;
  },
};

// ─── Journals ─────────────────────────────────────────────────────────────

export const journalsService = createResourceService('journals', 'journal');

// ─── Taxes ────────────────────────────────────────────────────────────────

export const taxesService = createResourceService('taxes', 'tax');

// ─── Analytic accounts ────────────────────────────────────────────────────

export const analyticAccountsService = createResourceService(
  'analytic-accounts',
  'analyticAccount',
);

// ─── Journal entries (Phase 7) ────────────────────────────────────────────

/**
 * The ledger's own endpoints.
 *
 * Deliberately NOT built from createResourceService: there is no update and no
 * archive on a posted journal entry. technicalrequirement.md §3.8 makes
 * reversal the only correction, and the missing methods are what keeps a
 * caller from reaching for an edit that does not exist.
 */
export const journalEntriesService = {
  /**
   * @param {object} params - page, limit, search, status, source, journalId,
   *                          dateFrom, dateTo, sortBy, sortOrder
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async list(params, signal) {
    const res = await api.get(`/journal-entries${toQueryString(params)}`, { signal });
    return res.data;
  },

  /**
   * @param {string} id
   * @param {AbortSignal} [signal]
   * @returns {Promise<object>} The entry with its lines.
   */
  async get(id, signal) {
    const res = await api.get(`/journal-entries/${id}`, { signal });
    return res.data.entry;
  },

  /**
   * Post a manual entry. It posts immediately — there is no draft step.
   *
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async create(payload) {
    const res = await api.post('/journal-entries', payload);
    return res.data.entry;
  },

  /**
   * Reverse a posted entry with a mirror entry.
   *
   * @param {string} id
   * @param {{ reason?: string, reversal_date?: string }} payload
   * @returns {Promise<{ original: object, reversal: object }>}
   */
  async reverse(id, payload) {
    const res = await api.post(`/journal-entries/${id}/reverse`, payload);
    return res.data;
  },
};

// ─── Products ─────────────────────────────────────────────────────────────

export const productsService = createResourceService('products', 'product');

// ─── Product categories ───────────────────────────────────────────────────

export const productCategoriesService = createResourceService('product-categories', 'category');
