const path = require("path");
const express = require("express");
const { requestLogger } = require("./middleware/requestLogger");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { createUserRouter } = require("./routes/userRoutes");

// App factory: builds the Express app but does NOT listen, so tests can drive it
// with supertest. Assumes db.init(config) has already been called.
function createApp(config) {
  const app = express();

  app.use(express.json());
  app.use(requestLogger);

  // Serve the React frontend (static, no build step).
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  // Public runtime config for the browser. `firebase` is the client web config
  // (or null); when null the frontend falls back to API polling instead of
  // ReactFire's live Realtime Database subscription.
  app.get("/api/config", (req, res) => res.json({ firebase: config.webFirebase }));

  app.use("/api/users", createUserRouter(config));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
