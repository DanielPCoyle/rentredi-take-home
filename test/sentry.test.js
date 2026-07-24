// The Sentry gate: without SENTRY_DSN, instrument.js must NOT initialize a
// client, so tests/CI and DSN-less local runs stay completely untouched.
delete process.env.SENTRY_DSN;

const assert = require("node:assert");

test("instrument.js is a no-op without SENTRY_DSN", () => {
  const Sentry = require("../src/instrument");
  assert.strictEqual(Sentry.getClient(), undefined, "Sentry must not initialize without a DSN");
});
