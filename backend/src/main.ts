import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
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

  setupSecurity(app);

  app.use((req: any, _res: any, next: any) => {
    global.request = req;
    next();
  });

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://app.smarttechsaas.com',
      'https://www.smarttechsaas.com',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
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

bootstrap();
