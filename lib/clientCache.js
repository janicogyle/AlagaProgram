'use client';

const cache = new Map();

export function getClientCache(key, { maxAge } = {}) {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.updatedAt;
  return {
    value: entry.value,
    updatedAt: entry.updatedAt,
    isFresh: typeof maxAge !== 'number' || age <= maxAge,
  };
}

export function setClientCache(key, value) {
  cache.set(key, {
    value,
    updatedAt: Date.now(),
  });
}

export function deleteClientCache(key) {
  cache.delete(key);
}

export function clearClientCachePrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
