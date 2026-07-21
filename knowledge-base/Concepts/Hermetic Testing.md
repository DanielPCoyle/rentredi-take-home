---
title: Hermetic Testing
tags: [concept, testing]
created: 2026-07-21
---

← back to [[Concepts]]

# Hermetic Testing

Hermetic tests need no network access and no live credentials to run — by
construction, not by discipline. Every external dependency (a third-party API,
a cloud SDK, a real database) is replaced with a deterministic seam so the
suite is fast, reproducible, and runnable anywhere, including CI with no
secrets configured.

## In this codebase

Four seams do the work: unit tests stub `global.fetch` so
`locationService.js` never makes a real OpenWeatherMap call; an `OWM_MOCK` env
var (`src/config.js`, consumed in `locationService.js`) makes the whole server
return deterministic location data, which is what lets the Playwright e2e
suite run offline against a real running server; the firebase driver
(`src/db/firebase.js`) accepts an injectable `admin` argument so its full
CRUD and credential-mapping logic is unit-tested against an in-memory fake
instead of a live RTDB project; and the in-memory DB is simply the default
driver, so most of the suite never touches Firebase at all. The payoff is
concrete: the README reports ~92% statement coverage of `src/`, achieved
without a single network call or credential in the test run.

## Why it matters

Tests that depend on live network/creds are slow, flaky, and often skipped in
CI — hermetic-by-construction removes the excuse.

## Related

[[ADR-0008-testing-strategy]], [[ADR-0001-db-facade]],
[[ADR-0002-owm-single-call]], [[Repository Facade]]
