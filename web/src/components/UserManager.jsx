import { useState } from "react";
import { api } from "../api.js";
import UserCard from "./UserCard.jsx";

// Shared UI for both data sources (live ReactFire + API polling). It never reads
// the database itself — it renders the `users` it's given and calls the API for
// writes, then lets the parent decide how the list refreshes.
export default function UserManager({ users, source, onChanged }) {
  const [form, setForm] = useState({ name: "", zip: "", country: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/api/users", {
        name: form.name,
        zip: form.zip,
        country: form.country || undefined,
      });
      setForm({ name: "", zip: "", country: "" });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>RentRedi Users</h1>
        <span className={"badge" + (source === "live" ? " live" : "")}>
          {source === "live" ? "Live · Firebase RTDB (ReactFire)" : "API polling"}
        </span>
      </header>

      <form className="create" onSubmit={create}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input
          placeholder="ZIP (e.g. 78701)"
          value={form.zip}
          onChange={(e) => setForm({ ...form, zip: e.target.value })}
          required
        />
        <input placeholder="Country (US)" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        <button type="submit" disabled={busy}>{busy ? "Adding…" : "Add user"}</button>
      </form>

      {error && <div className="error">{error}</div>}

      {users.length === 0 ? (
        <div className="empty">No users yet. Add one above.</div>
      ) : (
        <div className="grid">
          {users.map((u) => (
            <UserCard key={u.id} user={u} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}
