---
title: Repository Facade
tags: [concept, architecture, data-layer]
created: 2026-07-21
---

← back to [[Concepts]]

# Repository Facade

A repository facade is a single interface in front of multiple real storage
implementations, with the concrete one chosen at runtime (config, env var) and
injected into or swapped by tests. It earns its keep only when there are
genuinely multiple implementations to unify — an interface built for exactly
one backend is speculative abstraction, not this pattern.

## In this codebase

`src/db/index.js` is a thin facade: `init(config)` picks a driver based on
`DB_DRIVER` and every subsequent call (`create`, `list`, `get`, `update`,
`remove`) delegates to whichever driver was selected. The two real
implementations are `src/db/memory.js` (an in-memory `Map`, the zero-setup
default) and `src/db/firebase.js` (a `firebase-admin` Realtime Database
driver). The firebase driver additionally accepts an injectable `admin`
argument (`createFirebaseDb(firebaseConfig, admin = require("firebase-admin"))`)
so it can be exercised in unit tests without a live project. The README is
explicit that this is "the *one* deliberate abstraction in the codebase" —
justified because there are two real backends, not because it looked tidy.

## Why it matters

It resolves a real tension (Firebase bonus vs. zero-setup requirement) with
the smallest interface that has two honest implementations, rather than
reaching for a generic ORM or DB-abstraction library.

## Related

[[ADR-0001-db-facade]], [[ADR-0008-testing-strategy]], [[Hermetic Testing]],
[[Progressive Enhancement]]
