---
adr: 6
title: Vite + ReactFire live reads, polling fallback
status: Accepted
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, frontend, firebase]
---

# ADR-0006 — Vite + ReactFire live reads, polling fallback

> **Status:** Accepted · **Date:** 2026-07-21 · Register: [[ADRs]] · ✅ Author-confirmed 2026-07-21

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
- **`firebase` v10+** — breaks the `reactfire@4` peer dependency.

## Consequences

- **Good:** the UI is live when Firebase is configured and fully functional
  when it isn't; polling users ship zero Firebase code.
- **Cost:** two data-source paths to maintain (`PolledUsers` vs.
  `LiveRoot`/`LiveUsers`), plus a pinned `firebase` v9 that can't be bumped
  casually.
- **Follow-up:** none.

## Related

- [[Trust Boundary]] · [[Progressive Enhancement]]
- [[ADR-0007-firebase-adc-rules]] · [[System Map]]
