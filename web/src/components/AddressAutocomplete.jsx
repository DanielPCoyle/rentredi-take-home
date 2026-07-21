import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

// Single-input address autocomplete backed by our /api/places proxy (Google
// Places). Selecting a suggestion resolves its ZIP + country and reports them
// up via onResolved; editing the text clears the resolution.
export default function AddressAutocomplete({ onResolved, onClear }) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState(false);
  const boxRef = useRef(null);

  // Debounced suggestions.
  useEffect(() => {
    if (resolved || q.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const json = await api("GET", `/api/places/suggest?q=${encodeURIComponent(q)}`);
        setSuggestions(json.data || []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, resolved]);

  // Close the menu on outside click.
  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  // The server resolves the placeId on create (coordinates + timezone), so here
  // we just report the selected place id up.
  function pick(s) {
    setQ(s.description);
    setOpen(false);
    setResolved(true);
    onResolved({ placeId: s.placeId, label: s.description });
  }

  function change(v) {
    setQ(v);
    setResolved(false);
    onClear?.();
  }

  return (
    <div className="ac" ref={boxRef}>
      <input
        placeholder="Search a city or ZIP…"
        value={q}
        onChange={(e) => change(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        aria-label="City or ZIP"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="ac-menu">
          {suggestions.map((s) => (
            <li key={s.placeId} onMouseDown={() => pick(s)}>{s.description}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
