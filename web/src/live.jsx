import { useEffect, useState } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";
import UserManager from "./components/UserManager.jsx";

// Live reads come straight from the Realtime Database. Writes still go through
// the API (the server owns location enrichment + validation); RTDB pushes each
// change back here, so the list re-renders on its own and onChanged is a no-op.
//
// This used to be reactfire, which is unmaintained and ships a CJS build that
// calls require("react") — under Vite's rolldown bundler that throws at runtime
// ("require is not defined") and blanked the page. firebase/database's onValue
// does the same job directly, with no extra dependency.
export default function LiveRoot({ config }) {
  const [users, setUsers] = useState(null);

  useEffect(() => {
    // Guard against re-init (StrictMode double-mount, remounts): reuse the app.
    const app = getApps().length ? getApp() : initializeApp(config);
    const usersRef = ref(getDatabase(app), "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const val = snapshot.val() || {};
      // Records already carry their id (the push key); keep the same shape the
      // API-polling path produces so UserManager stays source-agnostic.
      setUsers(Object.entries(val).map(([id, user]) => ({ id, ...user })));
    });
    return unsubscribe;
  }, [config]);

  if (users === null) {
    return (
      <div className="wrap">
        <p>Loading users…</p>
      </div>
    );
  }
  return <UserManager users={users} source="live" onChanged={() => {}} />;
}
