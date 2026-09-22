export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar__identity">
        <span className="topbar__brand">EchoRent<span aria-hidden="true">.</span></span>
        <span className="topbar__description">Rent a car with your voice</span>
      </div>
      {/* Scaffolding only: the menu does nothing yet. */}
      <button type="button" className="topbar__menu" aria-label="Menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5.5" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="12" cy="18.5" r="1.4" />
        </svg>
      </button>
    </header>
  );
}
