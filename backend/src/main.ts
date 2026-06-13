import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { join } from 'path';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { SentryFilter } from './common/sentry.filter';
import { SentryInterceptor } from './common/sentry.interceptor';
import { isSentryEnabled, getSentryConfig } from './common/sentry.config';
import { setupSecurity } from './common/security.middleware';
import { ProductionLogger } from './common/production-logger';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'https://app.smarttechsaas.com',
  'https://www.smarttechsaas.com',
  'https://smart-tech-saas-production.up.railway.app',
];

function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

async function bootstrap() {
  const t0 = Date.now();
  console.log('[bootstrap] starting');

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

  app.use(corsMiddleware);
  setupSecurity(app);

  app.use((req: any, _res: any, next: any) => {
    global.request = req;
    next();
  });

  app.use(compression());

  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });

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

  app.useGlobalFilters(new GlobalExceptionFilter(), new SentryFilter());
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
  const expressApp = app.getHttpAdapter().getInstance();
  if (expressApp._router?.stack) {
    for (const layer of expressApp._router.stack) {
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

  console.log(`[bootstrap] listening on port ${port}...`);
  await app.listen(port, '0.0.0.0');
  console.log(`[bootstrap] app.listen completed in ${Date.now() - t0}ms`);
  productionLogger.log(`Application is running on: http://0.0.0.0:${port}/api/v1`);
  productionLogger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  productionLogger.log(`Version: ${process.env.npm_package_version || '2.0.0'}`);
}

const STARTUP_TIMEOUT = 120_000;
const startupTimer = setTimeout(() => {
  console.error(`[bootstrap] TIMEOUT after ${STARTUP_TIMEOUT}ms — app failed to start`);
  process.exit(1);
}, STARTUP_TIMEOUT);

bootstrap()
  .then(() => clearTimeout(startupTimer))
  .catch((err) => {
    clearTimeout(startupTimer);
    console.error('BOOTSTRAP FAILED:', err);
    process.exit(1);
  });

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
