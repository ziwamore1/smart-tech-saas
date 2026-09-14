import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { SentryFilter } from './common/sentry.filter';
import { SentryInterceptor } from './common/sentry.interceptor';
import { isSentryEnabled, getSentryConfig } from './common/sentry.config';
import { setupSecurity } from './common/security.middleware';
import { ProductionLogger } from './common/production-logger';
import { json } from 'express';
import { REDIS_CLIENT_TOKEN } from './queues/queue-definitions';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'https://app.smarttechsaas.com',
  'https://www.smarttechsaas.com',
  'https://verify.smarttechsaas.com',
  'https://smart-tech-saas-production.up.railway.app',
];

function safeDbUrl(url?: string): string {
  if (!url) return '(unset)';
  return url.replace(/\/\/[^@]+@/, '//');
}

async function bootstrap() {
  const t0 = Date.now();
  console.log('[bootstrap] starting');
  console.log(`[bootstrap] DATABASE_URL = ${safeDbUrl(process.env.DATABASE_URL)}`);
  console.log(`[bootstrap] DIRECT_URL   = ${safeDbUrl(process.env.DIRECT_URL)}`);

  if (isSentryEnabled()) {
    Sentry.init(getSentryConfig());
  }

  console.log('[bootstrap] creating NestFactory...');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ProductionLogger.getLogLevels(),
  });
  console.log(`[bootstrap] NestFactory.create completed in ${Date.now() - t0}ms`);

  const productionLogger = app.get(ProductionLogger);
  productionLogger.setLogLevels(ProductionLogger.getLogLevels());
  app.useLogger(productionLogger);

  app.set('trust proxy', 1);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  });

  // Parse login bodies before the auth limiter so it can isolate attempts by
  // identifier instead of treating every user behind one proxy as one key.
  app.use(json({ limit: '10mb' }));
  setupSecurity(app, app.get(REDIS_CLIENT_TOKEN, { strict: false }) || null);

  app.use((req: any, _res: any, next: any) => {
    global.request = req;
    next();
  });

  // Auth middleware at Express level — runs before NestJS Router
  // Handles authentication for all protected routes
  const jwtService = app.get(JwtService);
  console.error('[expressAuth] JwtService initialized');
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip auth for public endpoints that don't require authentication
    const isPublicPath =
      req.path.startsWith('/api/v1/feature-locks') ||
      req.path.startsWith('/api/v1/auth') ||
      req.path.startsWith('/api/v1/public/') ||
      req.path === '/api/v1/gallery/public/recent' ||
      req.path === '/api/v1/health' ||
      req.path === '/api/v1/health/detailed' ||
      req.path.startsWith('/api/v1/health/') ||
      req.path.startsWith('/api/v1/template-builder/stamps/verify');
    if (isPublicPath) return next();

    // Skip auth for webhook delivery endpoints
    if (req.method === 'POST' && req.path.includes('/webhooks/delivery/')) {
      return next();
    }

    // All other paths require JWT authentication
    const auth = req.headers.authorization;
    const queryToken = typeof req.query?.token === 'string' ? req.query.token : undefined;
    const token =
      (auth && auth.startsWith('Bearer ') ? auth.slice(7) : undefined) ||
      (req.method === 'GET' && /(\.html|\.pdf(\/view)?|\.xlsx|\.csv)$/i.test(req.path) ? queryToken : undefined);
    if (!token) {
      return res.status(401).json({ statusCode: 401, message: 'Unauthorized', timestamp: new Date().toISOString() });
    }
    try {
      const payload = jwtService.verify(token);
      (req as any).user = {
        id: payload.sub,
        type: payload.type || 'user',
        roles: payload.roles || [],
        platformRoles: payload.platformRoles || [],
        schoolRoles: payload.schoolRoles || [],
        isSuperAdmin: payload.type === 'super_admin',
        schoolId: payload.type === 'super_admin' ? null : (payload.schoolId || null),
      };
      next();
    } catch (err: any) {
      return res.status(401).json({ statusCode: 401, message: 'Invalid token', timestamp: new Date().toISOString() });
    }
  });

  app.use((req: any, _res: any, next: any) => {
    console.error(`[reqProbe:afterAuth] ${req.method} ${req.originalUrl}`);
    next();
  });

  app.use(compression());

  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });
  app.useStaticAssets(join(__dirname, '..', 'smart_tech_logo'), { prefix: '/smart_tech_logo/' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter(), new SentryFilter(app.getHttpAdapter()));
  app.useGlobalInterceptors(new TransformInterceptor(), new SentryInterceptor());

  const port = process.env.PORT || 3001;

  // Initialize NestJS first — mounts all controllers on the Express Router
  await app.init();
  console.log(`[bootstrap] app.init completed in ${Date.now() - t0}ms`);

  // Inject fallback handler directly into the NestJS Router's internal stack.
  // Express 5 does not have a default 404 handler, and the NestJS Router (an
  // Express Router instance) may not call next() for unmatched routes in all
  // configurations.  By adding a catch-all middleware on the Router itself we
  // guarantee it runs when no NestJS controller matches.
  const expressApp = app.getHttpAdapter().getInstance() as any;
  const expressRouter = expressApp._router ?? expressApp.router;
  if (expressRouter?.stack) {
    for (const layer of expressRouter.stack) {
      if (layer.name === 'router' && typeof layer.handle?.use === 'function') {
        layer.handle.use(
          (err: any, _req: Request, res: Response, _next: NextFunction) => {
            if (!res.headersSent) {
              console.error('[routerErrorHandler]', err?.message || 'Unknown error');
              res.status(500).json({
                statusCode: 500,
                message: 'Internal server error',
                error: err?.message || 'Unknown error',
                timestamp: new Date().toISOString(),
              });
            }
          },
        );
        layer.handle.use((_req: Request, res: Response) => {
          if (!res.headersSent) {
            res.status(404).json({
              statusCode: 404,
              message: 'Route not found',
              timestamp: new Date().toISOString(),
            });
          }
        });
        console.log('[bootstrap] injected fallback handlers into NestJS Router');
        break;
      }
    }
  }

  // Global Express error handler — catches errors escaping NestJS Router
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[expressGlobalErrorHandler]', err?.message || err?.toString() || 'Unknown error');
    if (!res.headersSent) {
      res.status(500).json({ statusCode: 500, message: 'Internal server error', timestamp: new Date().toISOString() });
    }
  });

  console.log(`[bootstrap] listening on port ${port}...`);
  await app.listen(port, '0.0.0.0');
  console.log(`[bootstrap] app.listen completed in ${Date.now() - t0}ms`);
  productionLogger.log(`Application is running on: http://0.0.0.0:${port}/api/v1`);
  productionLogger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  productionLogger.log(`Version: ${process.env.npm_package_version || '2.0.0'}`);
}

const MAX_BOOT_ATTEMPTS = 20;
const BOOT_RETRY_BASE_MS = 15_000;
const BOOT_RETRY_CAP_MS = 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function start() {
  for (let attempt = 1; attempt <= MAX_BOOT_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) {
        console.error(
          `[bootstrap] start attempt ${attempt}/${MAX_BOOT_ATTEMPTS} (retry window)`,
        );
      }
      await bootstrap();
      return;
    } catch (err: any) {
      const backoff = Math.min(
        BOOT_RETRY_BASE_MS * attempt,
        BOOT_RETRY_CAP_MS,
      );
      const reason = err?.message || String(err);
      console.error(
        `[bootstrap] attempt ${attempt}/${MAX_BOOT_ATTEMPTS} failed: ${reason}`,
      );
      if (attempt === MAX_BOOT_ATTEMPTS) {
        console.error(
          `[bootstrap] gave up after ${MAX_BOOT_ATTEMPTS} attempts — exiting`,
        );
        process.exit(1);
      }
      console.error(
        `[bootstrap] waiting ${Math.round(backoff / 1000)}s before retrying (kept in-process, no new container spawned)`,
      );
      await sleep(backoff);
    }
  }
}

start();

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
