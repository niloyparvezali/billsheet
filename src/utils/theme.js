export const THEME_STORAGE_KEY = "bill-sheet-theme";

const getSystemThemePreference = () => {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "midnight";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "midnight"
    : "sunrise";
};

export const themePresets = Object.freeze({
  midnight: {
    id: "midnight",
    label: "🌙 Midnight",
    previewShell:
      "linear-gradient(135deg, #0B0F19 0%, #111827 58%, #3B82F6 100%)",
    accent: "#3B82F6",
    chartActive: "#3B82F6",
    chartDefault: "#60A5FA",
    chartGrid: "rgba(243, 244, 246, 0.14)",
    chartAxis: "rgba(243, 244, 246, 0.75)",
    chartLabel: "#F9FAFB",
    chartTooltipBg: "rgba(11, 15, 25, 0.95)",
    chartTooltipText: "#F9FAFB",
  },

  sunrise: {
    id: "sunrise",
    label: "☀️ Sunrise",
    previewShell:
      "linear-gradient(135deg, #FFFDF9 0%, #FFF4E6 45%, #FDBA74 100%)",

    // Primary Brand
    accent: "#F59E0B",

    // Charts
    chartActive: "#F59E0B",
    chartDefault: "#FB923C",

    chartGrid: "rgba(31, 41, 55, 0.08)",
    chartAxis: "rgba(31, 41, 55, 0.65)",
    chartLabel: "#1F2937",

    chartTooltipBg: "rgba(31, 41, 55, 0.96)",
    chartTooltipText: "#FFFFFF",
  },
});

export const normalizeTheme = (value) => {
  const theme = String(value || "")
    .trim()
    .toLowerCase();

  if (theme === "midnight") return "midnight";
  if (theme === "sunrise") return "sunrise";

  return "midnight";
};

export const getStoredTheme = (userId = null) => {
  if (typeof window === "undefined") return "midnight";

  const storageKey = userId
    ? `${THEME_STORAGE_KEY}:${userId}`
    : THEME_STORAGE_KEY;
  const saved = window.localStorage.getItem(storageKey);
  if (saved) return normalizeTheme(saved);

  if (!userId) {
    const storageKeys = Object.keys(window.localStorage).filter((key) =>
      key.startsWith(`${THEME_STORAGE_KEY}:`),
    );

    for (const key of storageKeys) {
      const cachedTheme = window.localStorage.getItem(key);
      if (cachedTheme) {
        return normalizeTheme(cachedTheme);
      }
    }
  }

  return getSystemThemePreference();
};

export const applyTheme = (value, userId = null) => {
  const theme = normalizeTheme(value);
  if (typeof window !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
    const storageKey = userId
      ? `${THEME_STORAGE_KEY}:${userId}`
      : THEME_STORAGE_KEY;
    window.localStorage.setItem(storageKey, theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }
  return theme;
};

export const initializeTheme = () => {
  const savedTheme = getStoredTheme();
  const normalizedTheme = normalizeTheme(savedTheme);
  if (typeof window !== "undefined") {
    document.documentElement.setAttribute("data-theme", normalizedTheme);
  }
  return normalizedTheme;
};

export const getThemeConfig = (value) =>
  themePresets[normalizeTheme(value)] || themePresets.midnight;

export const readThemeColors = () => {
  if (typeof window === "undefined") {
    return {
      active: themePresets.midnight.chartActive,
      default: themePresets.midnight.chartDefault,
      grid: themePresets.midnight.chartGrid,
      axis: themePresets.midnight.chartAxis,
      label: themePresets.midnight.chartLabel,
      tooltipBg: themePresets.midnight.chartTooltipBg,
      tooltipText: themePresets.midnight.chartTooltipText,
    };
  }

  const rootStyle = getComputedStyle(document.documentElement);
  return {
    active:
      rootStyle.getPropertyValue("--chart-bar-active").trim() ||
      themePresets.midnight.chartActive,
    default:
      rootStyle.getPropertyValue("--chart-bar-default").trim() ||
      themePresets.midnight.chartDefault,
    grid:
      rootStyle.getPropertyValue("--chart-grid").trim() ||
      themePresets.midnight.chartGrid,
    axis:
      rootStyle.getPropertyValue("--chart-axis").trim() ||
      themePresets.midnight.chartAxis,
    label:
      rootStyle.getPropertyValue("--chart-label").trim() ||
      themePresets.midnight.chartLabel,
    tooltipBg:
      rootStyle.getPropertyValue("--chart-tooltip-bg").trim() ||
      themePresets.midnight.chartTooltipBg,
    tooltipText:
      rootStyle.getPropertyValue("--chart-tooltip-text").trim() ||
      themePresets.midnight.chartTooltipText,
  };
};
