---
adr: 8
title: Hermetic tests by construction
status: Accepted
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, testing]
---

# ADR-0008 — Hermetic tests by construction

> **Status:** Accepted · **Date:** 2026-07-21 · Register: [[ADRs]] · ✅ Author-confirmed 2026-07-21

## Context

The suite needs to give real confidence without depending on live network
calls or real credentials — a test run shouldn't be able to fail because
OpenWeatherMap is slow or a Firebase project isn't reachable.

## Decision

The suite runs on **Vitest** with v8 coverage, ~92% of statements across
`src/` (`src/index.js`, the bootstrap entry, is excluded — it only wires
config and starts the listener). It's hermetic by construction at every
layer: `test/users.test.js` stubs `global.fetch` directly instead of hitting
OWM, and an `OWM_MOCK` env seam returns deterministic location data so the
offline Playwright e2e suite never touches OpenWeatherMap
(`playwright.config.js`'s `webServer` sets `DB_DRIVER=memory` and
`OWM_MOCK=1`); a ZIP of `"00000"` simulates one unknown to the provider to
exercise the 400 failure path. The Firebase driver is the one piece that
touches a real external SDK, so `createFirebaseDb` (`src/db/firebase.js`)
takes an **injectable `admin`** argument; `test/firebaseDb.test.js` passes an
in-memory fake standing in for `firebase-admin`'s Database API
(`push`/`set`/`once`/`child`/`remove`) plus its credential functions, covering
full CRUD and credential-mapping with no live project. Dependency injection
was chosen because Vitest's module mocker couldn't intercept the driver's
lazy `require("firebase-admin")` — DI is the cleaner, more explicit fix.

## Alternatives considered

- **Hitting live OWM/Firebase in tests** — flaky (network, rate limits) and
  requires real keys or a real project just to run the suite at all.
- **Module-mocking the `firebase-admin` require** — tried first, but Vitest's
  mocker couldn't intercept the driver's lazy `require` call.
- **Enforcing coverage on the bootstrap entry (`src/index.js`)** — pure
  wiring with no branching logic; would only add coverage noise.

## Consequences

- **Good:** a fast, deterministic, fully offline suite (unit and e2e alike);
  the real Firebase driver is still verified end-to-end against a live RTDB
  separately, outside the hermetic suite.
- **Cost:** the injected `admin` fake has to track the shape of the real
  `firebase-admin` SDK it stands in for, or it drifts silently.
- **Follow-up:** none.

## Related

- [[Hermetic Testing]] · [[Repository Facade]]
- [[ADR-0001-db-facade]] · [[ADR-0002-owm-single-call]]
