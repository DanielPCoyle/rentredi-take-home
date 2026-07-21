---
adr: 9
title: Gate /users reads behind auth in production
status: Proposed
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, security, production, firebase]
supersedes:
superseded-by:
---

# ADR-0009 — Gate `/users` reads behind auth in production

> **Status:** Proposed · **Date:** 2026-07-21 · Register: [[ADRs]] · Source: intake survey

## Context

The demo grants **public read** of the `/users` node in the Realtime Database —
exactly what ReactFire's live subscription needs, and fine for a take-home where
the data is throwaway (see [[ADR-0007-firebase-adc-rules]]). The README always
flagged this as a demo-only assumption. The intake survey (2026-07-21) resolved
the open question: **yes, production should gate `/users` reads behind auth.**
User records — names paired with resolved coordinates — are not data to leave
world-readable in a real deployment.

## Decision

For any non-demo deployment, remove the public read on `/users` and require an
authenticated identity to read. Concretely: tighten `database.rules.json` so
`.read` on `/users` requires `auth != null` (or a stricter per-owner rule), and
give the browser a real Firebase Auth session so ReactFire subscribes as an
authenticated user rather than anonymously. Writes are unaffected — they already
go only through the admin SDK on the validated API path ([[Trust Boundary]]).

## Alternatives considered

- **Keep public read in production** — rejected: leaks user records; the survey
  explicitly closed this.
- **Proxy all reads through the API (drop live RTDB reads)** — viable and
  simpler on rules, but forfeits the live-sync built in [[ADR-0006-frontend-live-sync]];
  keep as a fallback if adding client auth proves heavy.

## Consequences

- **Good:** user data is no longer world-readable; the trust boundary now covers
  reads as well as writes.
- **Cost:** introduces a client auth flow (sign-in) and per-request identity —
  the first real dependency the "zero-setup" posture doesn't cover. Scope it to
  the production profile, not local/demo.
- **Follow-up:** decide the auth model (anonymous vs. real accounts vs. per-owner
  ownership of records) before implementing.

## Related

- [[ADR-0007-firebase-adc-rules]] — the read-open assumption this resolves
- [[Trust Boundary]] · [[ADR-0006-frontend-live-sync]] · [[ADRs]]
