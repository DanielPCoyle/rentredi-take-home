---
title: Concepts
type: index
tags: [moc, concepts]
created: 2026-07-21
---

# 💡 Concepts

Evergreen patterns the decisions lean on. Each note is written to stand on its
own and is linked from the ADRs that apply it.

← back to [[README|home]]

## Notes

- [[Trust Boundary]] — derived data is owned server-side and never accepted from the client. Applied by [[ADR-0004-trust-boundary|0004]], [[ADR-0002-owm-single-call|0002]], [[ADR-0006-frontend-live-sync|0006]].
- [[Repository Facade]] — one interface, two real implementations, dependency-injected for tests. Applied by [[ADR-0001-db-facade|0001]], [[ADR-0008-testing-strategy|0008]].
- [[Hermetic Testing]] — tests need no network and no credentials, by construction. Applied by [[ADR-0008-testing-strategy|0008]], [[ADR-0001-db-facade|0001]], [[ADR-0002-owm-single-call|0002]].
- [[Progressive Enhancement]] — runs with zero setup, upgrades when configured. Applied by [[ADR-0001-db-facade|0001]], [[ADR-0006-frontend-live-sync|0006]].
- [[Fail-Fast Config]] — validate the environment at boot and crash loudly. Applied by [[ADR-0004-trust-boundary|0004]], [[ADR-0005-error-model|0005]].

## Related

- Where these show up in the flow → [[System Map]]
- The decisions themselves → [[ADRs]]
