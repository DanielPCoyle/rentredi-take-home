# Deploy verification: green CI is not a healthy deploy

Passing CI proves the code builds and unit tests pass. It does **not** prove the
service boots in production. Confirm the running deployment, not just the config
or the build.

## When this applies

- After a dependency **major** bump that touches a runtime-only code path (a DB
  driver, an external SDK, anything hidden behind an injected mock in tests).
- After any change to how the app connects to Firebase / a database / a paid API
  whose real client is never exercised by CI.
- Any time you are about to report a Railway (or similar) deploy as "done".

## What broke (source of this rule)

`firebase-admin` 12→14 removed the namespaced API (`admin.credential`,
`admin.apps`, `admin.database()`). Every CI check passed — build, test,
coverage, Playwright, CodeQL — because the firebase tests inject a fake `admin`
and CI has no real credentials. The server still crashed at boot in production
(`Cannot read properties of undefined (reading 'cert')`) and returned 502. The
branch had *never* actually run; production had been served from manual
`railway up` images the whole time, masking the breakage.

## Required actions

1. **CI green ≠ deployable.** For a runtime-only dependency change, boot the real
   server against the real dependency (locally or in a scratch env) before
   merging — do not rely on mock-backed unit tests alone.
2. **Verify the ACTIVE deployment, not the source config.** A Railway service can
   show `source.branch=main` while the live instance is a manual `railway up`
   rollback image (`trigger=CLI`, `reason=rollback`). Check the active
   deployment's `trigger`, `commit`, and `reason` — not just that a repo/branch
   is named.
3. **Build SUCCESS is not health.** A deployment status of `SUCCESS` only means it
   built and started; poll to a terminal state AND hit a real endpoint
   (`/health` and one data endpoint) for HTTP 200 before declaring done.
4. **Keep a rollback ready.** When redeploying a branch that has never run in
   prod, know the last-good deployment id up front so recovery is one
   `deploymentRollback` call, not an investigation.
5. **A green frontend build is not a rendering app.** `vite build` succeeding
   does not mean the bundle runs. A CJS dependency (e.g. reactfire) can emit a
   runtime `require()` under the rolldown bundler that throws only in the
   browser. Load the built app in a real browser and check the console — and
   specifically test a **service-worker-served reload**, not just a fresh load:
   the SW changes module-eval order and surfaces crashes a first paint hides
   (this is how a "blank screen after hard refresh" slips past CI).
6. **A PWA deploy strands returning visitors on asset-hash changes.** When the
   asset hashes change, an old service worker can serve a stale shell that
   references now-404 chunks. `registerType: "autoUpdate"` self-heals within a
   reload, but verify a returning-visitor (SW-controlled) load actually recovers
   before calling a deploy done.
7. **The Railway CLI log-stream timing out is NOT a failed deploy.** `railway up -c`
   (and `--detach`) can drop the log stream with `reqwest error / operation timed
   out` while the build + deploy proceed normally server-side. Never treat the CLI
   exit as the deploy verdict. Confirm the real outcome with `railway status` /
   `railway logs --deployment` (look for the container's own start line — e.g.
   `serving … on 0.0.0.0:$PORT`), then hit the generated domain for HTTP 200 AND
   load it in a real browser with a clean console. Also: a Railway `status`
   snapshot taken seconds after upload can show `deploymentStopped:true` with empty
   `instances` before the container settles — re-poll rather than concluding failure.
8. **Hosting the Understand-Anything dashboard statically:** build the dashboard
   package with `vite build --config vite.config.demo.ts --base=/` (demo mode skips
   the localhost token gate and loads the graph from `${BASE_URL}knowledge-graph.json`),
   after copying the project's `.ua/knowledge-graph.json` (+ `meta.json`) into the
   package `public/`. Serve the built `dist/` with a zero-dep Node static server bound
   to `0.0.0.0:$PORT` with an SPA fallback. Restore the plugin cache's sample
   `public/knowledge-graph.json` afterward so future `/understand` runs are unaffected.
9. **A merge to `main` that never deploys — Railway "Wait for CI" gating on a
   permanently-red check.** Symptom: every GitHub-triggered deploy is created then
   goes `WAITING → SKIPPED` on its own, so prod stays on the last *manual*
   `railway redeploy --from-source` image and merges silently never ship. Cause:
   the service's deployment trigger has `checkSuites: true` (Settings → "Wait for
   CI"), so Railway gates the deploy on the **whole** GitHub check *suite* — and if
   any advisory, non-correctness check in that suite is red (here Lighthouse's
   `audit` job, ticket #972, plus GitHub `Dependabot` alert checks), the suite
   conclusion is `failure` and Railway skips **every** deploy, not just the build.
   The real quality gate is the full CI that must pass on the **PR before merge**;
   the post-merge re-gate is redundant *and* was blocking 100% of deploys. Fix:
   turn off Wait-for-CI on the trigger — GraphQL
   `deploymentTriggerUpdate(id, input:{checkSuites:false})` against
   `backboard.railway.com/graphql/v2` (the trigger id comes from
   `deploymentTriggers(projectId,environmentId,serviceId){edges{node{id checkSuites}}}`;
   auth Bearer = `~/.railway/config.json` → `.user.accessToken`, since the OAuth
   CLI leaves `.user.token` null and the skill's `railway-api.sh` can't read it).
   **Verify by a real push, not the setting alone:** a deployment that was stuck
   `WAITING` unblocks and builds the moment `checkSuites` flips false — confirm it
   reaches `SUCCESS` and hit `/health` + `GET /` on the live domain. Don't gate
   deploys on Lighthouse/Dependabot; keep them as PR feedback only.
