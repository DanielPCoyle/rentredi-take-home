import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { Sentry } from "./sentry.js";
import "./styles.css";

// ErrorBoundary catches render crashes and shows a fallback instead of a blank
// screen; it reports to Sentry only once initSentry() has run (no-op DSN-less).
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={<p style={{ padding: "2rem", textAlign: "center" }}>Something went wrong. Please reload the page.</p>}
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
