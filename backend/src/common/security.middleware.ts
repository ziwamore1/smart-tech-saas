import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';

class RedisRateLimitStore {
  constructor(private readonly redis: Redis, private readonly prefix: string) {}

  async increment(key: string) {
    const redisKey = `${this.prefix}:${key}`;
    const results = await this.redis.multi().incr(redisKey).pexpire(redisKey, 15 * 60 * 1000).exec();
    const totalHits = Number(results?.[0]?.[1] || 0);
    return { totalHits, resetTime: new Date(Date.now() + 15 * 60 * 1000) };
  }

  async decrement(key: string) {
    await this.redis.decr(`${this.prefix}:${key}`);
  }

  async resetKey(key: string) {
    await this.redis.del(`${this.prefix}:${key}`);
  }
}

export function setupSecurity(app: INestApplication, redis: Redis | null = null) {
  app.use((req: any, _res: any, next: any) => {
    console.error(`[reqProbe:enter] ${req.method} ${req.originalUrl}`);
    next();
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    ...(redis ? { store: new RedisRateLimitStore(redis, 'ratelimit:global') } : {}),
    passOnStoreError: true,
  });

  app.use(globalLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many authentication attempts, please try again later.',
    ...(redis ? { store: new RedisRateLimitStore(redis, 'ratelimit:auth') } : {}),
    passOnStoreError: true,
  });

  app.use('/api/v1/auth', authLimiter);

  // Public document verification — anti-enumeration/scraping secondary layer.
  // (Edge/API-gateway limiting remains the primary control in production.)
  // Generous enough for ordinary users scanning school documents;
  // tight enough to blunt code brute-forcing. Clean 429, no internal detail.
  const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      statusCode: 429,
      message: 'Too many verification attempts. Please try again later.',
    },
    ...(redis ? { store: new RedisRateLimitStore(redis, 'ratelimit:verification') } : {}),
    passOnStoreError: true,
  });

  app.use('/api/v1/public/verification', verificationLimiter);

  app.getHttpAdapter().getInstance().disable('x-powered-by');
}
