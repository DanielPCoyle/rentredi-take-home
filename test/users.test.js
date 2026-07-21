// Hermetic tests: in-memory DB (no Firebase) + a stubbed global.fetch (no real
// OpenWeatherMap calls). Covers validation, success, not-found, external-service
// failures, and the "only refetch location when ZIP changes" rule.
process.env.LOG_LEVEL = "silent";

// test/beforeEach/afterEach are Vitest globals (vitest.config.mjs: globals: true).
const assert = require("node:assert");
const request = require("supertest");

const { loadConfig } = require("../src/config");
const db = require("../src/db");
const { createApp } = require("../src/app");

const config = loadConfig({ OWM_API_KEY: "test-key" });
const realFetch = global.fetch;

let app;
let fetchCalls;

function okWeather({ lat = 30.26, lon = -97.74, timezone = -21600, name = "Austin" } = {}) {
  return { ok: true, status: 200, json: async () => ({ coord: { lat, lon }, timezone, name }) };
}

beforeEach(() => {
  db.init(config); // fresh in-memory store per test
  fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(url);
    return okWeather();
  };
  app = createApp(config);
});

afterEach(() => {
  global.fetch = realFetch;
});

// --- validation -----------------------------------------------------------

test("POST rejects a missing name (400)", async () => {
  const res = await request(app).post("/api/users").send({ zip: "78701" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("POST rejects a malformed zip (400)", async () => {
  const res = await request(app).post("/api/users").send({ name: "Ada", zip: "!!" });
  assert.equal(res.status, 400);
});

test("POST rejects client-supplied lat/lon/timezone/id (400, not trusted)", async () => {
  const res = await request(app)
    .post("/api/users")
    .send({ name: "Ada", zip: "78701", lat: 1, lon: 2, timezone: 3, id: "hacked" });
  assert.equal(res.status, 400);
  assert.equal(fetchCalls.length, 0);
});

// --- success --------------------------------------------------------------

test("POST creates a user with server-fetched location (201)", async () => {
  const res = await request(app).post("/api/users").send({ name: "Ada", zip: "78701" });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.name, "Ada");
  assert.equal(res.body.data.lat, 30.26);
  assert.equal(res.body.data.lon, -97.74);
  assert.equal(res.body.data.timezone, -21600);
  assert.equal(res.body.data.city, "Austin");
  assert.ok(res.body.data.id, "server assigns an id");
  assert.equal(fetchCalls.length, 1);
});

test("GET returns a created user", async () => {
  const created = await request(app).post("/api/users").send({ name: "Ada", zip: "78701" });
  const res = await request(app).get(`/api/users/${created.body.data.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.name, "Ada");
});

test("DELETE removes a user (204), then GET is 404", async () => {
  const created = await request(app).post("/api/users").send({ name: "Ada", zip: "78701" });
  const id = created.body.data.id;
  const del = await request(app).delete(`/api/users/${id}`);
  assert.equal(del.status, 204);
  const after = await request(app).get(`/api/users/${id}`);
  assert.equal(after.status, 404);
});

// --- not found ------------------------------------------------------------

test("GET unknown id returns 404", async () => {
  const res = await request(app).get("/api/users/does-not-exist");
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, "NOT_FOUND");
});

test("PUT unknown id returns 404", async () => {
  const res = await request(app).put("/api/users/nope").send({ name: "New" });
  assert.equal(res.status, 404);
});

// --- external-service failures --------------------------------------------

test("POST with a zip unknown to the provider returns 400", async () => {
  global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const res = await request(app).post("/api/users").send({ name: "X", zip: "00000" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("POST returns 502 when the provider errors", async () => {
  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const res = await request(app).post("/api/users").send({ name: "X", zip: "78701" });
  assert.equal(res.status, 502);
  assert.equal(res.body.error.code, "UPSTREAM_ERROR");
});

test("POST returns 504 when the provider times out", async () => {
  global.fetch = async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  };
  const res = await request(app).post("/api/users").send({ name: "X", zip: "78701" });
  assert.equal(res.status, 504);
});

// --- only refetch location when zip changes -------------------------------

test("PUT refetches location only when the zip changes", async () => {
  const created = await request(app).post("/api/users").send({ name: "Ada", zip: "78701" });
  const id = created.body.data.id;
  assert.equal(fetchCalls.length, 1);

  // name-only update -> no additional provider call
  const nameOnly = await request(app).put(`/api/users/${id}`).send({ name: "Ada Lovelace" });
  assert.equal(nameOnly.status, 200);
  assert.equal(nameOnly.body.data.name, "Ada Lovelace");
  assert.equal(fetchCalls.length, 1, "no refetch on name-only update");

  // zip change -> exactly one additional provider call
  const zipChange = await request(app).put(`/api/users/${id}`).send({ zip: "10001" });
  assert.equal(zipChange.status, 200);
  assert.equal(fetchCalls.length, 2, "refetch on zip change");
});
