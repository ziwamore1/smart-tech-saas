import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import Redis from 'ioredis';
import { createHash } from 'crypto';

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
    // A dashboard load can make many legitimate API calls. Keep abuse
    // protection here, but do not make normal refreshes look like missing
    // data, especially when several users share one public IP.
    max: 5000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Authentication has its own limiter below. Counting it here means a
    // busy dashboard can prevent a user from logging in again. The health
    // probe is infra-only and must never consume the browser budget.
    skip: (req) =>
      req.path.startsWith('/api/v1/auth') ||
      req.path === '/api/v1/health' ||
      req.path.startsWith('/api/v1/health/'),
    ...(redis ? { store: new RedisRateLimitStore(redis, 'ratelimit:global') } : {}),
    passOnStoreError: true,
  });

  app.use(globalLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many authentication attempts, please try again later.',
    // Rate-limit a login identity and its client together. Using only req.ip
    // makes one school/office NAT or reverse proxy block every user.
    keyGenerator: (req: any) => {
      const identifier = String(req.body?.identifier || req.body?.email || '').trim().toLowerCase();
      return createHash('sha256').update(`${ipKeyGenerator(req.ip)}|${identifier || req.path}`).digest('hex');
    },
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
