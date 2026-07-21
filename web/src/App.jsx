import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import UserManager from "./components/UserManager.jsx";
import Topbar from "./components/Topbar.jsx";

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
    return () => clearInterval(t);
  }, [load]);
  return <UserManager users={users} source="poll" onChanged={load} />;
}

export default function App() {
  // Render the polling UI immediately (no loading gate → no layout shift). If the
  // backend reports a Firebase web config, upgrade to the live ReactFire source.
  const [firebase, setFirebase] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/config");
        const { firebase } = await res.json();
        if (firebase) setFirebase(firebase);
      } catch {
        /* stay on polling */
      }
    })();
  }, []);

  return (
    <>
      <Topbar />
      {firebase ? (
        <Suspense fallback={<PolledUsers />}>
          <LiveRoot config={firebase} />
        </Suspense>
      ) : (
        <PolledUsers />
      )}
    </>
  );
}
