---
title: Fail-Fast Config
tags: [concept, configuration, reliability]
created: 2026-07-21
---

← back to [[Concepts]]

# Fail-Fast Config

Fail-fast config means validating the entire environment once, at startup,
and crashing loudly with a full list of problems if anything is missing or
malformed — instead of letting a bad value silently propagate until it
surfaces as a confusing runtime error deep in a request handler.

## In this codebase

`src/config.js` parses `process.env` through a single Zod schema
(`envSchema`) covering everything from `PORT` to the OpenWeatherMap key to
the Firebase variables. `loadConfig` calls `safeParse` and, on failure, joins
every issue into one formatted message (`Invalid environment configuration:\n
- path: message`) and throws — so a missing `OWM_API_KEY` or a malformed
`FIREBASE_DATABASE_URL` is caught before the server ever calls `listen()`,
with every problem visible at once rather than one crash per fix-and-retry
cycle. The same pass derives the DB driver (`DB_DRIVER`, or auto-selected
`firebase` when `FIREBASE_DATABASE_URL` is present) and only builds a
`webFirebase` object when the essential public fields are all there —
otherwise it's `null` and the frontend degrades to polling.

## Why it matters

It's the same "reject, don't guess" instinct as the trust boundary, applied
to configuration instead of request bodies — bad input is refused loudly at
the earliest possible point, not tolerated and worked around downstream.

## Related

[[ADR-0004-trust-boundary]], [[ADR-0005-error-model]], [[Trust Boundary]]
