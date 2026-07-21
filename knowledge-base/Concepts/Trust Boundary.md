---
title: Trust Boundary
tags: [concept, security, validation]
created: 2026-07-21
---

← back to [[Concepts]]

# Trust Boundary

A trust boundary is the line past which you stop believing caller-supplied data
and start treating it as untrusted input. Anything derived or authoritative —
identifiers, computed values, anything the server itself owns — must be
produced server-side, never accepted verbatim from the client, even if the
client happens to send a plausible-looking value.

## In this codebase

`id`, `lat`, `lon`, and `timezone` are all server-owned: `id` comes from the
database driver, location fields come only from OpenWeatherMap. The request
schemas in `src/schemas/userSchemas.js` use Zod's `.strict()`, which actively
**rejects** any of those fields with a `400` if a client tries to send them —
not a silent strip, a hard failure, which is the more honest signal that
something is wrong with the caller. On the frontend, the same boundary holds
in a different shape: writes always go through the API so the server retains
sole ownership of enrichment and validation, while reads may be live (ReactFire
subscription) or polled — but never a path that lets the client write around
the API.

## Why it matters

A permissive schema (strip unknown fields silently) hides bugs and invites
confusion about what actually took effect; `.strict()` makes the boundary
loud and testable.

## Related

[[ADR-0004-trust-boundary]], [[ADR-0002-owm-single-call]],
[[ADR-0006-frontend-live-sync]], [[ADR-0007-firebase-adc-rules]],
[[Fail-Fast Config]]
