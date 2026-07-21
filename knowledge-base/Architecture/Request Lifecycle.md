---
title: Request Lifecycle
tags: [architecture, backend, request-flow]
created: 2026-07-21
---

# Request Lifecycle

Three traces through the same layered path: a `POST` that resolves location
from scratch, a `PUT` that skips the external call when the ZIP hasn't
changed, and the error path when something goes wrong at any stage.

## POST /api/users {name, zip} — end to end

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as express.json / compression / requestLogger
    participant V as validate(createUserSchema)
    participant Ctrl as userController.create
    participant Svc as userService.create
    participant Loc as locationService.resolveLocation
    participant OWM as OpenWeatherMap
    participant DB as db facade

    C->>MW: POST /api/users {name, zip}
    MW->>V: body parsed; req.id + child logger attached
    V->>V: createUserSchema.strict().parse(body)
    alt invalid or unknown field (id/lat/lon/timezone)
        V-->>C: next(ZodError) -> errorHandler -> 400
    else valid
        V->>Ctrl: req.body (trusted)
        Ctrl->>Svc: userService.create(req.body)
        Svc->>Loc: resolveLocation(zip, country, config)
        Loc->>OWM: GET /weather?zip=..&appid=.. (fetch + AbortController timeout)
        OWM-->>Loc: 200 {coord, timezone} | 404 | 5xx/other | timeout
        alt OWM failure
            Loc-->>Ctrl: throws ValidationError / UpstreamError
            Ctrl-->>C: next(err) -> errorHandler -> 400 / 502 / 504
        else OWM success
            Loc-->>Svc: {lat, lon, timezone, timezoneName, city}
            Svc->>DB: db.create({name, zip, country, ...record})
            DB-->>Svc: user (id assigned by driver)
            Svc-->>Ctrl: user
            Ctrl-->>C: 201 {data: user}
        end
    end
```

Numbered version of the same trace:

1. `express.json()` parses the body; `compression()` will gzip the eventual response.
2. `requestLogger` attaches `req.id` (from `x-request-id` or a fresh UUID) and a pino child logger; logs `"request received"`.
3. `routes/userRoutes.js` runs `validate({ body: createUserSchema })` — the zod schema is `.strict()`, so `{ name, zip, country? }` is accepted and any other field (`id`, `lat`, `lon`, `timezone`) is **rejected with 400**, not stripped. The parsed value replaces `req.body`.
4. `userController.create` — inside `try`, calls `userService.create(req.body)`.
5. `userService.create` calls `resolveLocationFor({ zip, country })`, defaulting `country` to `config.owm.defaultCountry` when absent.
6. `locationService.resolveLocation(zip, countryCode, config)`:
   - builds the OWM current-weather URL and fires it via native `fetch` wrapped in an `AbortController` that aborts after `OWM_TIMEOUT_MS`;
   - OWM `404` → `ValidationError` (400, unknown ZIP — a client-input problem);
   - other non-`ok` (401/429/5xx) → `UpstreamError` (502);
   - `AbortError` (timeout) → `UpstreamError` (504);
   - `200` with missing `coord.lat`/`coord.lon`/`timezone` → `UpstreamError` (502, incomplete data);
   - on success, derives the IANA zone name from the coordinates via `tz-lookup` (best-effort — `null` on failure) and returns `{ lat, lon, timezone, timezoneName, city }`.
7. `userService.create` calls `db.create({ name, zip, country, ...record })` — the active driver (in-memory `Map` or Firebase RTDB) assigns `id`.
8. Logs `"user created"`; returns the user record.
9. Controller responds `201 { data: user }`.
10. `requestLogger`'s `res.on("finish")` logs `"request completed"` with method/path/status/duration.

## PUT /api/users/:id — refetch only on ZIP/country change

From `userService.update` (`src/services/userService.js`):

1. `validate({ params: userIdParamSchema, body: updateUserSchema })` — the body is a partial, still `.strict()`, and must contain at least one field.
2. `userController.update` → `userService.update(id, patch)`.
3. Loads `existing = db.get(id)`; if missing, throws `NotFoundError` (404).
4. Computes `nextZip = patch.zip ?? existing.zip` and `nextCountry = patch.country ?? existing.country`, then `zipChanged = nextZip !== existing.zip || nextCountry !== existing.country`.
5. **If `zipChanged`** → calls `resolveLocationFor` again (the same OWM path as create), merges the fresh `{ lat, lon, timezone, timezoneName, city }` plus the normalized `zip`/`country` into the patch, and logs `"zip changed — refetched location"`.
6. **Else** → skips the location call entirely and logs `"zip unchanged — skipping location fetch"`. A name-only edit costs zero external calls.
7. `db.update(id, next)` persists the merged record; controller responds `200 { data: user }`.

See [[ADR-0003-refetch-on-change]] for why this is the rule rather than always
refetching.

## Error path

1. Any stage can produce a failure: a `ZodError` from `validate`, or a typed
   error (`ValidationError`, `NotFoundError`, `UpstreamError`) thrown from the
   service/location layer, or an unexpected exception.
2. `validate.js` forwards a `ZodError` directly via `next(err)` — it never
   reaches the controller. Controllers catch everything else in their
   `try/catch` and forward the same way.
3. Express skips all remaining middleware and lands in the central
   `errorHandler` (`src/middleware/errorHandler.js`).
4. `errorHandler` maps the error to one JSON envelope:
   - `ZodError` → `400 { error: { code: "VALIDATION_ERROR", message, details: [{ path, message }] } }`, logged at `warn`.
   - `AppError` subclass → status/code read off the error itself (`ValidationError` 400, `NotFoundError` 404, `UpstreamError` 502/504); `expected` errors (status `< 500`) log at `warn`, everything else logs at `error` with the full error/stack.
   - anything else (unexpected bug) → `500 { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } }`, logged at `error` — internals are never leaked to the client.
5. `requestLogger`'s `finish` handler still logs the final status/duration, regardless of outcome.

## Related

- [[ADR-0003-refetch-on-change]] — why PUT only refetches on ZIP/country change
- [[ADR-0005-error-model]] — the typed-error + central-handler design traced above
- [[ADR-0002-owm-single-call]] — why one OWM call yields lat/lon/timezone together
- [[System Map]] — the module map this trace runs through

← back to [[Architecture]]
