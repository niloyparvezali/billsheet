export const THEME_STORAGE_KEY = "bill-sheet-theme";

const getSystemThemePreference = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const themePresets = Object.freeze({
  forest: {
    id: "forest",
    label: "🟢 Forest",
    previewShell: "linear-gradient(135deg, rgba(11, 34, 31, 0.96) 0%, rgba(15, 118, 110, 0.84) 58%, rgba(244, 197, 66, 0.76) 100%)",
    accent: "#f4c542",
    chartActive: "#48d8c5",
    chartDefault: "#4ecdc4",
    chartGrid: "rgba(244, 247, 255, 0.16)",
    chartAxis: "rgba(244, 247, 255, 0.74)",
    chartLabel: "#f4f7ff",
    chartTooltipBg: "rgba(4, 17, 26, 0.95)",
    chartTooltipText: "#f4f7ff",
  },
  ocean: {
    id: "ocean",
    label: "🔵 Ocean",
    previewShell: "linear-gradient(135deg, rgba(5, 19, 34, 0.96) 0%, rgba(14, 116, 144, 0.9) 58%, rgba(6, 182, 212, 0.76) 100%)",
    accent: "#22d3ee",
    chartActive: "#3ec6ff",
    chartDefault: "#41b9e7",
    chartGrid: "rgba(164, 226, 255, 0.18)",
    chartAxis: "rgba(220, 241, 255, 0.72)",
    chartLabel: "#f4f7ff",
    chartTooltipBg: "rgba(5, 20, 34, 0.95)",
    chartTooltipText: "#f4f7ff",
  },
  light: {
    id: "light",
    label: "☀️ Light",
    previewShell: "linear-gradient(135deg, rgba(252, 250, 244, 0.98) 0%, rgba(236, 243, 240, 0.96) 62%, rgba(241, 197, 77, 0.75) 100%)",
    accent: "#f4c542",
    chartActive: "#48d8c5",
    chartDefault: "#4ecdc4",
    chartGrid: "rgba(15, 23, 42, 0.1)",
    chartAxis: "rgba(15, 23, 42, 0.66)",
    chartLabel: "#111827",
    chartTooltipBg: "rgba(15, 23, 42, 0.95)",
    chartTooltipText: "#f9fafb",
  },
  dark: {
    id: "dark",
    label: "🌙 Dark",
    previewShell: "linear-gradient(135deg, rgba(5, 19, 34, 0.96) 0%, rgba(14, 116, 144, 0.9) 58%, rgba(6, 182, 212, 0.76) 100%)",
    accent: "#22d3ee",
    chartActive: "#3ec6ff",
    chartDefault: "#41b9e7",
    chartGrid: "rgba(125, 211, 252, 0.22)",
    chartAxis: "rgba(220, 241, 255, 0.82)",
    chartLabel: "#eef9ff",
    chartTooltipBg: "rgba(4, 19, 35, 0.96)",
    chartTooltipText: "#eef9ff",
  },
});

export const normalizeTheme = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "ocean" || normalized === "cyan") return "ocean";
  if (normalized === "light") return "light";
  if (normalized === "dark") return "dark";
  return "forest";
};

export const getStoredTheme = () => {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved) return normalizeTheme(saved);
  return getSystemThemePreference();
};

export const applyTheme = (value) => {
  const theme = normalizeTheme(value);
  if (typeof window !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }
  return theme;
};

export const getThemeConfig = (value) => themePresets[normalizeTheme(value)] || themePresets.forest;

export const readThemeColors = () => {
  if (typeof window === "undefined") {
    return {
      active: themePresets.forest.chartActive,
      default: themePresets.forest.chartDefault,
      grid: themePresets.forest.chartGrid,
      axis: themePresets.forest.chartAxis,
      label: themePresets.forest.chartLabel,
      tooltipBg: themePresets.forest.chartTooltipBg,
      tooltipText: themePresets.forest.chartTooltipText,
    };
  }

  const rootStyle = getComputedStyle(document.documentElement);
  return {
    active: rootStyle.getPropertyValue("--chart-bar-active").trim() || themePresets.forest.chartActive,
    default: rootStyle.getPropertyValue("--chart-bar-default").trim() || themePresets.forest.chartDefault,
    grid: rootStyle.getPropertyValue("--chart-grid").trim() || themePresets.forest.chartGrid,
    axis: rootStyle.getPropertyValue("--chart-axis").trim() || themePresets.forest.chartAxis,
    label: rootStyle.getPropertyValue("--chart-label").trim() || themePresets.forest.chartLabel,
    tooltipBg: rootStyle.getPropertyValue("--chart-tooltip-bg").trim() || themePresets.forest.chartTooltipBg,
    tooltipText: rootStyle.getPropertyValue("--chart-tooltip-text").trim() || themePresets.forest.chartTooltipText,
  };
};
