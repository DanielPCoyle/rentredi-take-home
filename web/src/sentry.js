// Minimal @sentry/react wrapper. Sentry is initialized on demand only when the
// backend reports a browser DSN via /api/config; with no DSN every call is a
// no-op, so an unconfigured build ships no Sentry and makes no network calls.
import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry(dsn) {
  if (initialized || !dsn || typeof window === "undefined") return;
  initialized = true;
  Sentry.init({
    dsn,
    // Errors only by default — no performance tracing, no session replay.
    tracesSampleRate: 0,
  });
}

export { Sentry };
