import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export function setupSecurity(app: INestApplication) {
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
  });

  app.use(globalLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many authentication attempts, please try again later.',
  });

  app.use('/api/v1/auth', authLimiter);

  const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  });

  app.use('/api/v1/verification', verificationLimiter);

  app.getHttpAdapter().getInstance().disable('x-powered-by');
}
