import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// One entry for both modes. In production Express server-renders the shell into
// #root, so we hydrate. In dev (plain Vite) #root holds only the SSR-outlet
// comment — no element children — so we client-render. childElementCount
// distinguishes them (a comment node isn't an element).
const root = document.getElementById("root");
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (root.childElementCount > 0) {
  hydrateRoot(root, app);
} else {
  createRoot(root).render(app);
}
