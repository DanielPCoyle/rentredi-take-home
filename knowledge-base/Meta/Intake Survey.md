---
title: Intake Survey
tags: [meta, survey]
created: 2026-07-21
---

# Intake Survey

The questionnaire that shaped this vault — pre-filled from the repo's README rationale and the framing already agreed.

> ✅ **Completed via the SimplerDevelopment portal survey (#179), 2026-07-21.** All framing and all eight ADRs confirmed as-is; the open questions produced three new ADRs — [[ADR-0009-auth-gated-reads]] and [[ADR-0010-add-pagination-ratelimit-cache]] (Proposed), and [[ADR-0011-merge-experiment-branches]] (Accepted: merge SEO/AEO, archive `feat/google-only`).

## 1. Framing (answered)

- **Audience** → Portfolio / interview prep.
- **Provider stance** → OpenWeatherMap-only is the decision (`main`); the Google-Places and SEO/AEO branches are concluded experiments — see [[Experiments]].
- **ADR depth** → Core flagship set (~8 ADRs).
- **Input method** → Seed from the README's rationale + this intake survey.

## 2. Decision confirmations (pre-filled — confirm or correct)

**[[ADR-0001-db-facade]] — DB facade**
In-memory `Map` is the zero-setup default; a `firebase-admin` RTDB driver sits behind the same interface, selected by `DB_DRIVER` — the one deliberate abstraction in the codebase, justified by two real implementations rather than a speculative interface.
> ✅ **Confirmed as-is** — no correction (author, survey response, 2026-07-21). 

**[[ADR-0002-owm-single-call]] — One OWM call**
A single OpenWeatherMap current-weather request returns coordinates and timezone together; the UTC offset in seconds is stored as the source of truth, with the IANA zone name derived via `tz-lookup`.
> ✅ **Confirmed as-is** — no correction (author, survey response, 2026-07-21). 

**[[ADR-0003-refetch-on-change]] — Refetch on change**
`PUT /api/users/:id` only re-resolves location when the ZIP or country actually changes, sparing a name-only edit from an unnecessary OWM call and rate-limit slot.
> ✅ **Confirmed as-is** — no correction (author, survey response, 2026-07-21). 

**[[ADR-0004-trust-boundary]] — `.strict()` trust boundary**
Zod's `.strict()` schemas actively reject `id`, `lat`, `lon`, `timezone`, and any other unknown field with a 400 instead of silently stripping them; startup config is validated the same way.
> ✅ **Confirmed as-is** — no correction (author, survey response, 2026-07-21). 

**[[ADR-0005-error-model]] — Typed errors + central handler**
Errors are typed and funneled through one central handler so every failure — validation, not-found, upstream OWM failure — comes back as the same JSON error envelope.
> ✅ **Confirmed as-is** — no correction (author, survey response, 2026-07-21). 

**[[ADR-0006-frontend-live-sync]] — Vite/ReactFire/polling**
The frontend runs on Vite + React; reads use a ReactFire RTDB subscription when live, with a polling fallback, while writes always go through the API so the server keeps sole ownership of validation and enrichment.
> ✅ **Confirmed as-is** — no correction (author, survey response, 2026-07-21). 

**[[ADR-0007-firebase-adc-rules]] — ADC + rules**
Application Default Credentials replace a long-lived service-account key file on disk, paired with least-privilege RTDB rules.
> ✅ **Confirmed as-is** — no correction (author, survey response, 2026-07-21). 

**[[ADR-0008-testing-strategy]] — Hermetic tests**
Vitest with injectable dependencies (stubbed `fetch`, an `OWM_MOCK` flag, an injectable `firebase-admin`) keeps the suite network-free and credential-free, reaching ~92% coverage of `src/`.
> ✅ **Confirmed as-is** — no correction (author, survey response, 2026-07-21). 

## 3. Open questions — answered (survey, 2026-07-21)

- [x] **OWM key secret story** — *no answer given* (left blank). Still open; treat as a production-hardening TODO.
- [x] **Gate `/users` reads behind auth in production?** → **Yes.** Recorded as [[ADR-0009-auth-gated-reads]] (Proposed); resolves the read-open assumption in [[ADR-0007-firebase-adc-rules]].
- [x] **Fate of `feat/google-only` + `feat/seo-aeo`?** → **Merge to main**, resolved by branch: `feat/seo-aeo` merges to `main`; `feat/google-only` is **archived as a documented variant** (OWM-only preserved). Recorded as [[ADR-0011-merge-experiment-branches]] (Accepted).
- [x] **Were the pagination / rate-limiting / caching omissions right for the next version?** → **No — add all three** ("otherwise I'd consider them blind spots"). Recorded as [[ADR-0010-add-pagination-ratelimit-cache]] (Proposed).
- [x] **Anything different in hindsight?** — *no answer given* (left blank).
- [x] **Any decision missing an ADR?** — *no answer given* (left blank).

## Related

- [[ADRs]]
- [[Meta]]
- [[Experiments]]

← back to [[Meta]]
