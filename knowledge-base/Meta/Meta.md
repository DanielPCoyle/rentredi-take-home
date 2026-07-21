---
title: Meta
type: index
tags: [moc, meta]
created: 2026-07-21
---

# 🗂️ Meta

The vault's own scaffolding — how it was populated and how to keep it honest.

← back to [[README|home]]

## Notes

- [[Intake Survey]] — the questionnaire that shaped this vault. Pre-filled from the repo's README rationale + my answers; **blanks are flagged** for me to complete so the ADRs can be refined.
- [[Glossary]] — terms of art used across the vault (ADC, RTDB, ReactFire, AEO, hermetic test, trust boundary, …).

## How this vault was built

1. Reviewed the codebase and the README's *Decisions Explained* section.
2. Ran a short survey to set framing (portfolio), the provider stance (OWM-only), ADR depth (core eight), and input method.
3. Seeded the eight [[ADRs]] from the documented rationale, added [[Concepts]] and [[Architecture]], and logged the sprint in [[Daily]].
4. Left [[Intake Survey]] open for the parts only I can answer.

## Conventions

- **Indexes are folder notes** named after their folder (`ADRs`, `Concepts`, …). Every folder has one; the [[README|home]] links them all.
- **Links use Obsidian wiki-link syntax** (double square brackets), aliased with a pipe for display where the target slug is terse.
- **ADRs are immutable-ish:** to change a decision, add a new ADR that `supersedes` the old one rather than editing history.
