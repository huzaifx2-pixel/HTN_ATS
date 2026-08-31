import type { Redis } from "ioredis";

const globalForRedis = globalThis as unknown as { __headsbaseRedis?: Redis | null; __headsbaseRedisTried?: boolean };

export function redisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url || null;
}

export async function getRedis(): Promise<Redis | null> {
  if (globalForRedis.__headsbaseRedis) return globalForRedis.__headsbaseRedis;
  if (globalForRedis.__headsbaseRedisTried && globalForRedis.__headsbaseRedis === null) return null;

  const url = redisUrl();
  if (!url) {
    globalForRedis.__headsbaseRedisTried = true;
    globalForRedis.__headsbaseRedis = null;
    return null;
  }

  globalForRedis.__headsbaseRedisTried = true;
  try {
    const { default: IORedis } = await import("ioredis");
    const client = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      connectTimeout: 1500,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    client.on("error", (error) => {
      console.warn("[redis]", error instanceof Error ? error.message : error);
    });
    await client.connect();
    globalForRedis.__headsbaseRedis = client;
    return client;
  } catch (error) {
    console.warn("[redis] unavailable:", error instanceof Error ? error.message : error);
    globalForRedis.__headsbaseRedisTried = true;
    globalForRedis.__headsbaseRedis = null;
    return null;
  }
}
