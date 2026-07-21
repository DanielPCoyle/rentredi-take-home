import { lazy, Suspense, useEffect, useState } from "react";
import { api } from "../api.js";
import UserCard from "./UserCard.jsx";
import AddressAutocomplete from "./AddressAutocomplete.jsx";
import { COUNTRIES } from "../countries.js";
import { useOnlineStatus } from "../useOnlineStatus.js";

// Heavy Three.js globe — facade-loaded on first interaction so it never touches
// the initial critical path a fresh page-load audit measures.
const Globe = lazy(() => import("./Globe.jsx"));

// Shared UI for both data sources (live ReactFire + API polling): the create
// form, then a two-column layout of the locations list and the globe.
export default function UserManager({ users, source, onChanged }) {
  const [form, setForm] = useState({ name: "", zip: "", country: "US", placeId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [focus, setFocus] = useState(null);
  const [interacted, setInteracted] = useState(false);
  const [placesEnabled, setPlacesEnabled] = useState(false);
  const [resetKey, setResetKey] = useState(0); // remounts the autocomplete after add
  const online = useOnlineStatus();

  // Places autocomplete needs the network (/api/places/suggest → Google). Offline
  // it's a dead end — no suggestions load, so no placeId, so the button never
  // enables. Fall back to the plain ZIP + country inputs whenever we're offline.
  const useAutocomplete = placesEnabled && online;

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((j) => setPlacesEnabled(!!j.placesEnabled))
      .catch(() => {});
  }, []);

  // On the first real interaction, load the globe + react-select country picker.
  useEffect(() => {
    let mounted = false;
    const events = ["pointerdown", "pointermove", "wheel", "keydown", "touchstart", "scroll"];
    const cleanup = () => {
      events.forEach((e) => window.removeEventListener(e, go));
      clearTimeout(timer);
    };
    const go = () => {
      if (mounted) return;
      mounted = true;
      cleanup();
      setInteracted(true);
    };
    events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
    const timer = setTimeout(go, 12000); // idle users still get it eventually
    return cleanup;
  }, []);

  const setCountry = (code) => setForm((f) => ({ ...f, country: code }));

  // A fresh object each call so re-clicking the same location re-triggers the pulse.
  function focusOn(u) {
    setFocus({ id: u.id, lat: u.lat, lon: u.lon, name: u.name, city: u.city, zone: u.timezoneName, offset: u.timezone });
  }

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = useAutocomplete
        ? { name: form.name, placeId: form.placeId }
        : { name: form.name, zip: form.zip, country: form.country || undefined };
      const res = await api("POST", "/api/users", body);
      setForm({ name: "", zip: "", country: form.country, placeId: "" });
      setResetKey((k) => k + 1); // clear the autocomplete input
      onChanged();
      if (res?.data) focusOn(res.data); // rotate + pulse to the new location
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const nativeCountrySelect = (
    <select className="country-select" aria-label="Country" value={form.country} onChange={(e) => setCountry(e.target.value)}>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>{c.name}</option>
      ))}
    </select>
  );

  return (
    <div className="wrap">
      <header className="page">
        <h1>Users</h1>
        <span className={"badge" + (source === "live" ? " live" : "")}>
          {source === "live" ? "Live · Firebase RTDB (ReactFire)" : "API polling"}
        </span>
      </header>

      <form className={"create" + (useAutocomplete ? " create-ac" : "")} onSubmit={create}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        {useAutocomplete ? (
          <AddressAutocomplete
            key={resetKey}
            onResolved={({ placeId }) => setForm((f) => ({ ...f, placeId }))}
            onClear={() => setForm((f) => ({ ...f, placeId: "" }))}
          />
        ) : (
          <>
            <input
              placeholder="ZIP (e.g. 78701)"
              value={form.zip}
              onChange={(e) => setForm({ ...form, zip: e.target.value })}
              required
            />
            {nativeCountrySelect}
          </>
        )}
        <button type="submit" disabled={busy || (useAutocomplete && !form.placeId)}>
          {busy ? "Adding…" : "Add user"}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      <div className="home">
        <div className="home-list">
          {users.length === 0 ? (
            <div className="empty">No users yet. Add one above.</div>
          ) : (
            [...users].reverse().map((u) => (
              <UserCard
                key={u.id}
                user={u}
                onChanged={onChanged}
                onSelect={() => focusOn(u)}
                selected={focus?.id === u.id}
              />
            ))
          )}
        </div>

        <div className="home-globe">
          <div className="globe-shell">
            {interacted ? (
              <Suspense fallback={<div className="globe-fallback">Loading globe…</div>}>
                <Globe locations={users} focus={focus} />
              </Suspense>
            ) : (
              <div className="globe-fallback">Loading globe…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
