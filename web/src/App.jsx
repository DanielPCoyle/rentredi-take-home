import { lazy, Suspense, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api } from "./api.js";
import UserManager from "./components/UserManager.jsx";
import Topbar from "./components/Topbar.jsx";

// ReactFire + Firebase are code-split into their own chunk, loaded only when the
// backend reports a Firebase web config. The default polling path never pays for it.
const LiveRoot = lazy(() => import("./live.jsx"));

// Live connectivity, straight from the browser. useSyncExternalStore keeps React
// in sync with the online/offline events so the UI re-renders when it flips.
function subscribeOnline(cb) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
const useOnlineStatus = () =>
  useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

function Loading({ label = "Loading…" }) {
  return (
    <div className="wrap">
      <p>{label}</p>
    </div>
  );
}

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
    return () => clearInterval(t);
  }, [load]);
  return <UserManager users={users} source="poll" onChanged={load} />;
}

export default function App() {
  const [state, setState] = useState({ loading: true });
  const online = useOnlineStatus();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/config");
        const { firebase } = await res.json();
        setState({ loading: false, firebase: firebase || null });
      } catch {
        setState({ loading: false, firebase: null });
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

  // Data source B: live Realtime Database subscription via ReactFire.
  // Offline: the Firebase live path needs a WebSocket the service worker can't
  // cache (and web RTDB has no disk persistence), so fall back to polling
  // /api/users, which the service worker serves from cache while offline.
  const content = state.loading ? (
    <Loading />
  ) : state.firebase && online ? (
    <Suspense fallback={<Loading label="Connecting to Firebase…" />}>
      <LiveRoot config={state.firebase} />
    </Suspense>
  ) : (
    <PolledUsers />
  );

  return (
    <>
      <Topbar />
      {!online && (
        <div className="offline-banner" role="status" aria-live="polite">
          Offline — showing the last synced data
        </div>
      )}
      {content}
    </>
  );
}
