import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MonthlySheet from "./MonthlySheet";

const { mockUseOwnedCollection, mockUseMonthlySheet, mockUseAuth, mockUseLanguage } =
  vi.hoisted(() => ({
    mockUseOwnedCollection: vi.fn(),
    mockUseMonthlySheet: vi.fn(),
    mockUseAuth: vi.fn(),
    mockUseLanguage: vi.fn(),
  }));

vi.mock("../hooks/useOwnedCollection", () => ({
  default: mockUseOwnedCollection,
}));

vi.mock("../hooks/useMonthlySheet", () => ({
  default: mockUseMonthlySheet,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../context/LanguageContext", () => ({
  useLanguage: () => mockUseLanguage(),
}));

vi.mock("../utils/pdf", () => ({
  exportMonthlySheetPdf: vi.fn(),
}));

vi.mock("../utils/theme", () => ({
  getStoredTheme: () => "light",
}));

vi.mock("../components/PaymentModal", () => ({
  default: ({ data }) => <div data-testid="payment-modal">{data?.user?.name}</div>,
}));

vi.mock("../components/ConfirmModal", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../components/FloatingSearch", () => ({
  default: () => null,
}));

describe("MonthlySheet routed customer navigation", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { uid: "owner-1" } });
    mockUseLanguage.mockReturnValue({
      t: (key, fallback) => fallback ?? key,
      formatMoney: (value) => `$${value}`,
      formatNumber: (value) => String(value),
      translateMonth: (value) => value,
      translateStatus: (value) => value,
      toBengaliNumerals: (value) => value,
      language: "en",
    });
    mockUseOwnedCollection.mockImplementation((collectionName) => {
      if (collectionName === "users") {
        return { data: [{ id: "user-1", name: "Alice", monthlyBill: 1000, phone: "123", category: "Gold" }] };
      }
      if (collectionName === "payments") {
        return { data: [] };
      }
      return { data: [] };
    });
    mockUseMonthlySheet.mockReturnValue({
      rows: [
        {
          user: { id: "user-1", name: "Alice", monthlyBill: 1000, phone: "123", category: "Gold" },
          payment: null,
          openingDue: 0,
          openingAdvance: 0,
          due: 0,
          carryForward: 0,
          currentPaid: 0,
          status: "Pending",
        },
      ],
      filteredRows: [
        {
          user: { id: "user-1", name: "Alice", monthlyBill: 1000, phone: "123", category: "Gold" },
          payment: null,
          openingDue: 0,
          openingAdvance: 0,
          due: 0,
          carryForward: 0,
          currentPaid: 0,
          status: "Pending",
        },
      ],
      paid: [],
      total: 0,
      totalDue: 0,
      totalBill: 1000,
    });
  });

  it("opens the payment modal for the routed customer", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/monthly-sheet",
            state: { selectedCustomerId: "user-1", selectedCustomerName: "Alice", openPaymentModal: true },
          },
        ]}
      >
        <MonthlySheet />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("payment-modal")).toHaveTextContent(/Alice/i);
  });
});
