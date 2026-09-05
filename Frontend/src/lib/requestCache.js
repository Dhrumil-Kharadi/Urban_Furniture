const resolved = new Map();
const pending = new Map();
const TTL_MS = 15000;
const objectIds = new WeakMap();
let nextObjectId = 1;

export function getRequestOwnerId(owner) {
  if (!owner || (typeof owner !== 'object' && typeof owner !== 'function')) return 'default';
  if (!objectIds.has(owner)) objectIds.set(owner, `owner-${nextObjectId++}`);
  return objectIds.get(owner);
}

export function getCachedRequest(key, loader) {
  const cached = resolved.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value);
  }
  if (pending.has(key)) return pending.get(key);

  const request = Promise.resolve()
    .then(loader)
    .then((value) => {
      resolved.set(key, { value, expiresAt: Date.now() + TTL_MS });
      return value;
    })
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}
