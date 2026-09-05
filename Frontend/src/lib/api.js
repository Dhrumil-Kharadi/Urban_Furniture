/**
 * Centralized API Client
 *
 * - Prepends NEXT_PUBLIC_API_URL
 * - JSON headers
 * - credentials: 'include' (for HttpOnly session & refresh cookies)
 * - Authorization header for JWT (user role, memory-only)
 * - Single-flight refresh token lock (prevents concurrent refresh races)
 * - Automatic retry after refresh
 * - Unified error parsing
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * In-memory JWT store. Never persisted to localStorage/sessionStorage.
 * Only used for 'customer'/'vendor' role authentication (short-lived 15m JWT).
 * Privileged roles (business_owner/accountant) rely on HttpOnly session cookies.
 */
let _token = null;
let _refreshPromise = null;

export function setToken(token) {
  _token = token;
}

export function getToken() {
  return _token;
}

export function clearToken() {
  _token = null;
}

/**
 * Single-flight token refresh.
 * Ensures that multiple concurrent 401 requests trigger only ONE /auth/refresh call.
 */
async function performTokenRefresh() {
  if (!_refreshPromise) {
    _refreshPromise = (async () => {
      try {
        const config = {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        };
        const res = await fetch(`${BASE_URL}/auth/refresh`, config);
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success && json.data?.token) {
          setToken(json.data.token);
          return json.data.token;
        }
        clearToken();
        return null;
      } catch {
        clearToken();
        return null;
      } finally {
        _refreshPromise = null;
      }
    })();
  }
  return _refreshPromise;
}

/**
 * Core fetch wrapper.
 *
 * @param {string} endpoint - API path (e.g. '/auth/login')
 * @param {object} options
 * @param {string} [options.method='GET']
 * @param {object} [options.body]
 * @param {object} [options.headers]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options._isRetry=false]
 * @returns {Promise<{ success: boolean, message: string, data?: any, errors?: string[] }>}
 */
function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export async function apiFetch(endpoint, { method = 'GET', body, headers = {}, signal, _isRetry = false } = {}) {
  const upperMethod = method.toUpperCase();
  const config = {
    method: upperMethod,
    credentials: 'include', // Always include cookies for session & refresh token auth
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    // Passing the caller's AbortSignal through is what lets a list hook cancel
    // a request when its filters change. Without it, a slow early response can
    // land after a fast later one and paint results for a filter the user has
    // already moved off.
    signal,
  };

  // Attach CSRF double-submit token for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod) && !config.headers['x-csrf-token']) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      config.headers['x-csrf-token'] = csrfToken;
    }
  }

  // Attach JWT for user-role requests (memory-only)
  if (_token) {
    config.headers['Authorization'] = `Bearer ${_token}`;
  }

  if (body && upperMethod !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, config);

  // Handle 401 with transparent refresh (once, unless this is already login/refresh/logout/retry)
  const isAuthEndpoint =
    endpoint.startsWith('/auth/login') ||
    endpoint.startsWith('/auth/refresh') ||
    endpoint.startsWith('/auth/logout');

  if (res.status === 401 && !_isRetry && !isAuthEndpoint) {
    const newToken = await performTokenRefresh();
    if (newToken) {
      return apiFetch(endpoint, { method, body, headers, signal, _isRetry: true });
    }
  }

  // Parse JSON response
  let json;
  try {
    json = await res.json();
  } catch {
    throw {
      success: false,
      status: res.status,
      message: 'Unexpected server response',
      errors: [],
    };
  }

  if (!res.ok) {
    throw {
      success: false,
      status: res.status,
      // The API sends two error shapes: the response.js envelope
      // ({ message, errors }) and the central error middleware's
      // ({ error: { message } }). Read both so a 404 or 409 raised deep in a
      // service still reaches the UI as a sentence rather than "undefined".
      message: json.message || json.error?.message || 'Something went wrong',
      errors: json.errors || [],
    };
  }

  return json;
}

/**
 * POST a raw binary body (an image upload) rather than JSON.
 *
 * Kept separate from apiFetch because it must NOT set Content-Type to
 * application/json, and because the body is a Blob, not something to stringify.
 *
 * @param {string} endpoint
 * @param {Blob|File} file
 * @returns {Promise<object>}
 */
export async function apiUpload(endpoint, file) {
  const headers = { 'Content-Type': file.type };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: file,
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw { success: false, status: res.status, message: 'Unexpected server response', errors: [] };
  }

  if (!res.ok) {
    throw {
      success: false,
      status: res.status,
      message: json.message || json.error?.message || 'Something went wrong',
      errors: json.errors || [],
    };
  }

  return json;
}

/** Convenience helpers */
const api = {
  get: (endpoint, opts) => apiFetch(endpoint, { method: 'GET', ...opts }),
  post: (endpoint, body, opts) => apiFetch(endpoint, { method: 'POST', body, ...opts }),
  patch: (endpoint, body, opts) => apiFetch(endpoint, { method: 'PATCH', body, ...opts }),
  delete: (endpoint, opts) => apiFetch(endpoint, { method: 'DELETE', ...opts }),
};

export default api;

