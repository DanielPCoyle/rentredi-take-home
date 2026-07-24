---
adr: 12
title: Add Sentry for frontend and API observability
status: Proposed
date: 2026-07-22
deciders: Dan Coyle
tags: [adr, observability, sentry, operations]
supersedes:
superseded-by:
---

# ADR-0012 — Add Sentry for frontend and API observability

> **Status:** Proposed · **Date:** 2026-07-22 · Register: [[ADRs]]

## Context

The app now has more production-facing behavior than the original take-home
baseline: live Firebase reads, polling fallback, service-worker caching, offline
mutation replay, OpenWeatherMap enrichment, and Railway deployments. Failures in
those paths can be hard to reconstruct from local tests alone, especially:

- frontend runtime errors in browser-specific flows;
- offline queue replay failures after reconnect;
- API errors caused by OpenWeatherMap, Firebase, validation, or deployment
configuration;
- regressions that only appear in production builds.

Railway logs are useful for server-side process output, but they do not capture
browser exceptions, frontend route context, release correlation, or end-to-end
user-impact breadcrumbs. We need lightweight observability without weakening the
existing trust boundary around client-supplied location data.

## Decision

Add Sentry as the primary error and performance observability layer for both the
Vite frontend and Express API.

Implementation shape:

- **Frontend:** initialize Sentry in `web/src/main.jsx` or a small
  `web/src/sentry.js` module when `VITE_SENTRY_DSN` is present. Capture React
  runtime errors, unhandled promise rejections, release/environment metadata, and
  useful breadcrumbs for user actions already tracked locally (`user_created`,
  `user_updated`, `location_select`, offline queue replay).
- **Backend:** initialize Sentry in `src/index.js` or `src/app.js` when
  `SENTRY_DSN` is present. Add request/error middleware so unhandled exceptions
  and central error-handler paths include method, route, status code, and typed
  error code.
- **Release tagging:** set a release identifier from Railway/Git metadata when
  available, falling back to package version or commit SHA. Use environment names
  such as `production`, `preview`, and `local`.
- **Privacy:** do not send raw request bodies by default. Scrub API keys,
  Firebase credentials, auth headers, cookies, and any future user identifiers
  before events leave the process. Location fields may be included only at coarse
  diagnostic granularity (e.g. country, route, status), not as unfiltered payloads.
- **Operational ownership:** configure DSNs and sampling as Railway environment
  variables, not committed source. Keep the app functional when Sentry variables
  are absent.

Sentry should observe failures; it should not become a required dependency for
serving the app or processing mutations.

## Alternatives considered

- **Railway logs only** — rejected: good for API process logs, but misses browser
  exceptions, release correlation, and frontend breadcrumbs.
- **Google Analytics events only** — rejected: analytics can show usage patterns,
  but it is not an error-monitoring system and should not carry exception
  payloads.
- **Custom error table / Firebase logging** — rejected for now: higher
  maintenance burden, weaker alerting and grouping, and easy to over-collect
  sensitive data.
- **Sentry frontend only** — rejected: leaves API/OpenWeatherMap/Firebase failure
  paths split across separate tools, making production incidents harder to
  reconstruct.

## Consequences

- **Good:** production exceptions are grouped, searchable, and tied to releases;
  frontend and API failures can be correlated; offline replay and provider
  failures become easier to diagnose after deployment.
- **Cost / trade-off:** adds SDK dependencies, configuration, and a privacy review
  surface. Sampling and scrub rules need to be explicit so observability does not
  become accidental data collection.
- **Follow-up:** create Sentry project(s), add DSNs to Railway variables, implement
  SDK initialization and scrub rules, add a smoke test or manual checklist for
  local disabled mode and production enabled mode.

## Related

- [[ADR-0004-trust-boundary]] — client payloads remain untrusted and should not be
  sent to observability unfiltered
- [[ADR-0005-error-model]] — typed errors and the central handler become the
  backend Sentry boundary
- [[ADR-0006-frontend-live-sync]] — frontend runtime paths Sentry should cover
- [[ADR-0008-testing-strategy]] — Sentry complements hermetic tests; it does not
  replace them
- [[ADRs]]
