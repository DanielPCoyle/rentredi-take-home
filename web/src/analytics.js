// Minimal GA4 (gtag.js) wrapper. The library is loaded on demand only when the
// backend reports a Measurement ID via /api/config; with no ID every call is a
// no-op, so an unconfigured build ships no tracking and makes no network calls.
//
// Events fired (mark the first three as Key Events / conversions in GA4):
//   user_created, user_updated, user_deleted   — CRUD goals
//   location_select, theme_toggle              — engagement
let initialized = false;

export function initAnalytics(measurementId) {
  if (initialized || !measurementId || typeof window === "undefined") return;
  initialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId); // sends the initial page_view

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
  document.head.appendChild(s);
}

// Fire a GA4 event. No-ops until initAnalytics() has run with a valid ID.
export function track(event, params) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", event, params || {});
  }
}
