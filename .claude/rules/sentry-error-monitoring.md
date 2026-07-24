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

## Docs

`SENTRY_DSN` is a server-only secret — never commit a real one. Document it (plus
`SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`) in `.env.example` and the
README Logging section whenever the Sentry config surface changes.
