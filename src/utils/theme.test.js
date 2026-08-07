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
    applyTheme("ocean", "user-123");
    expect(getStoredTheme("user-123")).toBe("ocean");
    expect(window.localStorage.getItem("bill-sheet-theme:user-123")).toBe("ocean");
  });

  it("normalizes branded theme aliases for the loading experience", () => {
    expect(normalizeTheme("champagne")).toBe("champagne");
    expect(normalizeTheme("teal ledger")).toBe("teal");
    expect(normalizeTheme("forest")).toBe("forest");
  });
});
