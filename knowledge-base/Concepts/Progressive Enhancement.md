---
title: Progressive Enhancement
tags: [concept, architecture, configuration]
created: 2026-07-21
---

← back to [[Concepts]]

# Progressive Enhancement

Progressive enhancement means the system runs correctly with zero setup and
each additional capability turns on only when its config is present —
opt-in, additive, and graceful in its absence rather than required up front.
Nothing breaks if the enhancement is skipped; it just runs in a simpler mode.

## In this codebase

Three independent ladders follow the same shape. Data layer: in-memory `Map`
by default, upgrading to Firebase Realtime Database when `DB_DRIVER=firebase`
(or `FIREBASE_DATABASE_URL` is set) — see [[Repository Facade]]. Frontend
reads: API polling by default, upgrading to live ReactFire subscriptions the
moment a full web Firebase config (`FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`,
`FIREBASE_DATABASE_URL`, etc.) is present — `src/config.js` only builds
`webFirebase` when those essentials all exist, otherwise it's `null` and the
frontend falls back to polling. Analytics: no GA4 script loads at all unless
`GA_MEASUREMENT_ID` is set, exposed via `/api/config`. The project also ships
as a PWA with offline caching as a baseline enhancement layer.

## Why it matters

A reviewer can run `npm start` and get a fully working app in seconds, while
the same codebase demonstrates the production path (Firebase, live sync,
analytics) without a second code path to maintain.

## Related

[[ADR-0001-db-facade]], [[ADR-0006-frontend-live-sync]],
[[Fail-Fast Config]], [[Trust Boundary]]
