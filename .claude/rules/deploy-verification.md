# Deploy verification: green CI is not a healthy deploy

Passing CI proves the code builds and unit tests pass. It does **not** prove the
service boots in production. Confirm the running deployment, not just the config
or the build.

## When this applies

- After a dependency **major** bump that touches a runtime-only code path (a DB
  driver, an external SDK, anything hidden behind an injected mock in tests).
- After any change to how the app connects to Firebase / a database / a paid API
  whose real client is never exercised by CI.
- Any time you are about to report a Railway (or similar) deploy as "done".

## What broke (source of this rule)

`firebase-admin` 12→14 removed the namespaced API (`admin.credential`,
`admin.apps`, `admin.database()`). Every CI check passed — build, test,
coverage, Playwright, CodeQL — because the firebase tests inject a fake `admin`
and CI has no real credentials. The server still crashed at boot in production
(`Cannot read properties of undefined (reading 'cert')`) and returned 502. The
branch had *never* actually run; production had been served from manual
`railway up` images the whole time, masking the breakage.

## Required actions

1. **CI green ≠ deployable.** For a runtime-only dependency change, boot the real
   server against the real dependency (locally or in a scratch env) before
   merging — do not rely on mock-backed unit tests alone.
2. **Verify the ACTIVE deployment, not the source config.** A Railway service can
   show `source.branch=main` while the live instance is a manual `railway up`
   rollback image (`trigger=CLI`, `reason=rollback`). Check the active
   deployment's `trigger`, `commit`, and `reason` — not just that a repo/branch
   is named.
3. **Build SUCCESS is not health.** A deployment status of `SUCCESS` only means it
   built and started; poll to a terminal state AND hit a real endpoint
   (`/health` and one data endpoint) for HTTP 200 before declaring done.
4. **Keep a rollback ready.** When redeploying a branch that has never run in
   prod, know the last-good deployment id up front so recovery is one
   `deploymentRollback` call, not an investigation.
