import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || '';
const env = process.env.NODE_ENV || 'development';

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: env === 'production' ? 0.1 : 1.0,
    attachStacktrace: true,
  });
}
