import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || '';
const env = process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV || 'development';

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: env === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: env === 'production' ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,
    attachStacktrace: true,
    integrations: [
      Sentry.replayIntegration(),
      Sentry.browserTracingIntegration(),
      Sentry.httpClientIntegration(),
    ],
    beforeSend(event) {
      if (event.request?.url) {
        const url = new URL(event.request.url);
        const sensitiveHeaders = ['authorization', 'cookie', 'x-auth-token'];
        for (const h of sensitiveHeaders) {
          if (event.request.headers?.[h]) {
            event.request.headers[h] = '[redacted]';
          }
        }
      }
      return event;
    },
  });
}
