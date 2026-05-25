import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { setupSecurity } from './common/security.middleware';
import { ProductionLogger } from './common/production-logger';

async function bootstrap() {
  const logger = new ProductionLogger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ProductionLogger.getLogLevels(),
    bufferLogs: true,
  });

  app.useLogger(app.get(ProductionLogger));

  setupSecurity(app);

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

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: http://0.0.0.0:${port}/api/v1`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`Version: ${process.env.npm_package_version || '2.0.0'}`);
}

bootstrap();
