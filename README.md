# RentRedi — User Management API + React UI

CRUD API for users, enriched with location data (latitude, longitude, timezone)
resolved from a ZIP code via OpenWeatherMap, backed by Firebase Realtime Database
(with a zero-setup in-memory fallback), and a React frontend that demonstrates
create / read / update / delete.

## Quick start (zero setup)

```bash
npm install
cp .env.example .env      # already contains a working OpenWeatherMap key
npm start                 # http://localhost:8080
```

Open **http://localhost:8080** — the React UI is served by the same server.
By default it uses an **in-memory** store, so nothing external is required.

### Tests

```bash
npm test                         # unit/integration (Node's test runner + supertest)
npx playwright install chromium  # one-time, for e2e
npm run test:e2e                 # end-to-end (Playwright drives the real UI)
```

Both suites are hermetic: the unit tests stub `fetch`; the e2e tests run the
server with `OWM_MOCK=1` and the in-memory DB, so they need no network or keys.

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

**User shape:** `{ id, name, zip, country, lat, lon, timezone, city }`
(`timezone` is the UTC offset in seconds, as returned by OpenWeatherMap; `city`
is the resolved place name).

```bash
curl -X POST localhost:8080/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","zip":"78701"}'
# { "data": { "id": "...", "name": "Ada", "zip": "78701", "country": "US",
#             "lat": 30.2713, "lon": -97.7426, "timezone": -18000, "city": "Austin" } }
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
public/index.html          React CRUD UI (ReactFire live sync + polling fallback)
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
**ReactFire** to subscribe to the `users` node in the Realtime Database and
updates live (writes still go through the API, then RTDB pushes the change
back). Without it, the UI falls back to polling `GET /api/users`. Add to `.env`:

```bash
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
FIREBASE_PROJECT_ID=<project>
FIREBASE_APP_ID=...
FIREBASE_MESSAGING_SENDER_ID=...
```

The browser needs read access to `/users`, so set your RTDB rules accordingly
for the demo (e.g. authenticated read, or `.read: true` for a throwaway project).

## Design decisions & assumptions

- **Don't trust the client.** `id`, `lat`, `lon`, and `timezone` are never
  accepted from input — Zod schemas are `.strict()` and *reject* those fields.
  Location values come only from OpenWeatherMap; `id` is assigned by the DB.
- **In-memory default + Firebase driver behind one interface.** This is the one
  deliberate abstraction: it makes the app runnable with zero setup, keeps tests
  hermetic, and still demonstrates a real Firebase integration (two genuine
  implementations, not a speculative interface).
- **One OpenWeatherMap call.** The current-weather endpoint returns coordinates
  *and* the timezone offset together, so a single request covers all three
  derived fields.
- **`timezone` is stored as the UTC offset in seconds** (what OWM returns). The
  UI derives a readable `UTC±HH:MM` and the live clock from it.
- **ZIP defaults to country `US`** (RentRedi's market); an optional 2-letter
  `country` is accepted.
- **Failure handling:** unknown ZIP → `400`; provider 5xx/other → `502`;
  timeout (abort) → `504`; malformed/incomplete provider data → `502`. Each is
  logged with context.
- **`OWM_MOCK`** is a small, guarded test seam so the e2e suite runs offline.
- **Config in env vars**, validated at startup — a missing/invalid var crashes
  loudly instead of failing mysteriously later.

## Creative addition — live local clock per user

Each user card shows the **current wall-clock time at that user's location**,
ticking every second, computed purely from the `timezone` offset we fetched and
stored. It turns an otherwise-inert stored field into something visibly useful
and makes it obvious the location enrichment actually worked. (See
`LocalClock` in `public/index.html`.)

## Logging

Structured JSON via pino. Every request gets a child logger with a request id;
one line is logged on completion (method, path, status, duration). Validation
failures and expected client errors log at `warn`; upstream/DB/unexpected errors
log at `error` with the full error object.
