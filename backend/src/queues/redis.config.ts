import Redis, { RedisOptions } from 'ioredis';

export const REDIS_CONNECT_TIMEOUT = 10_000;
export const REDIS_COMMAND_TIMEOUT = 5_000;

/** REDIS_URL is the only Redis input. Railway injects the private service URL in production. */
export function getRedisUrl(): string | undefined {
  const value = process.env.REDIS_URL?.trim();
  return value || undefined;
}

export function getRedisConnectionOptions(): RedisOptions | null {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;

  let url: URL;
  try {
    url = new URL(redisUrl);
    if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') return null;
  } catch {
    return null;
  }

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
    connectTimeout: REDIS_CONNECT_TIMEOUT,
    commandTimeout: REDIS_COMMAND_TIMEOUT,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    lazyConnect: true,
    retryStrategy: (attempt: number) => Math.min(1000 * 2 ** Math.min(attempt - 1, 5), 30_000),
  };
}

export function createRedisClient(): Redis | null {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;
  const options = getRedisConnectionOptions();
  return new Redis(redisUrl, options || undefined);
}

export function redisEndpoint(): string | undefined {
  const value = getRedisUrl();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}:${url.port || 6379}`;
  } catch {
    return 'invalid';
  }
}
