---
title: Glossary
tags: [meta, glossary]
created: 2026-07-21
---

# Glossary

Terms of art used across this vault, alphabetically.

- **ADC (Application Default Credentials)** — the credential-discovery mechanism used instead of a checked-in service-account key file. See [[ADR-0007-firebase-adc-rules]].
- **AEO (Answer Engine Optimization)** — structuring a page so answer engines, not just search crawlers, can extract and cite it directly. See [[SEO and AEO]].
- **Hermetic test** — a test that needs no network access and no live credentials to run, by construction rather than discipline. See [[Hermetic Testing]].
- **IANA time zone** — a named zone like `America/Chicago`, derived from coordinates via `tz-lookup` rather than stored directly. See [[ADR-0002-owm-single-call]].
- **JSON-LD** — structured data embedded in a page so machines (search or answer engines) can parse its meaning directly. See [[SEO and AEO]].
- **OWM (OpenWeatherMap)** — the external API used to resolve a ZIP code into coordinates, timezone, and city. See [[ADR-0002-owm-single-call]].
- **PWA (Progressive Web App)** — a web app that's installable and keeps working offline.
- **ReactFire** — React bindings for Firebase; used here for live RTDB reads. See [[ADR-0006-frontend-live-sync]].
- **Repository facade** — one interface in front of multiple real storage implementations, chosen at runtime and injectable in tests. See [[Repository Facade]].
- **RTDB (Firebase Realtime Database)** — the NoSQL store behind the `firebase` DB driver. See [[ADR-0001-db-facade]].
- **Trust boundary** — the line past which caller-supplied data stops being believed and starts being treated as untrusted input. See [[Trust Boundary]].
- **UTC offset** — the timezone value as OWM actually returns it, in seconds, stored as the source of truth rather than a derived label. See [[ADR-0002-owm-single-call]].
- **Worktree** — an isolated git working tree checked out on its own branch, used here to build provider variants side by side. See [[Provider Variants]].
- **Zod `.strict()`** — a schema mode that rejects any field outside the declared shape instead of silently dropping it. See [[ADR-0004-trust-boundary]].

## Related

- [[Meta]]
- [[Concepts]]

← back to [[Meta]]
