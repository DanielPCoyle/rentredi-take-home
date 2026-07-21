const fs = require("fs");
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

  // Serve the built Vite frontend (web/dist). In dev the UI runs on Vite's own
  // server (`npm run web:dev`) and proxies here instead.
  const webDist = path.join(__dirname, "..", "web", "dist");
  app.use(express.static(webDist));
  app.get("/", (req, res, next) => {
    if (fs.existsSync(path.join(webDist, "index.html"))) return next();
    res
      .status(200)
      .type("html")
      .send("<p>Frontend not built. Run <code>npm run web:install &amp;&amp; npm run web:build</code>, then reload.</p>");
  });

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
