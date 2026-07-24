import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import LocationSelect from "./LocationSelect.jsx";
import UserCard from "./UserCard.jsx";
import { COUNTRIES } from "../countries.js";
import { track } from "../analytics.js";

// Heavy Three.js globe — facade-loaded on first interaction so it never touches
// the initial critical path a fresh page-load audit measures.
const Globe = lazy(() => import("./Globe.jsx"));

// Shimmer placeholder that mirrors a UserCard's shape, so the first load fills
// the same layout the real cards will — no jump when the data arrives.
function SkeletonCard() {
  return (
    <div className="card skeleton-card" aria-hidden="true">
      <div className="sk sk-title" />
      <div className="sk sk-sub" />
      <div className="sk-rows">
        <div className="sk sk-row" />
        <div className="sk sk-row" />
        <div className="sk sk-row" />
        <div className="sk sk-row" />
      </div>
      <div className="sk-actions">
        <div className="sk sk-btn" />
        <div className="sk sk-btn" />
      </div>
    </div>
  );
}

// Spinning ring shown while the Three.js globe chunk loads.
function GlobeLoader() {
  return (
    <div className="globe-fallback" role="status" aria-live="polite">
      <div className="globe-loader" aria-hidden="true" />
      <span className="globe-loader-text">Loading globe…</span>
    </div>
  );
}

// Shared UI for both data sources (live Firebase RTDB + API polling): the create
// form, then a two-column layout of the locations list and the globe.
export default function UserManager({ users, source, onChanged, loading = false, online = true }) {
  // `locationQuery`/`locationOption` drive the online autocomplete; `zip`/`country`
  // are the manual fallback shown while offline (suggestions need the network).
  const [form, setForm] = useState({ name: "", locationQuery: "", locationOption: null, zip: "", country: "US" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [focus, setFocus] = useState(null);
  const [interacted, setInteracted] = useState(false);
  const [formOpen, setFormOpen] = useState(false); // mobile: the create form opens in a modal
  const listRef = useRef(null);

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

  // Close the mobile form modal on Escape.
  useEffect(() => {
    if (!formOpen) return;
    const onKey = (e) => e.key === "Escape" && setFormOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [formOpen]);

  // Bring the focused location's card into view (list click, add, or globe pin click).
  useEffect(() => {
    if (!focus) return;
    listRef.current
      ?.querySelector(`[data-uid="${focus.id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [focus]);

  // A fresh object each call so re-clicking the same location re-triggers the pulse.
  function focusOn(u) {
    if (!Number.isFinite(Number(u.lat)) || !Number.isFinite(Number(u.lon))) return;
    setFocus({ id: u.id, lat: u.lat, lon: u.lon, name: u.name, city: u.city, zone: u.timezoneName, offset: u.timezone });
  }

  async function create(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    const body = { name: form.name };
    if (online) {
      // The autocomplete option carries a canonical query; fall back to whatever
      // was typed if the user submits without picking a suggestion.
      const locationQuery = (form.locationOption?.query || form.locationQuery).trim();
      if (!locationQuery) {
        setError("City or ZIP is required");
        return;
      }
      body.locationQuery = locationQuery;
    } else {
      if (!form.zip.trim()) {
        setError("ZIP is required while offline");
        return;
      }
      body.zip = form.zip.trim();
      body.country = form.country || "US";
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api("POST", "/api/users", body);
      track("user_created");
      setForm({ name: "", locationQuery: "", locationOption: null, zip: "", country: form.country || "US" });
      setFormOpen(false); // close the mobile modal
      await onChanged();
      if (res?.data && !res.queued) focusOn(res.data); // queued (offline) users have no coordinates yet
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const locationSelect = (
    <LocationSelect
      inputId="location"
      value={form.locationOption}
      inputValue={form.locationQuery}
      onSelect={(option) => setForm((f) => ({ ...f, locationOption: option, locationQuery: "" }))}
      onType={(value) => setForm((f) => ({ ...f, locationQuery: value, locationOption: null }))}
    />
  );

  const offlineLocationInputs = (
    <div className="offline-location-fields">
      <input
        placeholder="ZIP"
        value={form.zip}
        onChange={(e) => setForm({ ...form, zip: e.target.value })}
        required={!online}
      />
      <select
        className="country-native-select"
        aria-label="Country"
        value={form.country}
        onChange={(e) => setForm({ ...form, country: e.target.value })}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>
    </div>
  );

  const globeLocations = users.filter((u) =>
    Number.isFinite(Number(u.lat)) && Number.isFinite(Number(u.lon)),
  );

  return (
    <div className="wrap">
      <header className="page">
        <h1>Users</h1>
        <div className="page-actions">
          <span className={"badge" + (source === "live" ? " live" : "")}>
            {source === "live" ? "Live · Firebase RTDB" : "API polling"}
          </span>
          <button type="button" className="new-btn" onClick={() => setFormOpen(true)}>+ New</button>
        </div>
      </header>

      <div className={"form-panel" + (formOpen ? " open" : "")}>
        <div className="form-panel-backdrop" onClick={() => setFormOpen(false)} />
        <div className="form-panel-body" role="dialog" aria-modal="true" aria-label="Add a user">
          <button type="button" className="form-close" onClick={() => setFormOpen(false)} aria-label="Close">×</button>
          <form className="create" onSubmit={create}>
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            {online ? locationSelect : offlineLocationInputs}
            <button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add user"}
            </button>
          </form>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="home">
        <div className="home-list" ref={listRef} aria-busy={loading || undefined}>
          {loading ? (
            <>
              <span className="visually-hidden" role="status">Loading users…</span>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : users.length === 0 ? (
            <div className="empty">No users yet. Add one above.</div>
          ) : (
            [...users].reverse().map((u) => (
              <UserCard
                key={u.id}
                user={u}
                onChanged={onChanged}
                onSelect={() => { track("location_select"); focusOn(u); }}
                selected={focus?.id === u.id}
                online={online}
              />
            ))
          )}
        </div>

        <div className="home-globe">
          <div className="globe-shell">
            {interacted ? (
              <Suspense fallback={<GlobeLoader />}>
                <Globe locations={globeLocations} focus={focus} onPinClick={focusOn} />
              </Suspense>
            ) : (
              <GlobeLoader />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
