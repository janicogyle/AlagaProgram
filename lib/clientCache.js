'use client';

const cache = new Map();
const MAX_CLIENT_CACHE_ENTRIES = 80;

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
  if (cache.has(key)) {
    cache.delete(key);
  }

  cache.set(key, {
    value,
    updatedAt: Date.now(),
  });

  while (cache.size > MAX_CLIENT_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
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
