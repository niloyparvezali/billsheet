import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";
import { useAuth } from "../context/AuthContext";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (_, fallback) => fallback ?? _,
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Login manual sign-in flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not auto sign in when valid credentials are entered and only signs in after submit", async () => {
    const signInWithEmailAndPasscode = vi.fn().mockResolvedValue({ uid: "user-123" });

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      configured: true,
      signInWithEmailAndPasscode,
      registerWithEmailAndPasscode: vi.fn(),
      recoverPasscode: vi.fn(),
      signInWithGoogle: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email address");
    const passcodeInput = screen.getByLabelText("Passcode");

    fireEvent.change(emailInput, { target: { value: "user@example.com" } });
    fireEvent.change(passcodeInput, { target: { value: "123456" } });

    expect(signInWithEmailAndPasscode).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(signInWithEmailAndPasscode).toHaveBeenCalledTimes(1);
    expect(signInWithEmailAndPasscode).toHaveBeenCalledWith("user@example.com", "123456");
  });

  it("keeps the Google and Create account actions in a single responsive row and preserves their handlers", () => {
    const signInWithGoogle = vi.fn().mockResolvedValue({ uid: "google-user" });
    const registerWithEmailAndPasscode = vi.fn();

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      configured: true,
      signInWithEmailAndPasscode: vi.fn(),
      registerWithEmailAndPasscode,
      recoverPasscode: vi.fn(),
      signInWithGoogle,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>,
    );

    const actionRow = container.querySelector(".auth-inline-actions");
    expect(actionRow).not.toBeNull();
    expect(actionRow.querySelectorAll("button")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /continue with google/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(screen.getByRole("button", { name: /back to sign in/i })).toBeInTheDocument();
  });
});
