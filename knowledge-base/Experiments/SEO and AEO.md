---
title: SEO and AEO
tags: [experiment, seo, aeo, worktree]
created: 2026-07-21
---

# SEO and AEO

A single-commit experiment branch, `feat/seo-aeo`, built in its own worktree
(`rentredi-sandbox-seo`) alongside the [[Provider Variants|provider
experiment]].

## The commit

`2c556e9 feat(seo): robots.txt, sitemap, JSON-LD, OG + noscript for AEO` —
per the commit message, on-page Lighthouse was already good; this adds
**discoverability and machine-readability** on top of that. It touches only
three files (`web/index.html`, `web/public/robots.txt`,
`web/public/sitemap.xml`; 91 lines added, 1 removed) and adds:

- **`robots.txt`** — welcomes all crawlers, explicitly including AI bots
  (GPTBot, ClaudeBot, PerplexityBot, Google-Extended); disallows `/api` and
  `/health`; declares the sitemap.
- **`sitemap.xml`** — a single canonical URL, since this is a one-page app.
- **`index.html` additions** — canonical link, Open Graph tags, a Twitter
  card, `WebApplication` JSON-LD structured data, and a `<noscript>` fallback
  with real content.
- Absolute URLs point at the live Railway deploy.

## Why

The app is a globe-heavy React SPA — everything renders client-side after JS
executes. Without server-visible markup, a crawler or answer engine that
doesn't execute JavaScript (or executes it unreliably) sees an essentially
empty page: no title context, no description, no structured data, nothing to
cite. **AEO (Answer Engine Optimization)** extends the same concern to LLM-
based answer engines and AI crawlers, which are more likely to skip JS
execution than a modern search-engine crawler is. The fix is the standard
progressive-enhancement move: put the facts a machine needs (what this is,
canonical URL, OG/Twitter preview, JSON-LD) directly in the HTML that ships
before any script runs, plus a `<noscript>` block as the true JS-off fallback.

## Status

This is a **concluded experiment branch — not merged into `main`**. It lives
only on `feat/seo-aeo`, built and left as a documented, working addition
rather than folded into the primary provider work.

## Related

- [[Experiments]] — the worktree index
- [[Provider Variants]] — the sibling experiment run in the same round of worktrees
- [[Glossary]]

← back to [[Experiments]]
