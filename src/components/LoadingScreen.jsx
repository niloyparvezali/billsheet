export default function LoadingScreen({
  title = "Opening your workspace",
  message = "Preparing your billing dashboard and syncing the latest updates.",
  eyebrow = "Loading",
  compact = false,
  className = "",
}) {
  return (
    <div
      className={`loading-screen${compact ? " loading-screen--compact" : ""}${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loading-backdrop" aria-hidden="true" />
      <div className="loading-card">
        <div className="loading-orbit" aria-hidden="true">
          <div className="loading-core" />
          <div className="loading-ring loading-ring--one" />
          <div className="loading-ring loading-ring--two" />
          <span className="loading-particle loading-particle--one" />
          <span className="loading-particle loading-particle--two" />
          <span className="loading-particle loading-particle--three" />
          <span className="loading-wave loading-wave--one" />
          <span className="loading-wave loading-wave--two" />
        </div>
        <div className="loading-copy">
          <span className="loading-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}
