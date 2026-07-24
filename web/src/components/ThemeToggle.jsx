import { useEffect, useState } from "react";
import { track } from "../analytics.js";

// Light/dark toggle. The actual theme is applied pre-paint by an inline script in
// index.html (sets data-theme on <html>); this button just flips + persists it.
// Start from a fixed "light" so the server render and the first client render
// agree (no hydration mismatch), then read the real theme on mount — the only
// visible effect is the icon flipping to ☀️ for dark-mode users just after load.
export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "light");
  }, []);

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
