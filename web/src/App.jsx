import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import UserManager from "./components/UserManager.jsx";

// ReactFire + Firebase are code-split into their own chunk, loaded only when the
// backend reports a Firebase web config. The default polling path never pays for it.
const LiveRoot = lazy(() => import("./live.jsx"));

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

  if (state.loading) return <Loading />;
  // Data source B: live Realtime Database subscription via ReactFire.
  return state.firebase ? (
    <Suspense fallback={<Loading label="Connecting to Firebase…" />}>
      <LiveRoot config={state.firebase} />
    </Suspense>
  ) : (
    <PolledUsers />
  );
}
