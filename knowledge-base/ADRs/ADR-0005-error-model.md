---
adr: 5
title: Typed errors with one central handler
status: Accepted
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, errors, logging]
---

# ADR-0005 — Typed errors with one central handler

> **Status:** Accepted · **Date:** 2026-07-21 · Register: [[ADRs]] · ✅ Author-confirmed 2026-07-21

## Context

The API has several distinct failure modes — bad client input, a missing
resource, an OpenWeatherMap call that fails outright, times out, or returns
incomplete data. Left to each controller, every one of those would mean
re-deciding an HTTP status and a response shape on the spot, with no guarantee
any two controllers agree.

## Decision

`src/errors.js` defines a small typed hierarchy: `AppError` (base — carries
`status`, a stable machine `code`, optional `details`, and an `expected` flag
derived from `status < 500`) subclassed into `ValidationError` (400),
`NotFoundError` (404), and `UpstreamError` (502 default, 504 for timeouts).
Every async controller wraps its work in an explicit `try/catch` and forwards
the error to `next()`, which funnels into the *one* central handler
(`src/middleware/errorHandler.js`). That handler is the only place a thrown
error becomes a response: success is `{ data }`, failure is
`{ error: { code, message, details? } }`. OpenWeatherMap failures are mapped
deliberately: an unknown ZIP → 400 (bad client input), provider 5xx/other →
502, a timeout → 504, incomplete response data → 502. Logging is structured
JSON via **pino** (`src/logger.js`) with a per-request child logger; expected
client errors (`err.expected`) log at `warn`, upstream/unexpected errors log
at `error` with the full error object.

## Alternatives considered

- **Ad-hoc `res.status(...).json(...)` per controller** — the same
  status/shape decision repeated N times, guaranteed to drift.
- **Throwing plain `Error` objects** — loses `status`/`code`, forcing the
  handler to guess intent from a message string.
- **A heavyweight error-handling framework** — overkill for a five-route API;
  a typed hierarchy plus one middleware already covers the need.

## Consequences

- **Good:** one consistent JSON envelope everywhere; one place to change
  status or logging semantics; controllers stay thin (try/catch + `next`).
- **Cost:** a small typed-error hierarchy to define and keep in sync with the
  statuses it's meant to represent.
- **Follow-up:** none.

## Related

- [[Fail-Fast Config]] · [[ADR-0004-trust-boundary]]
- [[Request Lifecycle]] · [[System Map]]
