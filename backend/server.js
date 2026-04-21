try {
  require('dotenv/config');
  const { NestFactory } = require('@nestjs/core');
  const { ValidationPipe, Logger } = require('@nestjs/common');
  const { join } = require('path');
  const { AppModule } = require('./dist/app.module');

  async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    app.setGlobalPrefix('api/v1');
    app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });

    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    app.enableCors({ origin: true, credentials: true });

    const port = process.env.PORT || 3001;
    await app.listen(port);
    logger.log(`Running on http://localhost:${port}/api/v1`);
  }

  bootstrap().catch(e => {
    console.error('Failed to start:', e.message);
    process.exit(1);
  });
} catch(e) {
  console.error('Load error:', e.message);
}
