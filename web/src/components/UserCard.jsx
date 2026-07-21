import { useState } from "react";
import { api } from "../api.js";
import { fmtOffset } from "../util.js";
import LocalClock from "./LocalClock.jsx";

// One user. View mode shows derived location + the live clock; edit mode sends
// only the changed fields (so the backend refetches location only on ZIP change).
export default function UserCard({ user, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user.name, zip: user.zip, country: user.country || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const patch = {};
      if (form.name !== user.name) patch.name = form.name;
      if (form.zip !== user.zip) patch.zip = form.zip;
      if ((form.country || "") !== (user.country || "")) patch.country = form.country || undefined;
      if (Object.keys(patch).length) await api("PUT", `/api/users/${user.id}`, patch);
      setEditing(false);
      onChanged();
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
      onChanged();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="card">
        <h3>{user.name}</h3>
        <div className="sub">Editing</div>
        <div className="edit">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
          <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="ZIP" />
          <input
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            placeholder="Country (optional)"
          />
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button onClick={save} disabled={busy}>Save</button>
            <button className="secondary" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>{user.name}</h3>
      <div className="sub">
        {user.city || "—"} · {user.zip}
        {user.country ? `, ${user.country}` : ""}
      </div>
      <div className="row"><span>Local time</span><LocalClock offset={user.timezone} /></div>
      <div className="row"><span>Timezone</span><span>{fmtOffset(user.timezone)}</span></div>
      <div className="row"><span>Latitude</span><span>{user.lat}</span></div>
      <div className="row"><span>Longitude</span><span>{user.lon}</span></div>
      {error && <div className="error" style={{ marginTop: "10px" }}>{error}</div>}
      <div className="actions">
        <button className="secondary" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
        <button className="danger" onClick={remove} disabled={busy}>Delete</button>
      </div>
    </div>
  );
}
