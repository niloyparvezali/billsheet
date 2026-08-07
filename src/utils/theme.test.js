import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyTheme, getStoredTheme, normalizeTheme } from "./theme";

describe("theme persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("falls back to midnight when no cached preference exists", () => {
    expect(getStoredTheme()).toBe("midnight");
  });

  it("stores and reads a theme for a specific user", () => {
    applyTheme("midnight", "user-123");
    expect(getStoredTheme("user-123")).toBe("midnight");
    expect(window.localStorage.getItem("bill-sheet-theme:user-123")).toBe("midnight");
  });

  it("reads a cached user theme from localStorage even when no user id is provided", () => {
    window.localStorage.setItem("bill-sheet-theme:user-456", "sunrise");
    expect(getStoredTheme()).toBe("sunrise");
  });

  it("normalizes removed themes to midnight for backward compatibility", () => {
    expect(normalizeTheme("ocean")).toBe("midnight");
    expect(normalizeTheme("champagne")).toBe("midnight");
    expect(normalizeTheme("teal")).toBe("midnight");
    expect(normalizeTheme("forest")).toBe("midnight");
  });

  it("preserves valid themes midnight and sunrise", () => {
    expect(normalizeTheme("midnight")).toBe("midnight");
    expect(normalizeTheme("sunrise")).toBe("sunrise");
  });

  it("keeps payment status colors identical across themes", () => {
    const themeCssPath = path.resolve(__dirname, "../styles/theme.css");
    const themeCss = fs.readFileSync(themeCssPath, "utf8");
    const sunriseBlock = themeCss.match(/:root\[data-theme="sunrise"\]([\s\S]*?)(?=\n:root\[data-theme="midnight"\])/)[1];
    const midnightBlock = themeCss.match(/:root\[data-theme="midnight"\]([\s\S]*?)(?=\nhtml,)/)[1];

    const statusVars = [
      "--status-paid-bg",
      "--status-paid-text",
      "--status-advance-bg",
      "--status-advance-text",
      "--status-partial-bg",
      "--status-partial-text",
      "--status-due-bg",
      "--status-due-text",
    ];

    statusVars.forEach((variable) => {
      const sunriseValue = sunriseBlock.match(new RegExp(`${variable}:([^;]+);`))[1].trim();
      const midnightValue = midnightBlock.match(new RegExp(`${variable}:([^;]+);`))[1].trim();
      expect(midnightValue).toBe(sunriseValue);
    });
  });
});
