# Sentry error monitoring: gate on DSN, load first, verify by booting

Adding `@sentry/node` to this Express app has two non-obvious constraints. Get
either wrong and CI stays green while production behavior is broken.

## When this applies

- Adding or changing Sentry (or any SDK that auto-instruments `http`/`express`
  at require time) in the server.
- Reviewing any change to `src/instrument.js`, its `require` order in
  `src/index.js`, or the `setupExpressErrorHandler` call in `src/app.js`.

## Required behavior

1. **Initialize before everything else.** Sentry patches `http`/`express` when
   `@sentry/node` is required, so `Sentry.init()` must run before those modules
   load. Keep it in `src/instrument.js` and keep `require("./instrument")` as the
   **first** require in `src/index.js`. Do not move it below `require("./app")`.
2. **Gate the whole path on `SENTRY_DSN`.** `instrument.js` calls `Sentry.init()`
   only when `SENTRY_DSN` is set, and `app.js` registers
   `setupExpressErrorHandler` only when it is set. Unset ⇒ complete no-op. This is
   what keeps the hermetic Vitest suite, CI (no DSN), and DSN-less local runs
   untouched — never register Sentry middleware unconditionally.
3. **`setupExpressErrorHandler` goes after the routes, before the JSON error
   handler.** Sentry captures ≥500s then calls `next(err)`, so the existing
   `errorHandler` still formats the `{ error: { code, message } }` envelope.
   Verify 400/404 responses are unchanged with a DSN set — Sentry must pass
   non-5xx through untouched.

## Verify (extends deploy-verification.md)

`npm test` runs with **no** DSN, so it never exercises the real Sentry path.
Before calling it done, **boot the server with a valid-format DSN** (a fake like
`https://k@o0.ingest.sentry.io/0` is fine — init validates the DSN shape) and hit
`/health` (200), a 400 (validation envelope intact), and a 404 (not-found
envelope intact). A boot crash here (bad init, wrong require order) is invisible
to the mock-backed suite.

## Frontend (@sentry/react)

The browser side mirrors the backend but takes its DSN from **runtime config**,
not a build-time `VITE_*` var — matching how this app already ships `gaId` and
the Firebase web config through `GET /api/config` so one build works in every
environment.

1. **Use a separate public var, `SENTRY_DSN_WEB`.** A Sentry DSN is a public
   client key, but keep the browser DSN distinct from the server-only
   `SENTRY_DSN` so the two can target different projects and the server DSN never
   leaks to the browser. The backend exposes it as `sentryDsn` in `/api/config`.
2. **Init on demand, no-op without a DSN.** `web/src/sentry.js` guards exactly
   like `analytics.js` (`initialized || !dsn` → return), so a DSN-less build loads
   no Sentry and makes zero network calls. App's `/api/config` effect calls
   `initSentry(sentryDsn)` alongside `initAnalytics(gaId)`.
3. **Wrap the tree in `Sentry.ErrorBoundary` unconditionally** in `main.jsx` — it
   is a plain React error boundary that shows a fallback instead of a blank
   screen; capture is a no-op until `initSentry` runs, so wrapping is safe with or
   without a DSN.
4. **Verify in a real browser (deploy-verification #5).** `vite build` passing is
   not proof the bundle runs — `@sentry/react` pulls in code that can throw at
   eval time. Boot the server serving `web/dist` with `SENTRY_DSN_WEB` set, load
   it, and confirm it renders **and reloads** (SW-controlled) with a clean
   console before declaring it done.

## Firebase Functions entry is a SEPARATE boot path

`src/index.js` (the `.listen()` entry used by `npm start`/Railway) requires
`instrument.js` first, but the Cloud Functions entry `index.js` wraps `createApp`
in `onRequest` and **never loads `src/index.js`**. Wiring Sentry only into
`src/index.js` leaves it completely dead on the `.web.app` deploy — the exact
"green deploy, doesn't run" trap of `deploy-verification.md`.

- In `index.js`, declare `SENTRY_DSN` + `SENTRY_DSN_WEB` as `defineString` params
  (both are public client keys — no `defineSecret`/Secret Manager needed, which
  also dodges the `.secret.local` 403 trap), map them into `process.env` inside
  `getApp()`, then `require("./src/instrument")` before `createApp`.
- **Known ceiling:** `index.js` requires `src/app.js` (→ express) at module top,
  before this runtime init, so Sentry logs `express is not instrumented`. Harmless
  while `tracesSampleRate=0` (error capture is unaffected); only matters if perf
  tracing is later enabled.
- **Emulator verify (firebase rule #4 bites again):** every `defineString` param —
  including `RTDB_URL`, `WEB_FB_*`, and now `SENTRY_DSN*` — must have a value in
  `.env.local` or `firebase emulators:start` prompts on stdin and hangs, even when
  the param has `default: ""`. Provide all of them (empty is fine); set the two
  `SENTRY_DSN*` to a valid-format DSN and confirm `/api/config` echoes the web DSN
  and `/health`+create+reject behave.

## Docs

`SENTRY_DSN` is a server-only secret — never commit a real one. `SENTRY_DSN_WEB`
is a public browser value. Document both (plus `SENTRY_ENVIRONMENT`,
`SENTRY_TRACES_SAMPLE_RATE`) in `.env.example` and the README Logging section
whenever the Sentry config surface changes.
