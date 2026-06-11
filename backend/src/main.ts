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
];

function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
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
  if (isSentryEnabled()) {
    Sentry.init(getSentryConfig());
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ProductionLogger.getLogLevels(),
  });

  const productionLogger = app.get(ProductionLogger);
  productionLogger.setLogLevels(ProductionLogger.getLogLevels());
  app.useLogger(productionLogger);

  app.use(corsMiddleware);
  setupSecurity(app);

  app.use((req: any, _res: any, next: any) => {
    global.request = req;
    next();
  });

  app.use(compression());

  app.setGlobalPrefix('api/v1');
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
  await app.listen(port, '0.0.0.0');
  productionLogger.log(`Application is running on: http://0.0.0.0:${port}/api/v1`);
  productionLogger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  productionLogger.log(`Version: ${process.env.npm_package_version || '2.0.0'}`);
}

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

bootstrap().catch((err) => {
  console.error('BOOTSTRAP FAILED:', err);
  process.exit(1);
});
