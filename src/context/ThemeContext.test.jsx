import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";

vi.mock("./AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../firebase/config", () => ({
  db: {},
  firebaseReady: true,
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({ path: "settings/test-user" })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

function ThemeProbe() {
  const { theme, ready } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="ready">{ready ? "ready" : "not-ready"}</span>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute("data-theme");
  });

  it("drops readiness while authentication is still in progress", async () => {
    const { getDoc } = await import("firebase/firestore");
    const authState = vi.mocked(useAuth);

    authState.mockReturnValue({ user: { uid: "test-user" }, loading: false });
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ theme: "sunrise" }),
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={["/"]}>
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("ready"));
    expect(screen.getByTestId("theme").textContent).toBe("sunrise");

    authState.mockReturnValue({ user: { uid: "test-user" }, loading: true });

    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("not-ready"));
  });
});
