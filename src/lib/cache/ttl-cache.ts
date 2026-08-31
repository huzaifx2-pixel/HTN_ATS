type CacheEntry = { expiresAt: number; value: string };

const memory = globalThis as unknown as {
  __headsbaseTtlCache?: Map<string, CacheEntry>;
  __headsbaseTtlInflight?: Map<string, Promise<unknown>>;
};
if (!memory.__headsbaseTtlCache) memory.__headsbaseTtlCache = new Map();
if (!memory.__headsbaseTtlInflight) memory.__headsbaseTtlInflight = new Map();
const store = memory.__headsbaseTtlCache;
const inflight = memory.__headsbaseTtlInflight;

function memoryGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit || hit.expiresAt <= Date.now()) return undefined;
  return JSON.parse(hit.value) as T;
}

function memorySet(key: string, value: unknown, ttlSeconds: number) {
  store.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function withTtlCache<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const cached = memoryGet<T>(key);
  if (cached !== undefined) return cached;

  try {
    const { getRedis } = await import("@/lib/queue/redis");
    const redis = await getRedis();
    if (redis) {
      const raw = await redis.get(key);
      if (raw) {
        const value = JSON.parse(raw) as T;
        memorySet(key, value, Math.min(ttlSeconds, 15));
        return value;
      }
    }
  } catch {
    // Redis is optional; memory cache still applies.
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = load()
    .then(async (value) => {
      memorySet(key, value, ttlSeconds);
      inflight.delete(key);
      try {
        const { getRedis } = await import("@/lib/queue/redis");
        const redis = await getRedis();
        if (redis) await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
      } catch {
        // ignore redis write failures
      }
      return value;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
  return promise;
}

export async function invalidateCacheKeys(keys: string[]) {
  for (const key of keys) store.delete(key);
  try {
    const { getRedis } = await import("@/lib/queue/redis");
    const redis = await getRedis();
    if (redis && keys.length > 0) await redis.del(...keys);
  } catch {
    // ignore
  }
}

export function orgCacheKeys(organizationId: string) {
  return [
    `dashboard-snapshot:${organizationId}`,
    `dashboard-data:${organizationId}`,
    `candidate-count-bounded:${organizationId}:5000`,
    `job-missing-boolean:${organizationId}`,
    `org-settings:${organizationId}`,
    `search-facets:${organizationId}`,
  ];
}

export async function invalidateOrgCache(organizationId: string) {
  await invalidateCacheKeys(orgCacheKeys(organizationId));
}
