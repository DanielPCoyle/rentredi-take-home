---
adr: 2
title: One OpenWeatherMap call for coordinates + timezone
status: Accepted
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, integration, owm]
---

# ADR-0002 — One OpenWeatherMap call for coordinates + timezone

> **Status:** Accepted · **Date:** 2026-07-21 · Register: [[ADRs]] · ✅ Author-confirmed 2026-07-21

## Context

Each user needs lat/lon and a timezone resolved from a ZIP code. An
OpenWeatherMap API key came with the assignment, and the brief pointed at OWM's
docs for the integration.

## Decision

Use OWM's **current-weather endpoint** (`src/services/locationService.js`)
rather than its geocoding endpoint: a single request returns `coord.lat`,
`coord.lon`, *and* `timezone` (the UTC offset in seconds) together. `timezone`
is stored exactly as OWM returns it — the offset in seconds — as the single
source of truth; the IANA zone name (e.g. `America/Chicago`) is derived from
the coordinates via `tz-lookup`, and the UI derives the `UTC±HH:MM` label and
the live clock from the stored offset. The client is platform-native `fetch`
wrapped in an `AbortController` timeout, not an added HTTP-client dependency —
Node 18+ ships `fetch`.

## Alternatives considered

- **OWM geocoding endpoint** — returns coordinates but not timezone, forcing a
  second call to get all three fields.
- **Adding axios / node-fetch** — an unnecessary dependency when native `fetch`
  already covers the need.
- **Storing a precomputed label or the IANA name as the primary field** — would
  fork the source of truth away from what OWM actually returns.

## Consequences

- **Good:** one external call yields all three derived fields; no HTTP-client
  dependency; the frontend has everything it needs from a single stored offset.
- **Cost:** location truth is coupled to a weather-endpoint response shape,
  which is a deliberate, documented trade-off rather than an oversight.
- **Follow-up:** none.

## Related

- [[Trust Boundary]] · [[ADR-0003-refetch-on-change]]
- [[Provider Variants]] · [[Hermetic Testing]]
