---
title: RentRedi Take-Home — Knowledge Base
type: home
tags: [moc, home, rentredi]
created: 2026-07-21
---

# 🏠 RentRedi Take-Home — Knowledge Base

The reasoning behind a small user-management service built to production
standards: a CRUD API that turns a ZIP code into `{ lat, lon, timezone, city }`
via OpenWeatherMap, backed by Firebase RTDB (with a zero-setup in-memory
fallback) and a Vite + React front-end.

This vault exists to make the **decisions** legible — not just *what* was built,
but *why*, and *what was rejected*. It is written for **portfolio / interview**
reading: each Architecture Decision Record carries the context, the choice, the
alternatives turned down, and the consequences.

> **Provider stance:** `main` is **OpenWeatherMap-only** and is the chosen
> direction. The Google-Places and SEO/AEO branches are documented as
> *concluded experiments* — see [[Experiments]].

---

## 🗺️ Maps of Content

| Section | What lives there |
|---|---|
| [[ADRs]] | Architecture Decision Records — the eight flagship decisions |
| [[Architecture]] | System map + request lifecycle |
| [[Concepts]] | Evergreen patterns the decisions lean on |
| [[Daily]] | Daily sprint logs (the build, hour by hour) |
| [[Experiments]] | The provider variants + SEO/AEO branches |
| [[Meta]] | Intake survey, glossary — the vault's own scaffolding |

## ⭐ Start here

- **New to the project?** Read [[System Map]] then skim [[ADRs]].
- **Interviewing me on this?** The eight ADRs are the meat: [[ADR-0001-db-facade|0001 DB facade]] · [[ADR-0002-owm-single-call|0002 OWM single call]] · [[ADR-0003-refetch-on-change|0003 Refetch-on-change]] · [[ADR-0004-trust-boundary|0004 Trust boundary]] · [[ADR-0005-error-model|0005 Error model]] · [[ADR-0006-frontend-live-sync|0006 Live sync]] · [[ADR-0007-firebase-adc-rules|0007 Firebase ADC + rules]] · [[ADR-0008-testing-strategy|0008 Testing]].
- **Want the raw story?** [[2026-07-21]] — the whole thing was one sprint.
- **Want to correct or deepen the record?** [[Intake Survey]] captures my input; blanks are flagged for me to fill.

## 📌 The eight decisions at a glance

1. [[ADR-0001-db-facade|In-memory default, Firebase behind one facade]] — the *one* deliberate abstraction.
2. [[ADR-0002-owm-single-call|One OpenWeatherMap call]] — coords **and** timezone from a single request.
3. [[ADR-0003-refetch-on-change|Refetch location only when the ZIP changes]] — don't spend a rate-limit slot on a name edit.
4. [[ADR-0004-trust-boundary|Never trust client location data]] — `.strict()` schemas *reject* derived fields.
5. [[ADR-0005-error-model|Typed errors + one central handler]] — one consistent JSON envelope.
6. [[ADR-0006-frontend-live-sync|Vite + ReactFire with a polling fallback]] — reads and writes take different paths.
7. [[ADR-0007-firebase-adc-rules|ADC over key files, least-privilege rules]] — no long-lived secret on disk.
8. [[ADR-0008-testing-strategy|Hermetic tests by construction]] — ~92% coverage, no network, no keys.

---

*Source repo: `rentredi-sandbox` · branch `main` (OWM-only). Vault built 2026-07-21.*
