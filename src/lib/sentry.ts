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
    beforeSend(event) {
      const msg = event.exception?.values?.[0]?.value ?? "";
      // Globe unmount race condition — handled by error boundary, not actionable
      if (msg.includes("__kapsuleInstance")) return null;
      // Stale chunk after deploy — handled by lazyRetry reload logic
      if (msg.includes("Failed to fetch dynamically imported module")) return null;
      // Dev-only react-refresh noise
      if (msg.includes("@react-refresh")) return null;
      return event;
    },
  });
}

export { Sentry };
