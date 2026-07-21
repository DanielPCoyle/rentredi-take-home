// Format an OpenWeatherMap UTC offset (seconds) as "UTC±HH:MM".
export function fmtOffset(sec) {
  const sign = sec < 0 ? "-" : "+";
  const abs = Math.abs(sec);
  const hh = String(Math.floor(abs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

// Current wall-clock time at a location, derived from its stored UTC offset.
export function localTime(offsetSec) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + offsetSec * 1000);
}
