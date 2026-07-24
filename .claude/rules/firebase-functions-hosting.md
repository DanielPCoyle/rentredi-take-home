# Hosting the Express app on Firebase Cloud Functions

Wrapping this app's listen-free `createApp()` factory in `onRequest` is the easy
part. The friction is entirely in the Firebase toolchain + env contract. Every
item below was a real failure hit while scaffolding + emulator-verifying the
Functions deploy. Apply them before declaring a Functions deploy path working.

## 1. Couple firebase-admin ↔ firebase-functions ↔ firebase-tools

These three move together (a coupled-dependency group — see
`coupled-dependency-upgrades.md`):

- `firebase-admin` **14** peers only with `firebase-functions` **≥ 7**
  (`firebase-functions` 6.x allows admin `^11||^12||^13`, NOT 14).
- `firebase-functions` **7** removed `functions.config()`, which the emulator in
  `firebase-tools` **< 14** still trips over — the function dies at load with
  `Failed to load function` / `Your function was killed because it raised an
  unhandled error`. Use `firebase-tools` **≥ 14** (pin it as a devDep and run
  `npx firebase`, don't rely on an old global CLI).

Do not downgrade `firebase-admin` to 13 to use `firebase-functions` 6 — admin was
deliberately on 14. Move the whole group forward instead.

## 2. `.env` reserved-key rejection (FIREBASE_*, GOOGLE_*, GCLOUD_*)

`firebase-functions` **refuses to load any `.env` file that contains a
reserved-prefix key** (`FIREBASE_*`, `GOOGLE_*`, `GCLOUD_*`, `EXT_*`, `K_*`, …),
failing with `Failed to load environment variables from .env`. This app's
`src/config.js` reads exactly those names (`FIREBASE_DATABASE_URL`,
`FIREBASE_API_KEY`, …) and the local dev `.env` sets them.

Consequences and required behavior:

- **Never put `FIREBASE_*`/`GOOGLE_*` keys in a functions `.env`/`.env.<project>`.**
  The function entry (`index.js`) takes config through a **secret + NON-reserved
  params** (`OWM_API_KEY`, `RTDB_URL`, `WEB_FB_*`) and maps them into the env
  names the app expects at runtime, deriving `FIREBASE_DATABASE_URL` from the
  runtime-provided project (`GCLOUD_PROJECT`).
- **Run `firebase deploy` from a tree with NO reserved-key `.env` present** —
  deploy from CI (which has no `.env`), or move the local `.env` aside first.
  Otherwise the deploy fails to load env even though the function doesn't need
  those keys.

## 3. Emulator secrets live in `.secret.local`, not `.env.local`

A `defineSecret(...)` value in the emulator is read from `.secret.local`. Put a
secret in `.env.local` instead and the emulator tries to fetch it from Google
Cloud Secret Manager and 403s (`Secret Manager API has not been used…`), killing
the function. Non-secret `defineString` params go in `.env.local`.

## 4. `defineString` params prompt interactively when unset

An unresolved `defineString` param makes `firebase emulators:start` **prompt on
stdin** (`? Enter a string value for RTDB_URL:`), which hangs any
background/CI run. Provide every param a value (empty is fine) in `.env.local`.

## 5. Normalize `PORT` before `loadConfig()` in the function

The Cloud Functions / emulator runtime injects a **non-numeric `PORT`**, and
`src/config.js` validates `PORT` strictly (`z.coerce.number()`), so `loadConfig()`
throws `PORT: expected number, received NaN`. The function never calls `.listen()`,
so `PORT` is a don't-care there — normalize it (`if (!/^\d+$/.test(process.env.PORT)) process.env.PORT = "8080"`)
before `loadConfig()`.

## 6. Verify by BOOTING the function, not just `npm test`

Per `deploy-verification.md`: the `onRequest` wrapper is runtime-only code the
Vitest suite never exercises. Boot the **functions emulator** (local
`firebase-tools` ≥ 14, hermetic `.env.local` = `OWM_MOCK=1` + `DB_DRIVER=memory`,
`.secret.local` = `OWM_API_KEY`, `.env` moved aside) and hit `/health` + `POST
/api/users` + a trust-boundary rejection before calling the deploy path good.
The actual production deploy additionally requires the **Blaze** plan.

## 7. Never commit emulator scratch / secrets

`.env.local`, `.secret.local`, and `.firebase/` are emulator scratch and may hold
secrets — keep them git-ignored. Restore the real `.env` after emulator runs.

## 8. A non-zero `firebase deploy` exit can leave Hosting un-finalized

On a first combined `firebase deploy`, the post-functions **Artifact Registry
cleanup-policy** step prompts and, unattended, makes the whole command exit
**non-zero** — which can abort before the Hosting **release** is finalized. Symptom:
the function is live, but `https://<project>.web.app` serves Firebase's **"Site
Not Found"** page indefinitely (not normal propagation — `hosting:channel:list`
shows a `live` release yet the domain 404s). Fixes:

- Pre-empt the prompt: run `firebase deploy --force`, or set the policy first with
  `firebase functions:artifacts:setpolicy --force`.
- If Hosting is already stuck on "Site Not Found" with a release present, re-run
  `firebase deploy --only hosting` — it finalizes + releases cleanly (exit 0) and
  the `.web.app` domain serves within a minute.

Verify the live site by loading `https://<project>.web.app` in a real browser
(SPA from the CDN + `/api/**` rewrite to the function) with a clean console —
not just the direct `…cloudfunctions.net/api` URL, which only proves the function.
