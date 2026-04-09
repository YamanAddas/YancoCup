import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (!DSN) return; // Skip if no DSN configured

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    // Only send 20% of transactions in production
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    // Don't send PII
    sendDefaultPii: false,
  });
}

export { Sentry };
