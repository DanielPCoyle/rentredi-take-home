// Unit tests for the Firebase Realtime Database driver. A fake `firebase-admin`
// (in-memory) is injected into createFirebaseDb, so the driver's CRUD +
// credential mapping is covered with no network and no real project.
const fs = require("fs");
const assert = require("node:assert");
const { createFirebaseDb } = require("../src/db/firebase");

// A minimal in-memory stand-in for the firebase-admin Realtime Database API.
function makeAdmin() {
  const store = {};
  let counter = 0;
  const snapshot = (value) => ({
    val: () => (value === undefined ? null : value),
    exists: () => value !== undefined && value !== null,
  });
  const childRef = (id) => ({
    key: id,
    set: (record) => {
      store[id] = record;
      return Promise.resolve();
    },
    remove: () => {
      delete store[id];
      return Promise.resolve();
    },
    once: () => Promise.resolve(snapshot(store[id])),
  });
  const usersRef = {
    push: () => childRef(`-Fake${++counter}`),
    once: () => Promise.resolve(snapshot(store)),
    child: (id) => childRef(id),
  };
  return {
    apps: [],
    initializeApp: vi.fn(() => ({})),
    credential: {
      applicationDefault: vi.fn(() => ({ type: "adc" })),
      cert: vi.fn((obj) => ({ type: "cert", obj })),
    },
    database: () => ({ ref: () => usersRef }),
  };
}

const URL = "https://x.firebaseio.com";
let admin;

beforeEach(() => {
  admin = makeAdmin(); // fresh, isolated fake per test
});

test("throws without a databaseURL", () => {
  assert.throws(() => createFirebaseDb({}, admin), /FIREBASE_DATABASE_URL/);
});

test("create assigns a push-key id and persists", async () => {
  const db = createFirebaseDb({ databaseURL: URL }, admin);
  const rec = await db.create({ name: "Ada", zip: "78701" });
  assert.match(rec.id, /^-Fake/);
  assert.equal(rec.name, "Ada");
  assert.deepEqual(await db.get(rec.id), rec);
});

test("list returns all records", async () => {
  const db = createFirebaseDb({ databaseURL: URL }, admin);
  await db.create({ name: "A", zip: "1" });
  await db.create({ name: "B", zip: "2" });
  assert.equal((await db.list()).length, 2);
});

test("get returns null for a missing id", async () => {
  const db = createFirebaseDb({ databaseURL: URL }, admin);
  assert.equal(await db.get("nope"), null);
});

test("update merges into an existing record and keeps its id", async () => {
  const db = createFirebaseDb({ databaseURL: URL }, admin);
  const rec = await db.create({ name: "Ada", zip: "78701" });
  const updated = await db.update(rec.id, { zip: "10001" });
  assert.equal(updated.id, rec.id);
  assert.equal(updated.zip, "10001");
  assert.equal(updated.name, "Ada");
});

test("update returns null for a missing id", async () => {
  const db = createFirebaseDb({ databaseURL: URL }, admin);
  assert.equal(await db.update("nope", { zip: "1" }), null);
});

test("remove deletes and returns true, then false when already gone", async () => {
  const db = createFirebaseDb({ databaseURL: URL }, admin);
  const rec = await db.create({ name: "Ada", zip: "78701" });
  assert.equal(await db.remove(rec.id), true);
  assert.equal(await db.get(rec.id), null);
  assert.equal(await db.remove(rec.id), false);
});

test("uses Application Default Credentials when no service account is given", () => {
  createFirebaseDb({ databaseURL: URL }, admin);
  assert.equal(admin.credential.applicationDefault.mock.calls.length, 1);
  assert.equal(admin.credential.cert.mock.calls.length, 0);
});

test("uses inline service-account JSON when provided", () => {
  createFirebaseDb({ databaseURL: URL, serviceAccount: '{"type":"service_account"}' }, admin);
  assert.equal(admin.credential.cert.mock.calls.length, 1);
});

test("reads a service-account from a file path", () => {
  const readSpy = vi.spyOn(fs, "readFileSync").mockReturnValue('{"type":"service_account"}');
  createFirebaseDb({ databaseURL: URL, serviceAccount: "./sa.json" }, admin);
  assert.equal(readSpy.mock.calls.length, 1);
  assert.equal(admin.credential.cert.mock.calls.length, 1);
  readSpy.mockRestore();
});

test("skips initializeApp when an app already exists", () => {
  admin.apps.push({}); // simulate an already-initialized app
  createFirebaseDb({ databaseURL: URL }, admin);
  assert.equal(admin.initializeApp.mock.calls.length, 0);
});
