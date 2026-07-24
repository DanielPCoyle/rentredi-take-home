const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const express = require("express");
const compression = require("compression");
const { requestLogger } = require("./middleware/requestLogger");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { createLocationRouter } = require("./routes/locationRoutes");
const { createUserRouter } = require("./routes/userRoutes");

// App factory: builds the Express app but does NOT listen, so tests can drive it
// with supertest. Assumes db.init(config) has already been called.
function createApp(config) {
  const app = express();

  app.use(compression()); // gzip responses (JS/CSS/HTML/JSON)
  app.use(express.json({ limit: "10kb" })); // cap body size — reject oversized payloads
  app.use(requestLogger);

  // Serve the built Vite frontend (web/dist). Assets are static; the root `/`
  // navigation is server-rendered (SSR). In dev the UI runs on Vite's own server
  // (`npm run web:dev`) and proxies here instead — there it client-renders.
  const webDist = path.join(__dirname, "..", "web", "dist");
  const templatePath = path.join(webDist, "index.html");
  const serverEntry = path.join(webDist, "server", "entry-server.js");

  // `index: false` so express.static does NOT auto-serve index.html for `/` —
  // that route is server-rendered below. It still serves /index.html explicitly
  // (what the service worker precaches for its offline navigateFallback).
  app.use(express.static(webDist, { index: false }));

  // Load the SSR render fn + HTML template once, then cache. The dynamic pieces
  // (WebGL globe, live Firebase reads, ticking clocks) are client-only islands
  // that render after hydration, so the server output is the loading shell and
  // hydration matches. Returns null when the frontend hasn't been built.
  let ssr = null;
  async function loadSsr() {
    if (ssr) return ssr;
    if (!fs.existsSync(templatePath) || !fs.existsSync(serverEntry)) return null;
    const template = fs.readFileSync(templatePath, "utf8");
    const mod = await import(pathToFileURL(serverEntry).href);
    ssr = { template, render: mod.render };
    return ssr;
  }

  app.get("/", async (req, res, next) => {
    try {
      const built = await loadSsr();
      if (!built) {
        return res
          .status(200)
          .type("html")
          .send("<p>Frontend not built. Run <code>npm run web:install &amp;&amp; npm run web:build</code>, then reload.</p>");
      }
      const html = built.template.replace("<!--ssr-outlet-->", built.render());
      res.status(200).type("html").send(html);
    } catch (err) {
      next(err);
    }
  });

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  // Public runtime config for the browser. `firebase` is the client web config
  // (or null); when null the frontend falls back to API polling instead of the
  // live Realtime Database subscription (firebase/database onValue).
  app.get("/api/config", (req, res) =>
    res.json({ firebase: config.webFirebase, gaId: config.gaId, sentryDsn: config.sentryDsn }));

  app.use("/api/locations", createLocationRouter(config));
  app.use("/api/users", createUserRouter(config));

  // Report unhandled errors (status >= 500) to Sentry when configured. No-op
  // otherwise. Must sit after the routes and before our JSON error handler,
  // which still runs (Sentry's handler captures then calls next).
  if (process.env.SENTRY_DSN) {
    require("@sentry/node").setupExpressErrorHandler(app);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
