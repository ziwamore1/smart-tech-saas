import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3100'],
    credentials: true,
  });
  // Correlation ID propagation for cross-service traceability (spec §34).
  app.use((req: any, res: any, next: () => void) => {
    const id = req.headers['x-correlation-id'] || `sig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    req.correlationId = id;
    res.setHeader('x-correlation-id', id);
    next();
  });
  const port = Number(process.env.PORT) || 4001;
  await app.listen(port);
  console.log(`Digital Signature Service listening on :${port}`);
}
bootstrap();
