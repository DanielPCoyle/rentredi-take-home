const tzlookup = require("tz-lookup");
const { ValidationError, UpstreamError } = require("../errors");
const logger = require("../logger");

// OpenWeatherMap only returns a numeric UTC offset. Derive the IANA timezone
// name (e.g. "America/Chicago") from the coordinates so the UI can show a real
// zone name. Returns null if the lookup fails (e.g. out-of-range coords).
function resolveTimezoneName(lat, lon) {
  try {
    return tzlookup(lat, lon);
  } catch (err) {
    logger.warn({ err, lat, lon }, "timezone name lookup failed");
    return null;
  }
}

// Current UTC offset (seconds) for an IANA zone, DST-aware.
function offsetForZone(zone) {
  try {
    const label = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName").value; // e.g. "GMT-07:00" or "GMT"
    const m = label.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    if (!m) return 0;
    return (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 3600 + parseInt(m[3] || "0", 10) * 60);
  } catch {
    return 0;
  }
}

// { timezoneName, timezone } from coordinates — used by the Places (city/zip) path.
function timezoneFor(lat, lon) {
  const timezoneName = resolveTimezoneName(lat, lon);
  return { timezoneName, timezone: timezoneName ? offsetForZone(timezoneName) : 0 };
}

// Resolves a ZIP code to { lat, lon, timezone, city } using OpenWeatherMap's
// current-weather endpoint, which returns coordinates AND the UTC offset
// (`timezone`, in seconds) in a single call.
//
// These values are the source of truth for a user's location — they are never
// accepted from the client.
async function resolveLocation(zip, country, config) {
  const { apiKey, baseUrl, timeoutMs, defaultCountry, mock } = config.owm;
  const countryCode = (country || defaultCountry).toUpperCase();

  // Deterministic offline stub for tests/e2e (OWM_MOCK=1). "00000" simulates an
  // unknown ZIP so the failure path stays exercisable without the network.
  if (mock) {
    if (zip === "00000") throw new ValidationError(`ZIP code "${zip}" (${countryCode}) was not found`);
    const seed = Number(String(zip).replace(/\D/g, "").slice(0, 5) || 0);
    const lat = 30 + (seed % 1000) / 100;
    const lon = -97 - (seed % 1000) / 100;
    return { lat, lon, timezone: -21600, timezoneName: resolveTimezoneName(lat, lon), city: `City ${zip}` };
  }

  const url = `${baseUrl}/weather?zip=${encodeURIComponent(`${zip},${countryCode}`)}&appid=${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    // Network error or timeout (AbortError). Treat timeout distinctly (504).
    const isTimeout = err.name === "AbortError";
    logger.error({ err, zip, country: countryCode, isTimeout }, "openweathermap request failed");
    throw new UpstreamError(
      isTimeout ? "Location provider timed out" : "Location provider is unavailable",
      { status: isTimeout ? 504 : 502 }
    );
  } finally {
    clearTimeout(timer);
  }

  // OpenWeatherMap returns 404 for an unknown ZIP -> that's a client input problem.
  if (response.status === 404) {
    logger.warn({ zip, country: countryCode }, "zip code not found by openweathermap");
    throw new ValidationError(`ZIP code "${zip}" (${countryCode}) was not found`);
  }

  if (!response.ok) {
    // 401 (bad key), 429 (rate limit), 5xx, etc. — not the client's fault.
    logger.error(
      { status: response.status, zip, country: countryCode },
      "openweathermap returned an error response"
    );
    throw new UpstreamError(`Location provider error (status ${response.status})`);
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    logger.error({ err }, "failed to parse openweathermap response");
    throw new UpstreamError("Invalid response from location provider");
  }

  // Guard against missing location data even on a 200 response.
  const lat = body?.coord?.lat;
  const lon = body?.coord?.lon;
  const timezone = body?.timezone;
  if (typeof lat !== "number" || typeof lon !== "number" || typeof timezone !== "number") {
    logger.error({ body }, "openweathermap response missing location fields");
    throw new UpstreamError("Location provider returned incomplete data");
  }

  return { lat, lon, timezone, timezoneName: resolveTimezoneName(lat, lon), city: body.name || null };
}

module.exports = { resolveLocation, timezoneFor };
