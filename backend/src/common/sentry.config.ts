export const SENTRY_DSN = process.env.SENTRY_DSN || '';
export const SENTRY_ENV = process.env.NODE_ENV || 'development';

export function isSentryEnabled(): boolean {
  return !!SENTRY_DSN && SENTRY_DSN.startsWith('https://');
}

export function getSentryConfig() {
  return {
    dsn: SENTRY_DSN,
    environment: SENTRY_ENV,
    tracesSampleRate: SENTRY_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: SENTRY_ENV === 'production' ? 0.1 : 1.0,
    attachStacktrace: true,
    enabled: isSentryEnabled(),
  };
}
