import { useState } from "react";
import { track } from "../analytics.js";

// Light/dark toggle. The initial theme is set pre-paint by an inline script in
// index.html; here we just flip it and persist the choice.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    track("theme_toggle", { theme: next });
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore storage errors */
    }
    setTheme(next);
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title="Toggle light / dark mode"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
