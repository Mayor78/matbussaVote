import NodeCache from 'node-cache';

const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false,
});

export default cache;

export function getCachedOrSet(key, ttlSeconds, fetchFn) {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const fresh = fetchFn();
  if (fresh instanceof Promise) {
    return fresh.then((data) => {
      cache.set(key, data, ttlSeconds);
      return data;
    });
  }

  cache.set(key, fresh, ttlSeconds);
  return fresh;
}

export function invalidate(pattern) {
  const keys = cache.keys();
  for (const key of keys) {
    if (key.includes(pattern)) {
      cache.del(key);
    }
  }
}
