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
// `initialUsers` seeds the list from the snapshot the app already fetched, so
// switching from the polling view to this live view is data->data — no "loading"
// gate blanks the already-visible UI (that was the reported flicker).
export default function LiveRoot({ config, initialUsers = null }) {
  const [users, setUsers] = useState(initialUsers);

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

  // users == null only before the very first snapshot with no seed: show the
  // skeleton rather than a bare "Loading users…" that replaces the whole page.
  return (
    <UserManager users={users ?? []} loading={users == null} source="live" onChanged={() => {}} />
  );
}
