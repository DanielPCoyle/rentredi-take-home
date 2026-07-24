---
adr: 6
title: Vite + ReactFire live reads, polling fallback
status: Accepted
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, frontend, firebase]
---

# ADR-0006 — Vite + ReactFire live reads, polling fallback (impl: firebase/database onValue)

> **Status:** Accepted · **Date:** 2026-07-21 · Register: [[ADRs]] · ✅ Author-confirmed 2026-07-21
>
> **Implementation note:** the live-reads-vs-polling decision below still holds,
> but the reads are no longer implemented with ReactFire — see
> [Implementation note (superseded)](#implementation-note-superseded) below.

## Context

The frontend has to "run with zero setup," but the Firebase bonus also called
for live Realtime Database reads in the UI — two goals that don't obviously
fit the same codebase without a fallback.

## Decision

The frontend began as a single no-build HTML file (React via CDN), which
honored zero-setup directly. When ReactFire was added for live RTDB reads, it
was migrated to a proper **Vite + React** app — ReactFire's natural habitat,
with real dependencies, native JSX, and none of the CDN module-singleton
fragility. The key rule is that **reads and writes take different paths**:
writes always go through the API (`web/src/App.jsx`'s `PolledUsers`, and the
live path in `web/src/live.jsx`), so the server keeps ownership of location
enrichment, validation, and the trust boundary. Reads are live via ReactFire's
`useDatabaseListData` RTDB subscription *when* the backend reports a Firebase
web config (`GET /api/config`), and fall back to polling `GET /api/users`
every 5s otherwise. ReactFire and Firebase are **code-split**
(`web/src/live.jsx`, `lazy()`-loaded) so the polling path never downloads the
Firebase SDK. `firebase` is pinned to **v9** (`^9.23.0`) because
`reactfire@^4.2.3` peers on it.

## Alternatives considered

- **A Firebase-required frontend** — breaks zero-setup and would break the
  offline Playwright e2e suite, which runs with no Firebase config at all.
- **Client-direct RTDB writes** — would lose server-side location enrichment
  and the validation trust boundary (RTDB rules deny client writes anyway).
- **No code-split** — polling-mode users would pay for downloading the
  Firebase SDK they never use.
- **`firebase` v10+** — breaks the `reactfire@4` peer dependency. *(No longer
  applies — reactfire has since been removed; see the implementation note
  below.)*

## Consequences

- **Good:** the UI is live when Firebase is configured and fully functional
  when it isn't; polling users ship zero Firebase code.
- **Cost:** two data-source paths to maintain (`PolledUsers` vs.
  `LiveRoot`/`LiveUsers`). *(The "pinned `firebase` v9" cost no longer
  applies — see the implementation note below.)*
- **Follow-up:** none.

## Implementation note (superseded)

The decision above — live reads when Firebase is configured, polling
otherwise, writes always through the API — is unchanged and still Accepted.
Only the **implementation** of the live-read subscription changed:

- Reads now use **`firebase/database`'s `onValue`** directly
  (`initializeApp` / `getDatabase` / `ref` / `onValue` in `web/src/live.jsx`),
  not ReactFire's `useDatabaseListData` / `FirebaseAppProvider` /
  `DatabaseProvider`.
- **Why:** reactfire is unmaintained and ships a CJS build that calls
  `require("react")`. Under Vite's rolldown bundler that throws at runtime
  (`require is not defined`) and blanked the page. `firebase/database`'s
  `onValue` does the same job with no extra dependency and no CJS/ESM
  mismatch.
- **Consequence:** `firebase` is no longer pinned to v9 for a `reactfire@4`
  peer dependency — it's now on v12 (`web/package.json`), and can be bumped
  independently going forward.

## Related

- [[Trust Boundary]] · [[Progressive Enhancement]]
- [[ADR-0007-firebase-adc-rules]] · [[System Map]]
