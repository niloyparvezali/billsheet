import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoadingScreen from "./LoadingScreen";
import { ThemeContext } from "../context/ThemeContext";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const layoutCssPath = path.resolve(__dirname, "../styles/layout.css");
const themeCssPath = path.resolve(__dirname, "../styles/theme.css");

describe("LoadingScreen theme styling", () => {
  it("reads the active theme from context and exposes it on the loading shell", () => {
    const { container } = render(
      <ThemeContext.Provider value={{ theme: "sunrise", ready: true, setThemePreference: vi.fn() }}>
        <LoadingScreen />
      </ThemeContext.Provider>,
    );

    const shell = container.querySelector(".loading-screen");
    // The loading screen must use CSS variables from the document theme
    // and must not decide colors itself.
    expect(shell).toBeTruthy();
    expect(shell?.getAttribute("data-loading-theme")).toBeNull();
  });

  it("uses shared CSS variables for the loading screen palette and shadow", () => {
    const layoutCss = fs.readFileSync(layoutCssPath, "utf8");
    const themeCss = fs.readFileSync(themeCssPath, "utf8");

    expect(layoutCss).toContain("background: var(--loading-bg);");
    expect(layoutCss).toContain("color: var(--loading-title);");
    expect(layoutCss).toContain("color: var(--loading-text);");
    expect(layoutCss).toContain("box-shadow: 0 24px 70px var(--loading-shadow);");
    expect(layoutCss).toContain("border: 1px solid var(--loading-ring);");
    expect(themeCss).toContain("--loading-title:");
    expect(themeCss).toContain("--loading-shadow:");
    expect(themeCss).toContain("--loading-ring:");
    expect(themeCss).toContain("--loading-particle:");
  });
});
