import IORedis from "ioredis";

/**
 * BullMQ requires `maxRetriesPerRequest: null` on the ioredis client.
 */
export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    return new IORedis(url, { maxRetriesPerRequest: null });
  }
  const host = process.env.REDIS_HOST ?? "127.0.0.1";
  const port = Number(process.env.REDIS_PORT ?? 6379);
  const password = process.env.REDIS_PASSWORD?.trim();
  return new IORedis({
    host,
    port,
    password: password || undefined,
    maxRetriesPerRequest: null,
  });
}
