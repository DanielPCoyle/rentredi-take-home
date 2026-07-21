---
adr: 7
title: ADC over key files; least-privilege RTDB rules
status: Accepted
date: 2026-07-21
deciders: Dan Coyle
tags: [adr, firebase, security]
---

# ADR-0007 — ADC over key files; least-privilege RTDB rules

> **Status:** Accepted · **Date:** 2026-07-21 · Register: [[ADRs]] · ✅ Author-confirmed 2026-07-21

## Context

The live path needs two things at once: the backend needs admin credentials
to write via `firebase-admin`, and the browser needs read access for
ReactFire — without a long-lived secret sitting in the repo or on disk.

## Decision

The backend authenticates with **Application Default Credentials**
(`gcloud auth application-default login`) rather than a downloaded
service-account JSON as the primary path — `createFirebaseDb` still accepts a
`serviceAccount` (inline JSON or file path) for environments that need it, but
ADC is what keeps a normal dev/deploy setup free of a committed secret file.
`database.rules.json` grants `"users": { ".read": true, ".write": false }` —
**public read** of `/users` (exactly what ReactFire's subscription needs) and
**deny all client writes**; the admin SDK bypasses rules entirely, so every
mutation still flows through the validated API. The default RTDB instance
itself was provisioned over the Management REST API rather than the
interactive `firebase init database` (the CLI command requires a TTY), using
the same ADC token plus a quota-project header. Day-to-day rule deploys and
sample-data seeding are then scripted end to end and idempotently in
`scripts/setup-rtdb.sh`.

## Alternatives considered

- **A committed service-account JSON** — a long-lived secret that's a
  liability the moment it's checked in or leaked.
- **Open write rules** — would bypass validation and the trust boundary
  entirely; anyone with the client config could write directly to `/users`.
- **Interactive CLI provisioning (`firebase init database`)** — not
  scriptable or reproducible from a fresh clone or CI.

## Consequences

- **Good:** no secret file on disk; least-privilege rules (clients read-only);
  reproducible, idempotent provisioning via `scripts/setup-rtdb.sh`.
- **Cost:** ADC requires a `gcloud` login in whatever environment runs the
  app. Demo rules are deliberately read-open — a real deployment would gate
  reads behind auth, per the README's stated assumptions.
- **Follow-up:** the author confirmed (intake survey, 2026-07-21) that
  production *will* gate `/users` reads behind auth — now recorded as
  [[ADR-0009-auth-gated-reads]] (Proposed).

## Related

- [[Trust Boundary]] · [[ADR-0006-frontend-live-sync]]
- [[ADR-0001-db-facade]] · [[Fail-Fast Config]] · [[ADR-0009-auth-gated-reads]]
