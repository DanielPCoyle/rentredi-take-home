import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.jsx";
import { Sentry } from "./sentry.js";
import "./styles.css";

// One entry for both modes. In production Express server-renders the shell into
// #root, so we hydrate. In dev (plain Vite) #root holds only the SSR-outlet
// comment — no element children — so we client-render. childElementCount
// distinguishes them (a comment node isn't an element).
//
// The ErrorBoundary lives here (client entry), not in entry-server: it renders
// no DOM of its own, so server output and first client render stay identical (no
// hydration mismatch), and it reports to Sentry only once initSentry() has run
// (client-only, no-op without a DSN). Server-render errors are caught separately
// by the try/catch in src/app.js and reported by the server SDK.
const root = document.getElementById("root");
const app = (
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={<p style={{ padding: "2rem", textAlign: "center" }}>Something went wrong. Please reload the page.</p>}
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);

if (root.childElementCount > 0) {
  hydrateRoot(root, app);
} else {
  createRoot(root).render(app);
}
