---
title: ADR Register
type: index
tags: [moc, adr]
created: 2026-07-21
---

# 📐 ADR Register

Architecture Decision Records for the RentRedi take-home. Each ADR states the
**context**, the **decision**, the **alternatives rejected**, and the
**consequences**. New records use [[ADR-Template]].

← back to [[README|home]]

## Status legend

`Accepted` — in effect on `main`. `Superseded` — replaced by a later ADR.
`Proposed` — under consideration.

## Register

| # | Decision | Status | Anchored in |
|---|----------|--------|-------------|
| [[ADR-0001-db-facade\|0001]] | In-memory default, Firebase behind one facade | Accepted | `src/db/` |
| [[ADR-0002-owm-single-call\|0002]] | One OpenWeatherMap call for coords + timezone | Accepted | `src/services/locationService.js` |
| [[ADR-0003-refetch-on-change\|0003]] | Refetch location only when the ZIP/country changes | Accepted | `src/services/userService.js` |
| [[ADR-0004-trust-boundary\|0004]] | Never trust client location data (`.strict()` schemas) | Accepted | `src/schemas/userSchemas.js` |
| [[ADR-0005-error-model\|0005]] | Typed errors + one central handler | Accepted | `src/errors.js`, `src/middleware/errorHandler.js` |
| [[ADR-0006-frontend-live-sync\|0006]] | Vite + ReactFire live reads, polling fallback | Accepted | `web/src/`, `web/src/live.jsx` |
| [[ADR-0007-firebase-adc-rules\|0007]] | ADC over key files; least-privilege RTDB rules | Accepted | `database.rules.json`, `scripts/` |
| [[ADR-0008-testing-strategy\|0008]] | Hermetic tests (Vitest + injectable deps) | Accepted | `test/`, `e2e/` |

> ✅ **All eight Accepted ADRs above were author-confirmed "correct as-is"** in
> the intake survey (2026-07-21) — no corrections. See [[Intake Survey]].

## Proposed — forward decisions

Captured from the intake survey (2026-07-21); not yet built. These record intent
for the next version, not the current state of `main`.

| # | Decision | Status | Source |
|---|----------|--------|--------|
| [[ADR-0009-auth-gated-reads\|0009]] | Gate `/users` reads behind auth in production | Proposed | survey → `op_auth = yes` |
| [[ADR-0010-add-pagination-ratelimit-cache\|0010]] | Add pagination, rate-limiting, and caching next | Proposed | survey → `op_omissions = add` |
| [[ADR-0011-merge-experiment-branches\|0011]] | Merge SEO/AEO to main; archive google-only | Accepted | survey → `op_branches` (resolved) |

## By theme

- **Data & integration:** [[ADR-0001-db-facade|0001]], [[ADR-0002-owm-single-call|0002]], [[ADR-0003-refetch-on-change|0003]], [[ADR-0010-add-pagination-ratelimit-cache|0010]]
- **Safety & correctness:** [[ADR-0004-trust-boundary|0004]], [[ADR-0005-error-model|0005]], [[ADR-0008-testing-strategy|0008]], [[ADR-0009-auth-gated-reads|0009]]
- **Frontend & platform:** [[ADR-0006-frontend-live-sync|0006]], [[ADR-0007-firebase-adc-rules|0007]]
- **Experiments & roadmap:** [[ADR-0011-merge-experiment-branches|0011]]

## Related

- Patterns these ADRs lean on → [[Concepts]]
- How they fit together → [[System Map]]
- Decisions *not yet* recorded / open questions → [[Intake Survey]]
