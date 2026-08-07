import { useMemo } from "react";
import { useTheme } from "../context/ThemeContext";
import { normalizeTheme } from "../utils/theme";

export default function LoadingScreen({
  title = "Opening your workspace",
  message = "Preparing your billing dashboard and syncing the latest updates.",
  eyebrow = "Loading",
  compact = false,
  className = "",
  variant,
}) {
  const { theme: themeContextTheme } = useTheme();

  const resolvedVariant = useMemo(() => {
    const rawTheme = variant || themeContextTheme || (typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : "") || "midnight";
    const normalized = normalizeTheme(rawTheme);

    if (normalized === "champagne") return "champagne";
    if (normalized === "teal" || normalized === "ledger") return "teal";
    if (normalized === "ocean") return "ocean";
    if (normalized === "forest") return "forest";
    if (normalized === "sunrise" || normalized === "light") return "sunrise";
    return "midnight";
  }, [themeContextTheme, variant]);

  return (
    <div
      className={`loading-screen loading-screen--${resolvedVariant}${compact ? " loading-screen--compact" : ""}${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-variant={resolvedVariant}
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
