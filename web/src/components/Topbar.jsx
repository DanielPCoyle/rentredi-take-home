import ThemeToggle from "./ThemeToggle.jsx";

// App shell top bar. Kept white in both themes so the navy/blue RentRedi logo
// stays legible. Logo lives in web/public and is served from the site root.
export default function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img className="brand-logo" src="/rentredi-logo.svg" alt="RentRedi" width="102" height="30" fetchpriority="high" />
        <span className="topbar-title">Dan Coyle's Assessment</span>
      </div>
      <ThemeToggle />
    </header>
  );
}
