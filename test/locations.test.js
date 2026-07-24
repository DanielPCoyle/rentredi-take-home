// Covers the city/ZIP autocomplete: the /api/locations/suggest proxy (OWM
// geocoding) and the create/update `locationQuery` path. Hermetic — in-memory DB
// + a URL-aware global.fetch stub, no real OpenWeatherMap calls.
process.env.LOG_LEVEL = "silent";

const assert = require("node:assert");
const request = require("supertest");

const { loadConfig } = require("../src/config");
const db = require("../src/db");
const { createApp } = require("../src/app");
const { suggestLocations, resolveLocationQuery } = require("../src/services/locationService");

const config = loadConfig({ OWM_API_KEY: "test-key" });
const mockConfig = loadConfig({ OWM_API_KEY: "x", OWM_MOCK: "1" });
const realFetch = global.fetch;

let app;

// Routes each OWM endpoint the location code touches to a canned response.
function stubFetch() {
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/geo/1.0/direct")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          { name: "Austin", state: "Texas", country: "US", lat: 30.27, lon: -97.74 },
          { name: "Austin", state: "Minnesota", country: "US", lat: 43.67, lon: -92.97 },
        ],
      };
    }
    if (u.includes("/geo/1.0/zip")) {
      return { ok: true, status: 200, json: async () => ({ zip: "78701", name: "Austin", country: "US", lat: 30.27, lon: -97.74 }) };
    }
    if (u.includes("/weather")) {
      return { ok: true, status: 200, json: async () => ({ coord: { lat: 30.27, lon: -97.74 }, timezone: -21600, name: "Austin", sys: { country: "US" } }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

beforeEach(() => {
  db.init(config);
  stubFetch();
  app = createApp(config);
});

afterEach(() => {
  global.fetch = realFetch;
});

// --- /api/locations/suggest ------------------------------------------------

test("suggest returns city matches for a text query", async () => {
  const res = await request(app).get("/api/locations/suggest?q=Austin");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data) && res.body.data.length >= 2);
  assert.equal(res.body.data[0].city, "Austin");
  assert.ok(res.body.data[0].query.includes("Austin"));
});

test("suggest includes a postal match when the query looks like a ZIP", async () => {
  const res = await request(app).get("/api/locations/suggest?q=78701");
  assert.equal(res.status, 200);
  assert.ok(res.body.data.some((s) => s.zip === "78701"));
});

test("suggest rejects a too-short query (400)", async () => {
  const res = await request(app).get("/api/locations/suggest?q=a");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

// --- create/update via locationQuery ---------------------------------------

test("POST accepts a city locationQuery and stores derived coordinates", async () => {
  const res = await request(app).post("/api/users").send({ name: "Ada", locationQuery: "Austin,Texas,US" });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.city, "Austin");
  assert.equal(res.body.data.lat, 30.27);
  assert.equal(res.body.data.country, "US");
});

test("POST accepts a postal locationQuery (routed through the ZIP resolver)", async () => {
  const res = await request(app).post("/api/users").send({ name: "Grace", locationQuery: "78701" });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.zip, "78701");
});

test("POST rejects a user with neither locationQuery nor zip (400)", async () => {
  const res = await request(app).post("/api/users").send({ name: "NoLocation" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("PUT re-resolves location when a new locationQuery is supplied", async () => {
  const created = await request(app).post("/api/users").send({ name: "Alan", zip: "78701" });
  const id = created.body.data.id;
  const res = await request(app).put(`/api/users/${id}`).send({ locationQuery: "Austin,Texas,US" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.city, "Austin");
});

// --- OWM_MOCK path (deterministic, network-free) ----------------------------

test("suggest (mock) returns a synthetic city suggestion", async () => {
  const out = await suggestLocations("Portland", mockConfig);
  assert.ok(out.length >= 1);
  assert.equal(out[0].city, "Portland");
});

test("suggest (mock) returns nothing for the unknown sentinel", async () => {
  assert.deepEqual(await suggestLocations("nowhere", mockConfig), []);
});

test("resolveLocationQuery (mock) derives coordinates for a city", async () => {
  const out = await resolveLocationQuery("Portland", mockConfig);
  assert.ok(Number.isFinite(out.record.lat) && Number.isFinite(out.record.lon));
  assert.equal(out.record.city, "Portland");
});

test("resolveLocationQuery (mock) rejects an unknown location", async () => {
  await assert.rejects(() => resolveLocationQuery("nowhere land", mockConfig), /not found/);
});
