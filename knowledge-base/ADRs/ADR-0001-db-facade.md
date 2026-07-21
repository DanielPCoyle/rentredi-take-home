---
adr: 1
title: In-memory default, Firebase behind one facade
status: Accepted
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, data-layer, firebase]
---

# ADR-0001 — In-memory default, Firebase behind one facade

> **Status:** Accepted · **Date:** 2026-07-21 · Register: [[ADRs]] · ✅ Author-confirmed 2026-07-21

## Context

The brief asked for a NoSQL store, with Firebase Realtime Database called out as a
bonus — but it also implied the project should run locally without unspecified
setup. Those two pull in opposite directions: Firebase needs a project and
credentials, and a take-home reviewer shouldn't have to provision either before
`npm start` works.

## Decision

Put a small repository facade (`src/db/index.js`) in front of two real driver
implementations: an in-memory `Map` (`src/db/memory.js`, the default) and a
`firebase-admin` Realtime Database driver (`src/db/firebase.js`). `DB_DRIVER`
selects the driver, auto-selecting `firebase` when `FIREBASE_DATABASE_URL` is
present. This is the one deliberate abstraction in the codebase — justified
because there are genuinely two implementations, not a speculative
interface-for-one. The firebase driver also accepts an injectable `admin`
argument so it can be unit-tested without a live project.

## Alternatives considered

- **Firebase-only** — breaks the zero-setup requirement; every reviewer would
  need a project and credentials before the app runs.
- **In-memory-only** — satisfies zero-setup but misses the Firebase bonus and
  the production-shaped path entirely.
- **An ORM / generic DB-abstraction library** — speculative complexity for two
  tiny drivers with a five-method surface.

## Consequences

- **Good:** `npm start` works with zero setup; the test suite stays hermetic;
  the real Firebase bonus still ships behind the same interface.
- **Cost:** one thin layer of indirection between services and the actual
  storage calls.
- **Follow-up:** none.

## Related

- [[Repository Facade]] · [[Progressive Enhancement]]
- [[ADR-0008-testing-strategy]] · [[System Map]]
