import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { api, USERS_CHANGED_EVENT } from "./api.js";
import UserManager from "./components/UserManager.jsx";
import Topbar from "./components/Topbar.jsx";
import { useOnlineStatus } from "./useOnlineStatus.js";
import { initAnalytics } from "./analytics.js";

// ReactFire + Firebase are code-split into their own chunk, loaded only when the
// backend reports a Firebase web config. The default polling path never pays for it.
const LiveRoot = lazy(() => import("./live.jsx"));

// Data source A: poll the API (works with any backend, no Firebase needed).
function PolledUsers({ initialUsers = null }) {
  const [users, setUsers] = useState(initialUsers);
  const load = useCallback(async () => {
    try {
      const json = await api("GET", "/api/users");
      setUsers(json.data);
    } catch {
      /* transient; the next tick retries */
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    window.addEventListener(USERS_CHANGED_EVENT, load);
    return () => {
      clearInterval(t);
      window.removeEventListener(USERS_CHANGED_EVENT, load);
    };
  }, [load]);
  // Before the first response (and with no seed) show the skeleton, not an
  // empty "No users yet" that flips to a full list a moment later.
  return <UserManager users={users ?? []} loading={users == null} source="poll" onChanged={load} />;
}

export default function App() {
  // Render the polling UI immediately (no loading gate → no layout shift). If the
  // backend reports a Firebase web config, upgrade to the live source.
  const [firebase, setFirebase] = useState(null);
  const [seedUsers, setSeedUsers] = useState(null); // last-known list; seeds every view
  const online = useOnlineStatus();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/config");
        const { firebase, gaId } = await res.json();
        if (gaId) initAnalytics(gaId);
        if (firebase) setFirebase(firebase);
      } catch {
        /* stay on polling */
      }
    })();
  }, []);

  // Keep the offline cache warm AND capture the snapshot as a seed. The live
  // (Firebase) path reads over a WebSocket the service worker can't cache, so it
  // never touches /api/users — leaving the offline fallback with nothing to show.
  // Fetch it on load and each time connectivity returns; the SW stores that
  // snapshot for offline reads, and it seeds the live/poll views so switching
  // data source never blanks an already-visible list.
  useEffect(() => {
    const warm = () =>
      fetch("/api/users")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && setSeedUsers(j.data))
        .catch(() => {});
    warm();
    window.addEventListener("online", warm);
    return () => window.removeEventListener("online", warm);
  }, []);

  // Upgrade to live only once we hold a seed to hand it, so the swap is
  // data->data with no "loading" gate in between (the reported flicker). Until
  // then — and offline, where RTDB's uncacheable WebSocket won't work — poll
  // /api/users, which the service worker serves from cache.
  const live = firebase && online && seedUsers != null;

  return (
    <>
      <Topbar />
      {!online && (
        <div className="offline-banner" role="status" aria-live="polite">
          Offline — changes will sync when your connection returns
        </div>
      )}
      {live ? (
        <Suspense fallback={<UserManager users={seedUsers} source="live" onChanged={() => {}} />}>
          <LiveRoot config={firebase} initialUsers={seedUsers} />
        </Suspense>
      ) : (
        <PolledUsers initialUsers={seedUsers} />
      )}
    </>
  );
}
