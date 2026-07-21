const { UpstreamError, NotFoundError } = require("../errors");
const logger = require("../logger");

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

// Restrict suggestions to cities and postal codes (no street addresses).
const CITY_ZIP_TYPES = ["locality", "postal_town", "administrative_area_level_3", "postal_code"];

async function googleFetch(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    logger.error({ err, isTimeout }, "google places request failed");
    throw new UpstreamError(isTimeout ? "Places provider timed out" : "Places provider unavailable", {
      status: isTimeout ? 504 : 502,
    });
  } finally {
    clearTimeout(timer);
  }
}

function requireKey(config) {
  const key = config.google.apiKey;
  if (!key) throw new UpstreamError("Places autocomplete is not configured", { status: 503 });
  return key;
}

// City / ZIP suggestions for a query string.
async function suggest(query, config) {
  const key = requireKey(config);
  const res = await googleFetch(
    AUTOCOMPLETE_URL,
    {
      method: "POST",
      headers: { "X-Goog-Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ input: query, includedPrimaryTypes: CITY_ZIP_TYPES }),
    },
    config.google.timeoutMs
  );
  if (!res.ok) {
    logger.error({ status: res.status }, "places autocomplete error");
    throw new UpstreamError(`Places provider error (status ${res.status})`);
  }
  const body = await res.json();
  return (body.suggestions || [])
    .map((s) => s.placePrediction)
    .filter((p) => p && p.placeId)
    .map((p) => ({ placeId: p.placeId, description: p.text?.text || "" }));
}

// Best-effort representative postal code for coordinates (used when a city has no
// postal code of its own). Never throws — a missing ZIP shouldn't fail a create.
async function reverseZip(lat, lon, key, timeoutMs) {
  try {
    const res = await googleFetch(
      `${GEOCODE_URL}?latlng=${lat},${lon}&result_type=postal_code&key=${key}`,
      {},
      timeoutMs
    );
    if (!res.ok) return null;
    const body = await res.json();
    const comps = body.results?.[0]?.address_components || [];
    return comps.find((c) => (c.types || []).includes("postal_code"))?.long_name || null;
  } catch {
    return null;
  }
}

// Resolve a placeId to { lat, lon, city, country, zip }. For a whole city (no
// postal code of its own) we reverse-geocode the coordinates to a representative
// one. `lat`/`lon` always come from Google (server-side, never the client).
async function details(placeId, config) {
  const key = requireKey(config);
  const url = `${DETAILS_URL}/${encodeURIComponent(placeId)}?fields=addressComponents,formattedAddress,location`;
  const res = await googleFetch(url, { headers: { "X-Goog-Api-Key": key } }, config.google.timeoutMs);
  if (res.status === 404) throw new NotFoundError("Place not found");
  if (!res.ok) {
    logger.error({ status: res.status }, "places details error");
    throw new UpstreamError(`Places provider error (status ${res.status})`);
  }
  const body = await res.json();
  const comps = body.addressComponents || [];
  const find = (type) => comps.find((c) => (c.types || []).includes(type));
  const city =
    find("locality")?.longText ||
    find("postal_town")?.longText ||
    find("administrative_area_level_3")?.longText ||
    find("administrative_area_level_2")?.longText ||
    null;

  const lat = body.location?.latitude ?? null;
  const lon = body.location?.longitude ?? null;
  let zip = find("postal_code")?.longText || null;
  if (!zip && typeof lat === "number" && typeof lon === "number") {
    zip = await reverseZip(lat, lon, key, config.google.timeoutMs);
  }

  return { lat, lon, city, country: find("country")?.shortText || null, zip, description: body.formattedAddress || null };
}

module.exports = { suggest, details };
