# Production E2E verification

Running the e2e suite against the *deployed* app is different from running it
against a local hermetic build. Most "production is broken" conclusions from a
red prod run are actually environment races or stale-cache artifacts. Prove the
distinction before reporting a prod bug.

## When this applies

- Any request to "e2e test production" / verify a live deploy end to end.
- Any time `playwright test` is pointed at a real deployment instead of the
  local `webServer`.

## 1. A red prod spec is not proof of a prod bug

Symptom hit here: all 3 CRUD tests failed against prod at
`page.locator(".location-select__option").first().click()` — looking exactly
like a broken autocomplete. The endpoint was fine (`/api/locations/suggest`
returned 200 with 5 options). The real cause: the spec starts interacting the
instant the `Users` heading appears, while the app is still rendering (globe
chunk + user data land late). The late render **wipes the react-select input** —
polling showed `inputVal: ""` after `pressSequentially("Austin")`.

**Required behavior:** before concluding the app is broken, poll the actual DOM
state at the failure point (input value, option count, focus) and check the
network tab for the relevant request. Distinguish these three, in order:

1. **Test race** — the app works, the test interacted too early. Fix the test.
2. **Stale cache/SW** — an old shell is being served. Reload and re-check.
3. **Real prod defect** — reproduces on a settled, freshly-loaded page.

**Settle before interacting** when driving a real deployment:

```js
await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
await page.waitForLoadState("networkidle");
await expect(page.locator(".card").first()).toBeVisible();
await page.waitForTimeout(1500); // let the late globe/data render settle
```

With that added, all 4 flows pass against production unchanged.

## 2. A first load can be a STALE service worker, not the current build

The first prod page load 404'd `assets/Globe-DxqR7axG.js`. That hash is **not**
in the current deploy — `index.html` and `sw.js` both reference
`Globe-B_dxhONk.js` (200). An old SW was serving a previous shell.

**Required:** when a hashed chunk 404s, diff the requested hash against what the
live `index.html` / `sw.js` actually reference before filing a build bug. Then
verify the returning-visitor path self-heals (it did here — one reload restored
the current shell; `registerType: "autoUpdate"` works). Also confirm which build
is live: prod's `/api/config` returned `sentryDsn`, which the current branch's
`src/app.js` does not emit — **prod was not running this branch.** Always
establish that before attributing behavior to local code.

## 3. Test the error envelope at the infrastructure boundary, not just Zod

Zod-validated cases all returned correct 400s, but errors thrown *before* the
route (by `express.json`) fell through to a generic 500:

- body > `10kb` limit → **500**, should be 413
- malformed JSON → **500**, should be 400

`errorHandler` only recognizes `ZodError` and `AppError`; body-parser throws a
plain `PayloadTooLargeError`/`SyntaxError` carrying `err.status`/`err.statusCode`.
These are also logged at `log.error` ("unexpected error"), so client-caused noise
pollutes Sentry.

**Required:** any e2e sweep must include oversized-body and malformed-JSON cases,
and `errorHandler` must pass through `err.status || err.statusCode` when present
before falling back to 500.

## 4. Offline changes the FORM, not just the transport — drive the right fields

Going offline swaps the create form: the autocomplete is replaced by a manual
**ZIP + country** fallback (suggestions need the network), and `create()` branches
on `online` to require `form.zip` instead of `form.locationOption`.

A sweep that picks a location from the autocomplete *while online* and then goes
offline is driving a path that **cannot succeed by design** — the swapped-in ZIP
field is empty. This produced a false "offline create is silently broken" report.

**Required:** when testing an offline flow, re-read the form after the
connectivity flip and fill what is actually rendered. Verify offline create
end-to-end — queue entry → survives reload → replay on reconnect → server state
via `GET /api/users`. An optimistic UI row is not proof of a write.

## 5. Headless cannot see native form validation — never infer "silent failure"

The false report above survived one round of investigation because the submit
produced **no app error and no card**. The cause was native HTML5 validation:
`web/src/components/UserManager.jsx` marks the ZIP input `required={!online}`, so
the browser blocks submit and `onSubmit={create}` **never runs**. Headless Chrome
does not paint the native validation tooltip, so it looked like a silent no-op.

**Required:** before reporting "clicking X does nothing / fails silently", check
all three:

```js
el.checkValidity()        // false => native validation is blocking
el.validationMessage      // the text a real user is shown
form.addEventListener("submit", ..., true)  // did the handler even fire?
```

Then confirm in a **headed** browser. In this case a real Chrome focused the ZIP
field and showed "Please fill out this field." — the user was never without
feedback. Note the corollary defect this exposed: any `setError(...)` branch
guarded by a native `required` attribute is **unreachable dead code**.

## 6. Testing prod mutates prod — clean up and say so

This run created/renamed real users in the production RTDB. Record every id
created and every record mutated, restore originals, and verify the final list
matches the pre-run state. State explicitly in the report what was written and
that it was reverted.
