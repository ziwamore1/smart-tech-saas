import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || '';
const env = process.env.NODE_ENV || 'development';

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: env === 'production' ? 0.1 : 1.0,
    attachStacktrace: true,
    beforeSend(event) {
      if (event.request?.headers) {
        const sensitive = ['authorization', 'cookie', 'x-auth-token'];
        for (const h of sensitive) {
          if (event.request.headers[h]) {
            event.request.headers[h] = '[redacted]';
          }
        }
      }
      return event;
    },
  });
}
