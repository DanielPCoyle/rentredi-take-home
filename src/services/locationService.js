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

function titleize(value) {
  return String(value)
    .trim()
    .split(/\s+/)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parsePostalQuery(query, defaultCountry) {
  const parts = String(query).trim().split(",").map((p) => p.trim()).filter(Boolean);
  const postal = parts[0] || "";
  const country = (parts[1] || defaultCountry).toUpperCase();
  if (!/\d/.test(postal)) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(postal)) return null;
  if (!/^[A-Z]{2}$/.test(country)) return null;
  return { zip: postal, country };
}

function weatherRecordFromBody(body) {
  const lat = body?.coord?.lat;
  const lon = body?.coord?.lon;
  const timezone = body?.timezone;
  if (typeof lat !== "number" || typeof lon !== "number" || typeof timezone !== "number") {
    logger.error({ body }, "openweathermap response missing location fields");
    throw new UpstreamError("Location provider returned incomplete data");
  }

  return { lat, lon, timezone, timezoneName: resolveTimezoneName(lat, lon), city: body.name || null };
}

async function fetchJson(url, { timeoutMs, context, notFoundError }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    logger.error({ err, ...context, isTimeout }, "openweathermap request failed");
    throw new UpstreamError(
      isTimeout ? "Location provider timed out" : "Location provider is unavailable",
      { status: isTimeout ? 504 : 502 }
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    logger.warn(context, "location not found by openweathermap");
    throw notFoundError();
  }

  if (!response.ok) {
    logger.error({ status: response.status, ...context }, "openweathermap returned an error response");
    throw new UpstreamError(`Location provider error (status ${response.status})`);
  }

  try {
    return await response.json();
  } catch (err) {
    logger.error({ err }, "failed to parse openweathermap response");
    throw new UpstreamError("Invalid response from location provider");
  }
}

// Resolves a ZIP code to { lat, lon, timezone, city } using OpenWeatherMap's
// current-weather endpoint, which returns coordinates AND the UTC offset
// (`timezone`, in seconds) in a single call.
//
// Note on `timezone`: it is the offset *at the moment of the fetch*, so it is a
// point-in-time snapshot that goes stale across a DST transition. `timezoneName`
// (the IANA zone, derived from the coordinates) is the DST-safe field — the UI
// computes the live local clock from it and only falls back to the raw offset.
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
  const body = await fetchJson(url, {
    timeoutMs,
    context: { zip, country: countryCode },
    notFoundError: () => new ValidationError(`ZIP code "${zip}" (${countryCode}) was not found`),
  });

  return weatherRecordFromBody(body);
}

async function resolveLocationQuery(locationQuery, config) {
  const { apiKey, baseUrl, timeoutMs, defaultCountry, mock } = config.owm;
  const query = String(locationQuery).trim();
  const postal = parsePostalQuery(query, defaultCountry);
  if (postal) {
    const record = await resolveLocation(postal.zip, postal.country, config);
    return { zip: postal.zip, country: postal.country, record };
  }

  if (mock) {
    if (/nowhere/i.test(query)) throw new ValidationError(`Location "${query}" was not found`);
    const seed = [...query].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const lat = 30 + (seed % 1000) / 100;
    const lon = -97 - (seed % 1000) / 100;
    return {
      zip: null,
      country: defaultCountry,
      record: { lat, lon, timezone: -21600, timezoneName: resolveTimezoneName(lat, lon), city: titleize(query.split(",")[0]) },
    };
  }

  const url = `${baseUrl}/weather?q=${encodeURIComponent(query)}&appid=${apiKey}`;
  const body = await fetchJson(url, {
    timeoutMs,
    context: { query },
    notFoundError: () => new ValidationError(`Location "${query}" was not found`),
  });

  return {
    zip: null,
    country: body?.sys?.country || defaultCountry,
    record: weatherRecordFromBody(body),
  };
}

function locationLabel({ name, state, country, zip }) {
  return [zip || name, state, country].filter(Boolean).join(", ");
}

async function suggestLocations(query, config) {
  const { apiKey, geoBaseUrl, timeoutMs, defaultCountry, mock } = config.owm;
  const q = String(query).trim();
  if (q.length < 2) return [];

  if (mock) {
    if (/nowhere|00000/i.test(q)) return [];
    const postal = parsePostalQuery(q, defaultCountry);
    if (postal) {
      return [{
        id: `zip:${postal.zip}:${postal.country}`,
        label: `${postal.zip}, ${postal.country}`,
        query: `${postal.zip},${postal.country}`,
        zip: postal.zip,
        country: postal.country,
      }];
    }
    const name = titleize(q.split(",")[0]);
    return [{ id: `city:${name}:${defaultCountry}`, label: `${name}, ${defaultCountry}`, query: `${name},${defaultCountry}`, city: name, country: defaultCountry }];
  }

  const suggestions = [];
  const postal = parsePostalQuery(q, defaultCountry);
  if (postal) {
    try {
      const zipUrl = `${geoBaseUrl}/zip?zip=${encodeURIComponent(`${postal.zip},${postal.country}`)}&appid=${apiKey}`;
      const body = await fetchJson(zipUrl, {
        timeoutMs,
        context: { zip: postal.zip, country: postal.country },
        notFoundError: () => new ValidationError("Postal code not found"),
      });
      suggestions.push({
        id: `zip:${body.zip}:${body.country}`,
        label: locationLabel({ zip: body.zip, name: body.name, country: body.country }),
        query: `${body.zip},${body.country}`,
        zip: body.zip,
        city: body.name || null,
        country: body.country,
      });
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
    }
  }

  const directUrl = `${geoBaseUrl}/direct?q=${encodeURIComponent(q)}&limit=5&appid=${apiKey}`;
  const places = await fetchJson(directUrl, {
    timeoutMs,
    context: { query: q },
    notFoundError: () => new ValidationError("Location suggestions not found"),
  });

  for (const place of Array.isArray(places) ? places : []) {
    if (!place?.name || !place?.country) continue;
    const label = locationLabel(place);
    const cityQuery = [place.name, place.state, place.country].filter(Boolean).join(",");
    suggestions.push({
      id: `city:${place.name}:${place.state || ""}:${place.country}:${place.lat}:${place.lon}`,
      label,
      query: cityQuery,
      city: place.name,
      state: place.state || null,
      country: place.country,
    });
  }

  const seen = new Set();
  return suggestions.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 6);
}

module.exports = { resolveLocation, resolveLocationQuery, suggestLocations };
