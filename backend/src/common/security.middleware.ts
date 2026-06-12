import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

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

  app.use((req: Request, res: Response, next: NextFunction) => {
    try {
      globalLimiter(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many authentication attempts, please try again later.',
  });

  app.use('/api/v1/auth', (req: Request, res: Response, next: NextFunction) => {
    try {
      authLimiter(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  });

  app.use('/api/v1/verification', (req: Request, res: Response, next: NextFunction) => {
    try {
      verificationLimiter(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  app.getHttpAdapter().getInstance().disable('x-powered-by');
}
