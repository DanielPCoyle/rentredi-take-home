---
title: Experiments
type: index
tags: [moc, experiments]
created: 2026-07-21
---

# 🧪 Experiments

Architectural forks explored in **isolated git worktrees** so they could be
built and compared side by side without disturbing `main`.

← back to [[README|home]]

## Notes

- [[Provider Variants]] — `main` (OpenWeatherMap-only) vs `feat/google-only` (Google-Places-only). Built as parallel worktrees to weigh the tradeoffs. **Outcome: OWM-only chosen** — see [[ADR-0002-owm-single-call|ADR-0002]].
- [[SEO and AEO]] — `feat/seo-aeo`: robots.txt, sitemap, JSON-LD structured data, Open Graph, and a `noscript` fallback aimed at answer engines.

## Why worktrees

Each variant is a full working tree on its own branch, so two providers (or the
SEO layer) can run and be tested at the same time without branch-switching
churn. The variants share the same layered core — only the provider seam and the
front-end input differ.

## Related

- The provider decision this fed → [[ADR-0002-owm-single-call|ADR-0002]]
- The day it happened → [[2026-07-21]]
