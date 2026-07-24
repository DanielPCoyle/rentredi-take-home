# Sentry error monitoring: gate on DSN, load first, verify by booting

Adding `@sentry/node` (server) and `@sentry/react` (browser) has non-obvious
constraints. Get them wrong and CI stays green while production is broken.

## When this applies

- Adding or changing Sentry in the server or the browser bundle.
- Reviewing `src/instrument.js`, its require order in `src/index.js`, the
  `setupExpressErrorHandler` call in `src/app.js`, `web/src/sentry.js`, or the
  `Sentry.ErrorBoundary` in `web/src/entry-client.jsx`.

## Server (@sentry/node)

1. **Initialize before everything else.** Sentry patches `http`/`express` when
   `@sentry/node` is required, so `Sentry.init()` must run first. Keep it in
   `src/instrument.js` and keep `require("./instrument")` the **first** require in
   `src/index.js`.
2. **Gate the whole path on `SENTRY_DSN`.** `instrument.js` inits only when it is
   set; `app.js` registers `setupExpressErrorHandler` only when it is set. Unset ⇒
   complete no-op — this is what keeps the hermetic Vitest suite and CI untouched.
   Never register Sentry middleware unconditionally.
3. **`setupExpressErrorHandler` after the routes, before the JSON error handler.**
   Sentry captures ≥500s then calls `next(err)`, so `errorHandler` still formats
   the `{ error: { code, message } }` envelope. Verify 400/404 are unchanged with
   a DSN set.

## Browser (@sentry/react) — runtime DSN + SSR safety

1. **DSN comes from `/api/config` at runtime**, not a build-time `VITE_` var —
   matching how `gaId`/`firebase` are shipped, so one build works everywhere. Use
   a separate public `SENTRY_DSN_WEB` (exposed as `sentryDsn`), distinct from the
   server-only `SENTRY_DSN`.
2. **SSR-safe (see `ssr-safety.md`).** `web/src/sentry.js` touches no browser
   global at import; `initSentry()` guards `typeof window` and is called only from
   App's client-only `/api/config` effect — never during `renderToString`.
3. **`Sentry.ErrorBoundary` goes in `entry-client.jsx`, NOT `entry-server.jsx`.**
   It renders no DOM of its own, so server output and first client render stay
   identical (no hydration mismatch). Server-render errors are already caught by
   the `try/catch` in `src/app.js`'s `/` route and reported by the server SDK, so
   the boundary only needs to cover client-side crashes.

## Verify by BOOTING, not just `npm test` (deploy-verification.md)

`npm test` runs with **no** DSN, so it never exercises the real Sentry path, and
`vite build` passing does not prove the SSR/hydration path runs. Before done:

- Boot the server with a valid-format DSN (a fake `https://k@o0.ingest.sentry.io/0`
  is fine — init validates the shape) and hit `/health` (200), a 400, and a 404.
- Build (`npm run web:build`, which includes the `--ssr` step) and load `GET /`
  in a real browser: the SSR shell must **hydrate** with a clean console and
  `/api/config` must echo the web DSN.

## Docs

`SENTRY_DSN` is a server-only secret — never commit a real one. `SENTRY_DSN_WEB`
is a public browser value. Document both (plus `SENTRY_ENVIRONMENT`,
`SENTRY_TRACES_SAMPLE_RATE`) in `.env.example` and the README whenever the Sentry
config surface changes.
