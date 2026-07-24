import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { api, USERS_CHANGED_EVENT, SYNC_COMPLETE_EVENT, pendingCount, onPendingChange } from "./api.js";
import UserManager from "./components/UserManager.jsx";
import Topbar from "./components/Topbar.jsx";
import { useOnlineStatus } from "./useOnlineStatus.js";
import { initAnalytics } from "./analytics.js";
import { initSentry } from "./sentry.js";

// ReactFire + Firebase are code-split into their own chunk, loaded only when the
// backend reports a Firebase web config. The default polling path never pays for it.
const LiveRoot = lazy(() => import("./live.jsx"));

// Data source A: poll the API (works with any backend, no Firebase needed).
function PolledUsers({ initialUsers = null, online = true }) {
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
  return <UserManager users={users ?? []} loading={users == null} source="poll" onChanged={load} online={online} />;
}

export default function App() {
  // Render the polling UI immediately (no loading gate → no layout shift). If the
  // backend reports a Firebase web config, upgrade to the live source.
  const [firebase, setFirebase] = useState(null);
  const [seedUsers, setSeedUsers] = useState(null); // last-known list; seeds every view
  const [pending, setPending] = useState(pendingCount); // offline mutations awaiting sync
  const [justSynced, setJustSynced] = useState(0); // transient "Synced N" confirmation
  const [syncWarnings, setSyncWarnings] = useState([]); // ops that couldn't be synced
  const online = useOnlineStatus();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/config");
        const { firebase, gaId, sentryDsn } = await res.json();
        if (sentryDsn) initSentry(sentryDsn);
        if (gaId) initAnalytics(gaId);
        if (firebase) setFirebase(firebase);
      } catch {
        /* stay on polling */
      }
    })();
  }, []);

  // Offline feedback loop: track the pending count for the banner, and react to
  // each replay's result — confirm a successful sync, and warn (+ toast) for any
  // queued change the server rejected on reconnect.
  useEffect(() => onPendingChange(setPending), []);
  useEffect(() => {
    const onSync = (e) => {
      const { synced, failed } = e.detail;
      if (synced > 0) {
        setJustSynced(synced);
        setTimeout(() => setJustSynced(0), 4000);
      }
      if (failed.length > 0) {
        setSyncWarnings(failed);
        failed.forEach((f) => toast.error(`Couldn't sync ${f.label}`));
        setTimeout(() => setSyncWarnings([]), 8000);
      }
    };
    window.addEventListener(SYNC_COMPLETE_EVENT, onSync);
    return () => window.removeEventListener(SYNC_COMPLETE_EVENT, onSync);
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
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <Topbar />
      {!online && (
        <div className="offline-banner" role="status" aria-live="polite">
          Offline — changes will sync when your connection returns
          {pending > 0 ? ` · ${pending} change${pending > 1 ? "s" : ""} queued` : ""}
        </div>
      )}
      {syncWarnings.length > 0 && online && (
        <div className="offline-banner warning" role="alert">
          {syncWarnings.length} queued change{syncWarnings.length > 1 ? "s" : ""} couldn’t be synced (already changed on the server)
        </div>
      )}
      {justSynced > 0 && online && (
        <div className="offline-banner" role="status" aria-live="polite">
          Synced {justSynced} offline change{justSynced > 1 ? "s" : ""}
        </div>
      )}
      {live ? (
        <Suspense fallback={<UserManager users={seedUsers} source="live" onChanged={() => {}} online={online} />}>
          <LiveRoot config={firebase} initialUsers={seedUsers} online={online} />
        </Suspense>
      ) : (
        <PolledUsers initialUsers={seedUsers} online={online} />
      )}
    </>
  );
}
