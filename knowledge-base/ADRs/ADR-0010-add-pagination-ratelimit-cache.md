---
adr: 10
title: Add pagination, rate-limiting, and caching in the next version
status: Proposed
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, scalability, production, roadmap]
supersedes:
superseded-by:
---

# ADR-0010 — Add pagination, rate-limiting, and caching next

> **Status:** Proposed · **Date:** 2026-07-21 · Register: [[ADRs]] · Source: intake survey

## Context

The take-home deliberately shipped **no pagination, rate-limiting, or caching** —
scope was kept to the brief and those were called out as speculative complexity
for a demo (README, *What was deliberately left out*). The intake survey
(2026-07-21) revisited that omission for the *intended next version* and the
author's answer was unambiguous: **add all three — "otherwise I'd consider them
blind spots."** So the omission was right for the take-home but is now a known
gap on the path to production, not a permanent stance.

## Decision

Treat pagination, rate-limiting, and caching as planned work for the next
iteration:

- **Pagination** — `GET /api/users` returns the full list today; add
  limit/cursor paging before the dataset can grow unbounded.
- **Rate-limiting** — protect the API (and the upstream OpenWeatherMap call it
  fans out to) from abuse and from burning the OWM rate-limit budget; a
  per-IP/token limiter at the edge or in Express.
- **Caching** — cache resolved ZIP→location lookups (they rarely change) so
  repeat resolutions skip the external call, complementing the existing
  refetch-only-on-change rule ([[ADR-0003-refetch-on-change]]).

## Alternatives considered

- **Keep them omitted** — rejected by the survey; leaving them out past the
  take-home would be a blind spot.
- **Add all three now** — rejected: out of scope for the take-home and premature
  without real traffic to size the limits/TTLs against. Record the intent, build
  when the next version has concrete numbers.

## Consequences

- **Good:** the roadmap gap is explicit rather than implied; each item has a
  clear home (paging on the list route, a limiter middleware, a lookup cache).
- **Cost:** each adds moving parts (cursor state, a limiter store, cache
  invalidation) — the reason they were rightly deferred until needed.
- **Follow-up:** size limits and cache TTLs against real traffic before building.

## Related

- [[ADR-0003-refetch-on-change]] — the existing "don't call OWM needlessly" rule caching extends
- [[ADR-0002-owm-single-call]] · [[Fail-Fast Config]] · [[ADRs]]
