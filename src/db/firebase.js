const fs = require("fs");

// firebase-admin v14 removed the legacy namespaced API (`admin.credential`,
// `admin.apps`, `admin.database()`) — those moved to modular entrypoints
// (`firebase-admin/app`, `firebase-admin/database`). This adapter re-exposes just
// the surface this driver (and its injected-mock tests) use, keeping the
// dependency-injection seam stable across the upgrade. Required lazily so the
// default in-memory path never loads credentials.
function defaultAdmin() {
  const app = require("firebase-admin/app");
  const adminDatabase = require("firebase-admin/database");
  // Direct references (not wrappers) — the modular functions ignore `this`, so
  // `admin.initializeApp(...)` / `admin.database()` call through correctly.
  return {
    get apps() {
      return app.getApps();
    },
    initializeApp: app.initializeApp,
    credential: {
      applicationDefault: app.applicationDefault,
      cert: app.cert,
    },
    database: adminDatabase.getDatabase,
  };
}

// Firebase Realtime Database driver (the assignment's bonus). `admin` is
// injectable purely for testing (defaults to the real SDK via the adapter above).
function createFirebaseDb(firebaseConfig, admin = defaultAdmin()) {
  const { databaseURL, serviceAccount } = firebaseConfig;

  if (!databaseURL) {
    throw new Error("FIREBASE_DATABASE_URL is required to use the firebase driver");
  }

  const credential = resolveCredential(admin, serviceAccount);

  // Guard against re-init when multiple modules touch the driver in one process.
  if (!admin.apps.length) {
    admin.initializeApp({ credential, databaseURL });
  }

  const usersRef = admin.database().ref("users");

  return {
    async create(data) {
      const ref = usersRef.push();
      const record = { id: ref.key, ...data };
      await ref.set(record);
      return record;
    },
    async list() {
      const snap = await usersRef.once("value");
      const val = snap.val() || {};
      return Object.values(val);
    },
    async get(id) {
      const snap = await usersRef.child(id).once("value");
      return snap.val() || null;
    },
    async update(id, patch) {
      const snap = await usersRef.child(id).once("value");
      if (!snap.exists()) return null;
      const record = { ...snap.val(), ...patch, id };
      await usersRef.child(id).set(record);
      return record;
    },
    async remove(id) {
      const snap = await usersRef.child(id).once("value");
      if (!snap.exists()) return false;
      await usersRef.child(id).remove();
      return true;
    },
  };
}

// Accepts either a path to a service-account JSON file or the JSON inline.
// Falls back to application default credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS).
function resolveCredential(admin, serviceAccount) {
  if (!serviceAccount) return admin.credential.applicationDefault();
  const raw = serviceAccount.trim().startsWith("{")
    ? serviceAccount
    : fs.readFileSync(serviceAccount, "utf8");
  return admin.credential.cert(JSON.parse(raw));
}

module.exports = { createFirebaseDb, defaultAdmin };
