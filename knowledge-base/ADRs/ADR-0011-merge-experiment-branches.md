---
adr: 11
title: Merge SEO/AEO, archive google-only
status: Accepted
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, git, experiments, roadmap]
supersedes:
superseded-by:
---

# ADR-0011 — Merge SEO/AEO to main, archive google-only

> **Status:** Accepted · **Date:** 2026-07-21 · Register: [[ADRs]] · Source: intake survey (resolved 2026-07-21)

## Context

Two experiments live on their own branches / worktrees (see [[Experiments]]):
`feat/seo-aeo` (SEO + answer-engine work) and `feat/google-only` (a
Google-Places-only provider swap). The intake survey (2026-07-21) answered their
fate as **"merge to main"** — but that single answer covered two branches whose
natural fates differ, and one conflicted with a decision confirmed in the same
survey (OWM-only). A follow-up resolved the split below.

## Decision

Handle each branch on its own merits:

- **`feat/seo-aeo` → merge to `main`.** It is additive and provider-agnostic —
  robots.txt, sitemap, JSON-LD, Open Graph, and a `noscript` fallback
  ([[SEO and AEO]]). Nothing about it contradicts the OWM-only stance; merging it
  strictly improves discoverability of the shipped app.

- **`feat/google-only` → archive as a documented variant.** Keep OpenWeatherMap
  as the sole provider on `main` ([[ADR-0002-owm-single-call]] stands,
  unchanged). The branch stays as a parked, documented alternative in
  [[Provider Variants]] — valuable as a side-by-side record of the tradeoff, but
  not merged, because merging it would reverse the confirmed OWM-only decision.

## Alternatives considered (for `feat/google-only`)

- **Archive as a documented variant** — **chosen.** Preserves the OWM-only
  decision and keeps the experiment legible.
- **Merge as-is / adopt Google Places on `main`** — rejected: reverses OWM-only
  and would supersede [[ADR-0002-owm-single-call]].
- **Make `main` dual-provider (OWM + Places behind a flag)** — rejected for now:
  a larger design change with no current need; revisit if Places UX becomes a
  requirement.

## Consequences

- **Good:** the SEO/AEO win lands on `main`; OWM-only stays intact; the
  google-only work is retained as documentation rather than deleted or
  half-merged.
- **Cost:** `feat/google-only` will drift from `main` over time as an unmaintained
  branch — acceptable for an archived variant; delete it if it stops earning its
  keep.
- **Follow-up:** perform the `feat/seo-aeo` → `main` merge; tag/note
  `feat/google-only` as archived.

## Related

- [[Experiments]] · [[Provider Variants]] · [[SEO and AEO]]
- [[ADR-0002-owm-single-call]] — the OWM-only decision this preserves
- [[ADRs]]
