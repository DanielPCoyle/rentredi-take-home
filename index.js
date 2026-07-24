// Firebase Cloud Functions entry point.
//
// Exports the SAME listen-free Express app used locally and on Railway
// (src/app.js) as a single onRequest function. Firebase Hosting serves the
// static web/dist bundle from its CDN and rewrites /api/** and /health to this
// function (see firebase.json). Local dev and Railway still boot via
// `node src/index.js` (the explicit `start` script) — this file only takes
// effect under Cloud Functions.
//
// IMPORTANT: firebase-functions FORBIDS reserved-prefix env keys (FIREBASE_*,
// GOOGLE_*, GCLOUD_*, ...) in .env files, but src/config.js reads exactly those
// names (FIREBASE_DATABASE_URL, FIREBASE_API_KEY, ...). So we take configuration
// through NON-reserved params + one secret, and map them into the env names the
// app expects inside the handler. On Cloud Functions firebase-admin authenticates
// with the function's own service account (ADC) — no FIREBASE_SERVICE_ACCOUNT.
const { onRequest } = require("firebase-functions/v2/https");
const { defineString, defineSecret } = require("firebase-functions/params");
const { loadConfig } = require("./src/config");
const db = require("./src/db");
const { createApp } = require("./src/app");

// The only real secret (Secret Manager).
const OWM_API_KEY = defineSecret("OWM_API_KEY");
// Optional explicit RTDB URL — needed only for a non-default database instance
// or a non-US region. Empty -> derived from the function's own project below.
const RTDB_URL = defineString("RTDB_URL", { default: "" });
// Optional public web config so the browser gets live ReactFire sync. Unset ->
// the frontend falls back to API polling (the app still works fully). These are
// public values; we take them under non-reserved names to satisfy the .env rule.
const WEB_FB_API_KEY = defineString("WEB_FB_API_KEY", { default: "" });
const WEB_FB_APP_ID = defineString("WEB_FB_APP_ID", { default: "" });
const WEB_FB_SENDER_ID = defineString("WEB_FB_SENDER_ID", { default: "" });

// Build the app once per warm instance, lazily — so the runtime has injected the
// secret + params before loadConfig() reads process.env.
let app;
function getApp() {
  if (!app) {
    // This function never calls .listen(), so PORT is a don't-care here. The
    // Cloud Functions / emulator runtime can inject a non-numeric PORT, which
    // src/config.js validates strictly — normalize it so loadConfig() passes.
    if (!/^\d+$/.test(process.env.PORT || "")) process.env.PORT = "8080";

    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";

    // Default to the project's own Realtime Database via ADC unless overridden
    // (e.g. DB_DRIVER=memory in the emulator's .env.local).
    process.env.DB_DRIVER = process.env.DB_DRIVER || "firebase";
    if (process.env.DB_DRIVER === "firebase" && !process.env.FIREBASE_DATABASE_URL) {
      process.env.FIREBASE_DATABASE_URL =
        RTDB_URL.value() || `https://${projectId}-default-rtdb.firebaseio.com`;
    }

    // Optional public web config -> enables browser live sync via /api/config.
    if (WEB_FB_API_KEY.value()) {
      process.env.FIREBASE_API_KEY = WEB_FB_API_KEY.value();
      process.env.FIREBASE_PROJECT_ID = projectId;
      process.env.FIREBASE_AUTH_DOMAIN = `${projectId}.firebaseapp.com`;
      process.env.FIREBASE_APP_ID = WEB_FB_APP_ID.value();
      process.env.FIREBASE_MESSAGING_SENDER_ID = WEB_FB_SENDER_ID.value();
    }

    const config = loadConfig();
    db.init(config);
    app = createApp(config);
  }
  return app;
}

exports.api = onRequest(
  { region: "us-central1", secrets: [OWM_API_KEY], memory: "256MiB", maxInstances: 10 },
  (req, res) => getApp()(req, res),
);
