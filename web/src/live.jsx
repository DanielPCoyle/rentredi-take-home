import {
  FirebaseAppProvider,
  DatabaseProvider,
  useFirebaseApp,
  useDatabase,
  useDatabaseListData,
} from "reactfire";
import { getDatabase, ref } from "firebase/database";
import UserManager from "./components/UserManager.jsx";

// Live reads straight from the Realtime Database. Writes still go through the API
// (the server owns location enrichment + validation), and RTDB pushes each change
// back here, so `onChanged` is a no-op — the subscription re-renders on its own.
function LiveUsers() {
  const database = useDatabase();
  const { status, data } = useDatabaseListData(ref(database, "users"), { idField: "id" });
  if (status === "loading") {
    return (
      <div className="wrap">
        <p>Loading users…</p>
      </div>
    );
  }
  return <UserManager users={data || []} source="live" onChanged={() => {}} />;
}

function DatabaseBridge() {
  const app = useFirebaseApp();
  return (
    <DatabaseProvider sdk={getDatabase(app)}>
      <LiveUsers />
    </DatabaseProvider>
  );
}

export default function LiveRoot({ config }) {
  return (
    <FirebaseAppProvider firebaseConfig={config}>
      <DatabaseBridge />
    </FirebaseAppProvider>
  );
}
