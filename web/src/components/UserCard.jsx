import { useState } from "react";
import { api } from "../api.js";
import { COUNTRIES } from "../countries.js";
import { track } from "../analytics.js";
import { zoneLabel } from "../util.js";
import LocalClock from "./LocalClock.jsx";
import LocationSelect from "./LocationSelect.jsx";

function locationLabel(u) {
  return [u.city || u.zip, u.country].filter(Boolean).join(", ") || "current location";
}

// One user. View mode shows derived location + the live clock, and is clickable
// to focus/pulse the globe; edit mode sends only the changed fields (so the
// backend refetches location only when the location actually changes).
export default function UserCard({ user, onChanged, onSelect, onSaved, selected, online = true }) {
  const [editing, setEditing] = useState(false);
  // locationOption seeds the autocomplete with the current location; picking a new
  // suggestion (query != "") is what triggers a re-resolve. zip/country are the
  // offline fallback.
  const [form, setForm] = useState({
    name: user.name,
    locationQuery: "",
    locationOption: { value: "current", label: locationLabel(user), query: "" },
    zip: user.zip || "",
    country: user.country || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const patch = {};
      if (form.name !== user.name) patch.name = form.name;
      if (online) {
        // Only send a locationQuery when the user picked a new suggestion or typed one.
        const locationQuery = (form.locationOption?.query || form.locationQuery).trim();
        if (locationQuery) patch.locationQuery = locationQuery;
      } else {
        if (form.zip && form.zip !== user.zip) patch.zip = form.zip;
        if ((form.country || "") !== (user.country || "")) patch.country = form.country || undefined;
      }
      // A location edit (not a name-only edit) moves the pin, so we recenter on it below.
      const locationChanged = "locationQuery" in patch || "zip" in patch || "country" in patch;
      let res;
      if (Object.keys(patch).length) {
        res = await api("PUT", `/api/users/${user.id}`, patch);
        track("user_updated");
      }
      setEditing(false);
      await onChanged();
      // Recenter the globe on the updated pin after a location edit. Skip queued
      // offline edits (no fresh coordinates until sync) and name-only edits.
      if (locationChanged && res?.data && !res.queued) onSaved?.(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api("DELETE", `/api/users/${user.id}`);
      track("user_deleted");
      onChanged();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="card">
        <h2>{user.name}</h2>
        <div className="sub">Editing</div>
        <div className="edit">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
          {online ? (
            <LocationSelect
              inputId={`location-${user.id}`}
              value={form.locationOption}
              inputValue={form.locationQuery}
              onSelect={(option) => setForm((f) => ({ ...f, locationOption: option, locationQuery: "" }))}
              onType={(value) => setForm((f) => ({ ...f, locationQuery: value, locationOption: null }))}
            />
          ) : (
            <div className="offline-location-fields">
              <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="ZIP" />
              <select
                className="country-native-select"
                aria-label="Country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              >
                <option value="">Country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button onClick={save} disabled={busy}>Save</button>
            <button className="secondary" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className={"card clickable" + (selected ? " selected" : "")} data-uid={user.id} onClick={onSelect}>
      <h2>
        <button
          className="card-title"
          onClick={stop(onSelect)}
          aria-label={`Show ${user.name} on the globe`}
        >
          {user.name}
        </button>
      </h2>
      <div className="sub">
        {user.city || "—"}
        {user.zip ? ` (${user.zip})` : ""}
        {user.country ? `, ${user.country}` : ""}
      </div>
      <div className="row"><span>Local time</span><LocalClock zone={user.timezoneName} offset={user.timezone} /></div>
      <div className="row"><span>Timezone</span><span>{zoneLabel(user.timezoneName, user.timezone)}</span></div>
      <div className="row"><span>Latitude</span><span>{user.lat}</span></div>
      <div className="row"><span>Longitude</span><span>{user.lon}</span></div>
      {error && <div className="error" style={{ marginTop: "10px" }}>{error}</div>}
      <div className="actions">
        <button className="secondary" onClick={stop(() => setEditing(true))} disabled={busy}>Edit</button>
        <button className="danger" onClick={stop(remove)} disabled={busy}>Delete</button>
      </div>
    </div>
  );
}
