---
title: Architecture
type: index
tags: [moc, architecture]
created: 2026-07-21
---

# 🏗️ Architecture

How the pieces fit and how a request flows through them.

← back to [[README|home]]

## Notes

- [[System Map]] — the layered module map, responsibilities, and the data-source split (live vs polling).
- [[Request Lifecycle]] — one `POST /api/users` traced end to end, through validation, service, location enrichment, and the error envelope.

## The shape in one line

```
route → validate (zod) → controller (try/catch) → service → { db driver | location service }
                                              ↘ central error handler → JSON envelope
```

## Related

- Why it's shaped this way → [[ADRs]]
- The patterns behind it → [[Concepts]]
