import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPanel from "./SettingsPanel";
import { getDoc, setDoc } from "firebase/firestore";

const mockChangePasscode = vi.fn();
const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ changePasscode: mockChangePasscode }),
}));

vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key, fallback) => {
      if (key === "sms_template") return "SMS Template";
      if (key === "language") return "Language";
      if (key === "profile") return "Profile";
      if (key === "appearance") return "Appearance";
      if (key === "security") return "Security";
      if (key === "backup_restore") return "Backup & Restore";
      if (key === "role_management") return "Role Management";
      if (key === "danger_zone") return "Danger Zone";
      return fallback ?? key;
    },
    language: "en",
    changeLanguage: vi.fn(),
  }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "midnight",
    ready: true,
    setThemePreference: vi.fn(),
  }),
}));

vi.mock("../../firebase/config", () => ({
  db: {},
}));

vi.mock("firebase/firestore", () => {
  const mockGetDoc = vi.fn();
  const mockSetDoc = vi.fn();
  const mockUpdateDoc = vi.fn();
  return {
    doc: vi.fn(() => ({ path: "settings/test-user" })),
    getDoc: mockGetDoc,
    setDoc: mockSetDoc,
    updateDoc: mockUpdateDoc,
  };
});

vi.mock("../../utils/theme", () => ({
  applyTheme: vi.fn(),
  getStoredTheme: () => "ocean",
  normalizeTheme: (value) => value,
}));

describe("SettingsPanel SMS template persistence", () => {
  beforeEach(() => {
    mockChangePasscode.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    vi.mocked(getDoc).mockReset();
    vi.mocked(setDoc).mockReset();
    vi.mocked(setDoc).mockResolvedValue(undefined);
  });

  it("persists and reloads the edited SMS template for the current user", async () => {
    vi.mocked(getDoc)
      .mockResolvedValueOnce({ exists: false, data: () => ({}) })
      .mockResolvedValueOnce({ exists: true, data: () => ({ smsTemplate: "My saved template" }) });

    const { unmount } = render(
      <SettingsPanel user={{ uid: "test-user", displayName: "Admin", email: "admin@test.com" }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /sms template/i }));

    const textarea = screen.getByLabelText(/universal sms template/i);
    expect(textarea.value).toContain("Hello");

    fireEvent.change(textarea, { target: { value: "My custom template" } });
    fireEvent.click(screen.getByRole("button", { name: /save template/i }));

    await waitFor(() => expect(vi.mocked(setDoc)).toHaveBeenCalled());

    unmount();

    render(
      <SettingsPanel user={{ uid: "test-user", displayName: "Admin", email: "admin@test.com" }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /sms template/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/universal sms template/i).value).toBe("My saved template");
    });
  });
});
