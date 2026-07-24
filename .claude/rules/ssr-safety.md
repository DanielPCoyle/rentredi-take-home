# SSR safety: no browser globals at render time

`GET /` is server-rendered (Vite `--ssr` build → `renderToString(<App/>)` in
`web/src/entry-server.jsx`, injected into the `<!--ssr-outlet-->` marker by
`src/app.js`). The server has **no `window`, `document`, `localStorage`, or
`navigator`**. Any component that touches those *during render* (function body,
or a `useState`/`useMemo` initializer) throws `ReferenceError: document is not
defined` and the whole page 500s — CI never catches it because the Vitest suite
and Playwright both run the client bundle, not the SSR entry.

## When this applies

Editing or adding **any** React component/hook under `web/src/` that reads a
browser global, and anything that changes what `entry-server.jsx` renders.

## Required behavior

1. **Never read a browser global at render time.** Move it into `useEffect`
   (client-only), or guard with `typeof window !== "undefined"`. The canonical
   fix is `ThemeToggle.jsx`: it starts from a fixed default and reads
   `document.documentElement.dataset.theme` in `useEffect` on mount.
2. **Server render and first client render must produce identical output** or
   hydration mismatches. So the *initial* state must not depend on a
   client-only value — default it (e.g. `useState("light")`), then reconcile in
   `useEffect`. For external stores use `useSyncExternalStore` with a
   `getServerSnapshot` (see `useOnlineStatus.js`, which returns `true` on the
   server).
3. **Keep dynamic/non-deterministic UI as client-only islands** that render a
   stable placeholder on the server: the WebGL globe (interaction-gated →
   loader), the live Firebase list (`live.jsx`, gated → polled/loading view),
   ticking `LocalClock`s (only inside user cards, absent on the first shell
   render). Do not make these render real content on the server — the loading
   shell is what must match.
4. **React 19 attribute casing** is enforced in SSR output: use `fetchPriority`,
   not `fetchpriority`, etc. A lowercase DOM attribute warns and (for some)
   won't serialize as intended.
5. **Stable IDs across server/client.** Pass explicit `id`/`instanceId` to
   libraries that auto-generate ids (e.g. `react-select` in `LocationSelect.jsx`
   gets `instanceId`), or their random ids differ per environment and mismatch.

## Verify before completion

`npm test` and a Playwright run don't exercise the SSR entry — you must:

1. Build both bundles: `npm --prefix web run build` (must emit
   `web/dist/index.html` with the `<!--ssr-outlet-->` still present **and**
   `web/dist/server/entry-server.js`).
2. Boot the server (`DB_DRIVER=memory OWM_MOCK=1 OWM_API_KEY=x node
   src/index.js`) and `curl /` — expect **HTTP 200** with app markup
   (`Users`, `Add user`, `home-list`) present in the HTML **before** any JS runs,
   not an `INTERNAL_ERROR` and not an empty `<div id="root"></div>`.
3. Load it in a real browser and confirm the console has **zero** hydration
   warnings/errors and every island is interactive (autocomplete, theme, form).

If the server returns 500, invoke the SSR render directly to get the stack:
`node -e "import('./web/dist/server/entry-server.js').then(m=>m.render())"` —
the throwing component + line is in the trace.
