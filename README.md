# RentRedi — User Management API + React UI

This project is a take-home exercise: a small user-management service built to
production standards rather than as a throwaway demo. The brief is deliberately
simple — create, read, update, and delete users — but the point is *how* it's
built: a clean layered API, a real third-party integration (a ZIP code is turned
into coordinates and a timezone via OpenWeatherMap, and is only re-fetched when
the ZIP actually changes), strict input validation that never trusts
client-supplied location data, graceful handling of external-service failures,
structured logging, an automated test suite with coverage, and a React front-end
wired to the whole thing. It runs locally with zero setup (in-memory store) and
upgrades to Firebase Realtime Database with live UI sync when configured — so the
same codebase demonstrates both a frictionless review and a production path.

CRUD API for users, enriched with location data (latitude, longitude, timezone)
resolved from a ZIP code via OpenWeatherMap, backed by Firebase Realtime Database
(with a zero-setup in-memory fallback), and a React frontend that demonstrates
create / read / update / delete.

## Requirements coverage

> **Live demo:** <https://rentredi-sandbox-production.up.railway.app> · **Local:** `http://localhost:8080`

Where each requirement from the brief is met in the code:

| # | Requirement | Status | Where |
|---|-------------|--------|-------|
| 1 | CRUD endpoints | ✅ | `src/routes/userRoutes.js` — `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` (201 / 200 / 200 / 200 / 204) |
| 2 | Save users in a noSQL DB (**bonus: Firebase RTDB**) | ✅ **+ bonus** | `src/db/firebase.js` (`firebase-admin` RTDB), selected by `DB_DRIVER`; zero-setup in-memory default in `src/db/memory.js` |
| 3 | Fields: `id, name, zip, latitude, longitude, timezone` | ✅ | `src/services/userService.js` → `{ id, name, zip, country, lat, lon, timezone, timezoneName, city, createdAt, updatedAt }` |
| 4 | Create takes name + zip; fetch lat/lon/timezone from OpenWeatherMap | ✅ | `createUserSchema` (name, zip, country?); `src/services/locationService.js` calls the **current-weather** endpoint (`/data/2.5/weather`) — coordinates *and* timezone in one request |
| 5 | Update re-fetches lat/lon/timezone **only if the ZIP changes** | ✅ | `src/services/userService.js` — the `zipChanged` gate; a test asserts the external-call count stays flat on a name-only edit |
| 6 | Connect a ReactJS front-end | ✅ | Vite + React app in `web/`, served by Express; full CRUD via `web/src/api.js` |
| ★ | *“add something creative”* | ✅ | A live **per-user local clock** (`web/src/components/LocalClock.jsx`) ticking from the stored zone; plus a 3D globe, an installable offline PWA, GA4 analytics, light/dark theming, and a Vitest (~92%) + Playwright suite |

Two deliberate, documented choices:

- **Coordinates are stored as `lat` / `lon`** — the data required by #3 under conventional short keys rather than `latitude` / `longitude`. See [External integration](#external-integration-one-openweathermap-call).
- **The default store is in-memory** (ephemeral, so `npm start` needs zero setup and the tests stay hermetic); persistence — the noSQL bonus — is opt-in via `DB_DRIVER=firebase`. See [Data layer](#data-layer-in-memory-default-firebase-behind-one-interface) and the Firebase section below.

## Quick start

```bash
npm install               # backend deps
cp .env.example .env      # already contains a working OpenWeatherMap key
npm run build             # installs web deps + builds the Vite frontend -> web/dist
npm start                 # http://localhost:8080  (Express serves API + built UI)
```

Open **http://localhost:8080**. By default it uses an **in-memory** store, so
nothing external is required.

### Frontend dev (hot reload)

The UI is a **Vite + React** app in `web/`. For iterative work, run the backend
and Vite dev server side by side (Vite proxies `/api` → `:8080`):

```bash
npm run dev        # terminal 1: backend on :8080 (nodemon)
npm run web:dev    # terminal 2: Vite dev server on :5173 (open this one)
```

### Tests

```bash
npm test                         # backend unit/integration (Vitest + supertest)
npm run coverage                 # same suite + v8 coverage report over src/

npm run web:install              # one-time: web deps for the e2e build
npx playwright install chromium  # one-time: e2e browser
npm run test:e2e                 # end-to-end (Playwright builds the UI + drives it)
```

Both suites are hermetic: the unit tests stub `fetch` (and inject a fake
`firebase-admin` into the RTDB driver); the e2e tests run the server with
`OWM_MOCK=1` and the in-memory DB, so they need no network or keys.

Coverage is **~92% of statements** across `src/` (the bootstrap entry is
excluded). The Firebase driver is unit-tested via an injected in-memory
`firebase-admin` fake, and also verified end-to-end against a live RTDB.

## API

Base path `/api/users`. Success envelope `{ "data": ... }`; error envelope
`{ "error": { "code", "message", "details"? } }`.

| Method | Path              | Body                          | Success | Notes |
|--------|-------------------|-------------------------------|---------|-------|
| POST   | `/api/users`      | `{ name, zip, country? }`     | 201     | Fetches lat/lon/timezone from OpenWeatherMap |
| GET    | `/api/users`      | —                             | 200     | List all |
| GET    | `/api/users/:id`  | —                             | 200     | 404 if missing |
| PUT    | `/api/users/:id`  | `{ name?, zip?, country? }`   | 200     | Re-fetches location **only if ZIP/country changed** |
| DELETE | `/api/users/:id`  | —                             | 204     | 404 if missing |

**Status codes:** `400` validation / unknown ZIP · `404` not found ·
`502` provider error · `504` provider timeout · `500` unexpected.

**User shape:** `{ id, name, zip, country, lat, lon, timezone, timezoneName, city, createdAt, updatedAt }`
(`timezone` is the UTC offset in seconds as returned by OpenWeatherMap — a
point-in-time value; `timezoneName` is the DST-safe IANA zone; `city` is the
resolved place name; `createdAt` / `updatedAt` are ISO-8601 timestamps).

```bash
curl -X POST localhost:8080/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","zip":"78701"}'
# { "data": { "id": "...", "name": "Ada", "zip": "78701", "country": "US",
#             "lat": 30.2713, "lon": -97.7426, "timezone": -18000,
#             "timezoneName": "America/Chicago", "city": "Austin",
#             "createdAt": "2026-07-21T20:00:00.000Z", "updatedAt": "2026-07-21T20:00:00.000Z" } }
```

## Architecture

Layered, one responsibility per module:

```
route → validate (zod) → controller (try/catch) → service → { db driver | location service }
                                                        ↘ central error handler → JSON envelope
```

```
src/
  index.js                 bootstrap: load config, init db, listen
  app.js                   express app factory (no .listen → testable)
  config.js                env → validated config (zod); fails fast on bad config
  logger.js                pino structured logger
  errors.js                AppError / ValidationError / NotFoundError / UpstreamError
  db/
    index.js               driver facade (memory | firebase)
    memory.js              in-memory Map (default, hermetic)
    firebase.js            firebase-admin Realtime Database (the bonus)
  services/
    locationService.js     ZIP → { lat, lon, timezone, city }; graceful OWM failures
    userService.js         CRUD orchestration; only refetches location on ZIP change
  controllers/userController.js
  routes/userRoutes.js
  schemas/userSchemas.js   zod body/param schemas (.strict → rejects untrusted fields)
  middleware/
    validate.js  requestLogger.js  errorHandler.js
web/                       Vite + React frontend (built to web/dist, served by Express)
  vite.config.js           dev server + /api proxy → :8080
  src/
    App.jsx                fetches /api/config → live (ReactFire) or polling source
    live.jsx               ReactFire providers + live RTDB subscription (code-split)
    components/            UserManager, UserCard, LocalClock (the live-clock addition)
    api.js  util.js  styles.css
test/users.test.js         unit/integration suite
e2e/users.spec.js          Playwright e2e suite
```

## Firebase Realtime Database (bonus) — optional

The in-memory driver is the default so the app runs with no setup. To use
Firebase, set these in `.env` and restart:

```bash
DB_DRIVER=firebase
FIREBASE_DATABASE_URL=https://<project>-default-rtdb.firebaseio.com
FIREBASE_SERVICE_ACCOUNT=./service-account.json   # path or inline JSON
```

`db/firebase.js` uses the real `firebase-admin` Realtime Database API
(`push`/`set`/`once`/`update`/`remove`) — the same interface as the in-memory
driver, so nothing else changes.

### Live UI sync with ReactFire (optional)

When the **public web** Firebase config is also provided, the frontend uses
**ReactFire** (`web/src/live.jsx`, code-split so polling mode never loads the
Firebase SDK) to subscribe to the `users` node in the Realtime Database and
update live — writes still go through the API, then RTDB pushes the change back.
Without it, the UI falls back to polling `GET /api/users`. Add to `.env`:

```bash
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
FIREBASE_PROJECT_ID=<project>
FIREBASE_APP_ID=...
FIREBASE_MESSAGING_SENDER_ID=...
```

The browser needs read access to `/users`; `database.rules.json` already grants
public read for the demo (client writes are denied — the admin SDK bypasses
rules and owns all writes). Deploy it with `firebase deploy --only database`.

## Decisions Explained

A walkthrough of the significant choices in this codebase, the reasoning behind
them, and the alternatives that were rejected. The same decisions — plus
forward-looking ADRs and a daily build log — are also captured as a linked
knowledge base under [`knowledge-base/`](knowledge-base/README.md).

### Data layer: in-memory default, Firebase behind one interface

The brief asked for a noSQL store (bonus for Firebase Realtime Database) *and*
that the project run locally without unspecified setup. Those pull in opposite
directions — Firebase needs a project and credentials. The resolution is a small
**repository facade** (`src/db/index.js`) over two real implementations: an
in-memory `Map` (`memory.js`, the default) and a `firebase-admin` RTDB driver
(`firebase.js`), selected by `DB_DRIVER`. This is the *one* deliberate
abstraction in the codebase — justified because there are genuinely two
implementations, not a speculative interface-for-one. It makes `npm start` work
with zero setup, keeps the tests hermetic, and still delivers the real Firebase
bonus. The driver also accepts an injectable `admin` argument purely so it can be
unit-tested without a live project (see *Testing*).

### External integration: one OpenWeatherMap call

The **current-weather endpoint** (the one in the linked docs) was chosen because
a single request returns `coord.lat`, `coord.lon`, *and* `timezone` — all three
derived fields at once. The geocoding endpoint would have returned coordinates
but not the timezone, forcing a second call. `timezone` is stored exactly as OWM
returns it — the **UTC offset in seconds** — and the UI derives the readable
`UTC±HH:MM` label and the live clock from it, keeping one source of truth. The
client uses the platform-native `fetch` with an `AbortController` timeout rather
than adding an HTTP-client dependency (Node 18+ ships `fetch`).

### Refetch only when the ZIP changes

On update, location is re-resolved only when the ZIP (or optional country)
actually changes; otherwise the stored coordinates are kept
(`src/services/userService.js`). This satisfies the requirement literally and
avoids spending an external call — and a rate-limit slot — on every name edit. A
dedicated test asserts the external call count stays flat on a name-only update
and increments by exactly one on a ZIP change.

### Trust boundary: never trust client location data

`id`, `lat`, `lon`, and `timezone` are derived server-side and must never come
from the client. The Zod request schemas are `.strict()`, so those fields are
actively *rejected* (`400`) rather than silently stripped — a stronger, more
honest guarantee. Location comes only from OpenWeatherMap; `id` is assigned by
the database. Configuration is validated with Zod at startup too, so a missing or
malformed variable crashes loudly at boot instead of surfacing later as a
confusing runtime error.

### Error handling: typed errors + one central handler

Each async controller has an explicit `try/catch` that forwards to a **central
error handler** (`src/middleware/errorHandler.js`). Errors are typed
(`ValidationError`, `NotFoundError`, `UpstreamError`) carrying their HTTP status
and a stable machine `code`, so every failure becomes one consistent JSON
envelope (`{ error: { code, message, details? } }`) without each controller
re-deciding status codes. OpenWeatherMap failures are mapped deliberately:
unknown ZIP → `400` (bad client input), provider 5xx/other → `502`, timeout →
`504`, incomplete data → `502`. Expected client errors log at `warn`;
upstream/unexpected errors log at `error` with the full stack. Logging is
structured JSON via **pino**, with a per-request child logger (see *Logging*).

### Frontend: from CDN prototype to Vite; ReactFire with a polling fallback

The frontend began as a single no-build HTML file (React via CDN) to honor "runs
with zero setup." When ReactFire was added for live Realtime Database reads, it
was migrated to a proper **Vite + React** app — ReactFire's natural habitat, with
real dependencies, native JSX, and no CDN module-singleton fragility. The key
rule is that **reads and writes take different paths**: writes always go through
the API (so the server keeps ownership of location enrichment, validation, and
the trust boundary), while reads are live via ReactFire's RTDB subscription *when
Firebase is configured* and fall back to API polling otherwise. That fallback is
what keeps the app runnable — and the E2E suite green — without a Firebase
project. ReactFire/Firebase are **code-split** so the polling path never
downloads the Firebase SDK, and `firebase` is pinned to **v9** because
reactfire@4 peers on it.

### Firebase provisioning: ADC over key files, least-privilege rules

For the live path, the backend authenticates with **Application Default
Credentials** (`gcloud auth application-default login`) instead of a downloaded
service-account JSON — so no long-lived secret file lives in the repo or on disk.
The Realtime Database rules (`database.rules.json`) grant **public read of
`/users`** (what ReactFire needs) and **deny all client writes** — writes only
succeed through the admin SDK, which bypasses rules, keeping every mutation on the
validated API path. The default RTDB instance was provisioned over the Management
REST API because the CLI required an interactive `firebase init database`; the
same ADC token plus a quota-project header scripted it end to end.

### Testing: Vitest coverage, hermetic by construction

The suite runs on **Vitest** with v8 coverage (~92% of `src/`). It's hermetic:
unit tests stub `global.fetch`, and an `OWM_MOCK` env seam lets the offline
Playwright E2E run without hitting OpenWeatherMap. The Firebase driver is the one
piece that touches an external SDK, so `createFirebaseDb` takes an **injectable
`admin`** — an in-memory fake is passed in to exercise its full CRUD + credential
mapping without a live project (Vitest's module mocker couldn't intercept the
driver's lazy `require`, and dependency injection is both cleaner and more
explicit). The bootstrap entry `src/index.js` is excluded from coverage — it only
wires config and starts the listener.

### What was deliberately left out

Scope was kept to the brief. There is no authentication, rate limiting,
pagination, or caching layer — none were required, and adding them would be
speculative complexity for a take-home. The codebase leans on the single
deliberate abstraction (the DB driver) and otherwise favors the smallest code
that reads clearly.

### What's next (production hardening)

The intake review turned that "left out" list into concrete next steps:

- **Auth-gate reads.** The demo grants public read of `/users`; production would
  require an authenticated identity to read (writes are already admin-only).
- **Pagination.** `GET /api/users` returns the full list; add limit/cursor paging
  before the dataset grows.
- **Rate-limiting.** Protect the API and the upstream OpenWeatherMap budget with a
  per-IP/token limiter. (A 10 KB request-body cap is already in place.)
- **Caching.** Cache resolved ZIP→location lookups so repeats skip the external
  call, complementing the refetch-only-on-change rule.

Each is intentionally deferred until there's real traffic to size limits and TTLs
against.

### Assumptions

- **Country defaults to `US`** (RentRedi's market); an optional 2-letter ISO
  `country` is accepted and, when changed, also triggers a location refetch.
- **ZIP format** is validated as a US 5-digit or ZIP+4 code.
- **Demo RTDB rules are read-open.** Public `/users` read is fine for a demo; a
  real deployment would gate reads behind auth.
- **The OpenWeatherMap key** shipped in `.env.example` came with the assignment;
  in production it would be a managed secret, never committed.

## Creative addition — live local clock per user

Each user card shows the **current wall-clock time at that user's location**,
ticking every second, computed purely from the `timezone` offset we fetched and
stored. It turns an otherwise-inert stored field into something visibly useful
and makes it obvious the location enrichment actually worked. (See
`web/src/components/LocalClock.jsx`.)

## Logging

Structured JSON via pino. Every request gets a child logger with a request id;
one line is logged on completion (method, path, status, duration). Validation
failures and expected client errors log at `warn`; upstream/DB/unexpected errors
log at `error` with the full error object.
