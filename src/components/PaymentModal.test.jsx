import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PaymentModal from "./PaymentModal";
import { LanguageProvider } from "../context/LanguageContext";

const { mockClose, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockClose: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("../hooks/useOwnedCollection", () => ({
  default: () => ({ data: [] }),
}));

vi.mock("../firebase/config", () => ({
  db: {},
  firebaseReady: true,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "user-1" } }),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => new Date()),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("PaymentModal", () => {
  beforeEach(() => {
    mockClose.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
  });

  it("closes the modal without scrolling the page after a successful save", async () => {
    const originalScrollTo = window.scrollTo;
    const scrollSpy = vi.fn();
    window.scrollTo = scrollSpy;

    render(
      <MemoryRouter>
        <LanguageProvider>
          <PaymentModal
            data={{ user: { id: "u1", name: "Jane", monthlyBill: 1000 } }}
            month={8}
            year={2026}
            ownerId="owner"
            close={mockClose}
          />
        </LanguageProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/payment amount/i), {
      target: { value: "100" },
    });

    fireEvent.submit(screen.getByRole("button", { name: /save payment/i }).closest("form"));

    const confirmButton = screen.getByRole("button", { name: /^save$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(mockClose).toHaveBeenCalled());

    expect(scrollSpy).not.toHaveBeenCalled();

    window.scrollTo = originalScrollTo;
  });
});
