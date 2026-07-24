// Sentry must load before any other module so its auto-instrumentation can patch
// http/express at require time. index.js requires this file first. No-op unless
// SENTRY_DSN is set, so tests/CI and local runs without a DSN are untouched.
require("dotenv").config();
const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    // Errors-only by default (no perf sampling); set SENTRY_TRACES_SAMPLE_RATE to opt in.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

module.exports = Sentry;
