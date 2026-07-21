---
adr: 4
title: Never trust client-supplied location data
status: Accepted
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, security, validation]
---

# ADR-0004 — Never trust client-supplied location data

> **Status:** Accepted · **Date:** 2026-07-21 · Register: [[ADRs]] · ✅ Author-confirmed 2026-07-21

## Context

`id`, `lat`, `lon`, and `timezone` are all derived server-side — `id` by the
database, the location fields by OpenWeatherMap — and must never be accepted
from the client. Configuration (API keys, timeouts, the DB driver selection)
also needs to be correct before the server does anything useful.

## Decision

The Zod request schemas in `src/schemas/userSchemas.js` (`createUserSchema`,
`updateUserSchema`) are `.strict()`, so any field outside the allowed shape —
including `id`, `lat`, `lon`, `timezone` — is actively **rejected with 400**
rather than silently stripped, a stronger and more honest guarantee than
tolerating and discarding unknown input. `id` is assigned by the DB driver on
create; location comes only from OpenWeatherMap via the location service. The
`zip` field itself is validated permissively (min/max length and a loose
character regex, no US-only shape) so international postal codes pass through
— OWM is treated as the actual source of truth for whether a code resolves.
Configuration is validated the same way: `src/config.js` parses `process.env`
through a Zod schema at startup, so a missing or malformed env var crashes the
process immediately rather than surfacing as a confusing runtime error later.

## Alternatives considered

- **Silently strip unknown fields** — would hide client bugs (e.g. a UI
  accidentally sending a stale `lat`) instead of surfacing them as a 400.
- **Trust client-provided coordinates** — spoofable, and defeats the point of
  deriving location server-side from a verified provider.
- **Skip config validation at startup** — defers failure to whenever the bad
  value is first used, producing a confusing runtime error far from the cause.

## Consequences

- **Good:** spoofing a derived field is a clean 400 at the request boundary;
  bad configuration fails loudly at boot instead of quietly at request time.
- **Cost:** clients must send exactly the allowed shape — no forward-compatible
  tolerance for extra fields.
- **Follow-up:** none.

## Related

- [[Trust Boundary]] · [[Fail-Fast Config]]
- [[ADR-0005-error-model]] · [[ADR-0002-owm-single-call]]
