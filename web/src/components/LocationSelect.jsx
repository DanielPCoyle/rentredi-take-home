import AsyncSelect from "react-select/async";
import { api } from "../api.js";

// Type-ahead over OpenWeatherMap geocoding (via the /api/locations/suggest
// backend proxy — the key stays server-side). Each option carries a canonical
// `query` string the server re-resolves to coordinates. Shared by the create
// form (UserManager) and the per-card edit form (UserCard).
async function loadLocationOptions(inputValue) {
  const q = inputValue.trim();
  if (q.length < 2) return [];
  try {
    const res = await api("GET", `/api/locations/suggest?q=${encodeURIComponent(q)}`);
    return (res?.data || []).map((item) => ({ ...item, value: item.id }));
  } catch {
    return [];
  }
}

// `inputId` must be unique per rendered instance (the create form and an open
// edit card can be on screen at once), so callers pass their own.
export default function LocationSelect({ inputId = "location", value, inputValue, onSelect, onType }) {
  return (
    <AsyncSelect
      aria-label="City or ZIP"
      className="location-select"
      classNamePrefix="location-select"
      inputId={inputId}
      cacheOptions
      defaultOptions={false}
      loadOptions={loadLocationOptions}
      noOptionsMessage={({ inputValue }) => (inputValue.trim().length < 2 ? "Type a city or ZIP" : "No matches")}
      placeholder="City or ZIP"
      isClearable
      value={value}
      inputValue={inputValue}
      onInputChange={(next, action) => {
        if (action.action !== "input-change") return next;
        onType(next);
        return next;
      }}
      onChange={(option) => onSelect(option)}
    />
  );
}
