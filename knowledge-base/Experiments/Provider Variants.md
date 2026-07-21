---
title: Provider Variants
tags: [experiment, provider, owm, google-places, worktree]
created: 2026-07-21
---

# Provider Variants

Two location-provider implementations of the same take-home, built on separate
branches so they could be compared side by side rather than argued about in
the abstract.

## The two variants

**`main` — OpenWeatherMap-only.** ZIP (+ optional country) → OWM's
current-weather endpoint → `{ lat, lon, timezone, city }`, with the IANA zone
name derived offline from the coordinates via `tz-lookup`. This is the
provider covered in [[System Map]] / [[Request Lifecycle]]. Confirmed by
`ae534b7 feat(owm-only): remove Google Places — OpenWeatherMap-only provider`,
which deleted the Places controller/routes/schemas/service and
`AddressAutocomplete.jsx`, dropped `GOOGLE_MAPS_API_KEY` from config, and made
`zip` required again in the schemas.

**`feat/google-only` — Google-Places-only.** A single autocomplete input
(city or ZIP) resolves to a Google `placeId`; the backend resolves that
`placeId` server-side via Places Details (coordinates never come from the
client), with `tz-lookup` again deriving the timezone. Because a city result
has no postal code of its own, the coordinates are **reverse-geocoded** to a
representative ZIP so cards can still show one (`3c7e64d feat(places): show a
ZIP for cities`). The refetch trigger changed accordingly — updates refetch
location on a **new `placeId`**, not a ZIP diff — and `createUserSchema` /
`updateUserSchema` accept `placeId` instead of `zip`. Confirmed by `fc538b4
feat(google-only): remove OpenWeatherMap — Google-Places-only provider`:
"userService/schemas: placeId-only create; update refetches on new placeId."

Both variants share the same layered core (routes → validate → controller →
service → db) — only the provider seam, the request schema, and the
create/edit form differ.

## Isolated git worktrees

Built as **isolated git worktrees**, not branch-switching on one checkout:

| Working tree | Branch |
|---|---|
| `rentredi-sandbox` | `main` |
| `rentredi-google-only` | `feat/google-only` |
| `rentredi-sandbox-seo` | `feat/seo-aeo` |

This let both providers be built, run, and tested at the same time without
churn from switching branches mid-comparison — and doubled as a way to view
the SEO/AEO work ([[SEO and AEO]]) alongside the provider question, since it
touches largely disjoint files.

## Tradeoffs

| | OpenWeatherMap (`main`) | Google Places (`feat/google-only`) |
|---|---|---|
| Credentials | Key came with the assignment — zero extra setup | Needs a Google API key + billing enabled on GCP |
| Input model | ZIP-first (+ optional country) | Place-first — single autocomplete input, city or ZIP |
| Calls needed | **One** call returns coordinates *and* timezone offset | Places Details for the place, plus a reverse-geocode call to surface a ZIP for city results |
| Source of truth | The weather endpoint doubles as location-truth | Places Details is location-truth; ZIP is a derived display field |
| UX | Two plain inputs (ZIP + country dropdown) | Nicer autocomplete UX — one input, type-ahead suggestions |

## Outcome

**OWM-only was chosen for `main`.** One request already returned everything
needed (coordinates + timezone), it required no additional credentials beyond
what shipped with the assignment, and it kept the trust-boundary story simple
(one upstream, one failure-mapping table). See [[ADR-0002-owm-single-call]]
for the accepted decision and rejected alternatives. `feat/google-only` was
kept as a documented, working alternative rather than merged — **formally
archived as a variant** per [[ADR-0011-merge-experiment-branches]] (intake
survey, 2026-07-21), which preserves OWM-only on `main`.

## Related

- [[ADR-0002-owm-single-call]] — the accepted decision this experiment fed
- [[ADR-0011-merge-experiment-branches]] — the branch-fate decision (archive google-only)
- [[Experiments]] — the worktree index
- [[SEO and AEO]] — the other worktree experiment run alongside this one
- [[2026-07-21]]

← back to [[Experiments]]
