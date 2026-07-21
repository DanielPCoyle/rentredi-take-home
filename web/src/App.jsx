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
function PolledUsers() {
  const [users, setUsers] = useState([]);
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
  return <UserManager users={users} source="poll" onChanged={load} />;
}

export default function App() {
  // Render the polling UI immediately (no loading gate → no layout shift). If the
  // backend reports a Firebase web config, upgrade to the live ReactFire source.
  const [firebase, setFirebase] = useState(null);
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

  // Keep the offline cache warm. The live (Firebase) path reads over a WebSocket
  // the service worker can't cache, so it never touches /api/users — leaving the
  // offline fallback with nothing to show. Proactively fetch it on load and each
  // time connectivity returns; the SW stores that snapshot for offline reads.
  // No interval — this is a cache warmer, not a poll (PolledUsers still polls).
  useEffect(() => {
    const warm = () => fetch("/api/users").catch(() => {});
    warm();
    window.addEventListener("online", warm);
    return () => window.removeEventListener("online", warm);
  }, []);

  // Offline: the Firebase live path needs a WebSocket the service worker can't
  // cache (and web RTDB has no disk persistence), so fall back to polling
  // /api/users, which the service worker serves from cache while offline.
  return (
    <>
      <Topbar />
      {!online && (
        <div className="offline-banner" role="status" aria-live="polite">
          Offline — changes will sync when your connection returns
        </div>
      )}
      {firebase && online ? (
        <Suspense fallback={<PolledUsers />}>
          <LiveRoot config={firebase} />
        </Suspense>
      ) : (
        <PolledUsers />
      )}
    </>
  );
}
