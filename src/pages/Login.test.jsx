import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";
import { useAuth } from "../context/AuthContext";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
  validateEmail: (value) => String(value ?? "").trim().toLowerCase(),
  hasPasswordProvider: (user) =>
    Array.isArray(user?.providerData)
      ? user.providerData.some((provider) => provider.providerId === "password")
      : false,
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

  it("shows only the email/password login flow and no Google login option", () => {
    const registerWithEmailAndPasscode = vi.fn();

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      configured: true,
      signInWithEmailAndPasscode: vi.fn(),
      registerWithEmailAndPasscode,
      recoverPasscode: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /forgot passcode/i })).toBeInTheDocument();
    expect(screen.queryByText(/set email & passcode/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(screen.getByRole("button", { name: /back to sign in/i })).toBeInTheDocument();
  });

  it("does not render the Google-only passcode setup form for a Google-only user", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        uid: "google-user",
        email: "google-user@gmail.com",
        displayName: "Google User",
        providerData: [{ providerId: "google.com" }],
      },
      configured: true,
      signInWithEmailAndPasscode: vi.fn(),
      registerWithEmailAndPasscode: vi.fn(),
      recoverPasscode: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/set email & passcode/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New passcode")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confirm passcode")).not.toBeInTheDocument();
  });
});
