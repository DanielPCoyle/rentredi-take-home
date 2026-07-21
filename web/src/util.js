// Format an OpenWeatherMap UTC offset (seconds) as "UTC±HH:MM" — a fallback for
// records without a resolved IANA zone name.
export function fmtOffset(sec) {
  const sign = sec < 0 ? "-" : "+";
  const abs = Math.abs(sec);
  const hh = String(Math.floor(abs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

const TIME_OPTS = { hour: "2-digit", minute: "2-digit", second: "2-digit" };

// Current local time at a location. Prefers the IANA zone (DST-correct); falls
// back to the stored UTC offset for older records that lack a zone name.
export function localTimeString(zone, offsetSec) {
  const now = new Date();
  if (zone) {
    try {
      return now.toLocaleTimeString("en-US", { ...TIME_OPTS, timeZone: zone });
    } catch {
      /* fall through to offset */
    }
  }
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + (offsetSec || 0) * 1000).toLocaleTimeString([], TIME_OPTS);
}

// Is it currently daytime (06:00–18:00 local) at a location?
export function isDaytime(zone, offsetSec) {
  const now = new Date();
  let hour = null;
  if (zone) {
    try {
      hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).format(now));
    } catch {
      hour = null;
    }
  }
  if (hour == null) {
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    hour = new Date(utcMs + (offsetSec || 0) * 1000).getHours();
  }
  return hour >= 6 && hour < 18;
}

// Human-readable time zone name, e.g. "Central Daylight Time". Falls back to the
// IANA id, then to the UTC offset.
export function zoneLabel(zone, offsetSec) {
  if (zone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        timeZoneName: "long",
      }).formatToParts(new Date());
      const name = parts.find((p) => p.type === "timeZoneName")?.value;
      if (name) return name;
    } catch {
      /* fall through */
    }
    return zone.replace(/_/g, " ");
  }
  return fmtOffset(offsetSec);
}
