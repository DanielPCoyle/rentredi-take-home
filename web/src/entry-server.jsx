import React from "react";
import { renderToString } from "react-dom/server";
import App from "./App.jsx";

// Server-render the app shell. On first render (no effects, no data, offline
// status defaults online) this is the loading shell — skeleton cards + the globe
// loader — which is exactly what the client renders before its effects run, so
// hydration matches. The client then fetches data and upgrades to the live view;
// the globe and live-Firebase paths never render on the server. No CSS import
// here — styles are a client concern (entry-client).
export function render() {
  return renderToString(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
