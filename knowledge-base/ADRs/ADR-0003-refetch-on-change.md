---
adr: 3
title: Refetch location only when the ZIP or country changes
status: Accepted
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, performance, owm]
---

# ADR-0003 — Refetch location only when the ZIP or country changes

> **Status:** Accepted · **Date:** 2026-07-21 · Register: [[ADRs]] · ✅ Author-confirmed 2026-07-21

## Context

`PUT /api/users/:id` can update `name`, `zip`, and/or `country`. Re-resolving
location on every update only matters when the location input itself changed —
a name-only edit has no bearing on where the user is. Each external call to
OpenWeatherMap costs latency and consumes a rate-limit slot, so calling it
unconditionally on every update is wasteful.

## Decision

In `src/services/userService.js`, `update()` compares the incoming `zip` and
`country` against the existing record. Location is re-resolved via
OpenWeatherMap only when either actually changes (`nextZip !== existing.zip ||
nextCountry !== existing.country`); otherwise the previously stored
coordinates, timezone, and city are kept as-is and only the changed fields
(e.g. `name`) are written.

## Alternatives considered

- **Always refetch on update** — correct but wasteful: burns a call and a
  rate-limit slot on a pure name edit that has no location implication.
- **Never refetch on update** — cheaper, but leaves coordinates stale after a
  real ZIP change, which is a correctness bug.
- **A TTL cache in front of OWM** — speculative complexity; the actual
  requirement is simpler and fully satisfied by comparing the two fields that
  matter.

## Consequences

- **Good:** external-call count stays flat across name-only edits and
  increments by exactly one on a ZIP or country change; a dedicated test
  asserts exactly this behavior.
- **Cost:** the change-detection logic must diff the patch against the
  existing record rather than blindly applying it.
- **Follow-up:** none.

## Related

- [[ADR-0002-owm-single-call]] · [[Hermetic Testing]]
- [[Request Lifecycle]]
