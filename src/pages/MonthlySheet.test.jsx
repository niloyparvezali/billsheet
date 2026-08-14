import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    cleanup();
  });

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

it("renders the void action disabled when the user has no payment in the current month", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/monthly-sheet" }]}>
        <MonthlySheet />
      </MemoryRouter>,
    );

    expect(screen.getByTitle("Void")).toBeDisabled();
  });

  it("renders the void action enabled when the user has a payment in the current month", () => {
    const current = new Date();
    mockUseMonthlySheet.mockReturnValue({
      rows: [
        {
          user: { id: "user-1", name: "Alice", monthlyBill: 1000, phone: "123", category: "Gold" },
          payment: { id: "pay-1", amount: 200, month: current.getMonth() + 1, year: current.getFullYear() },
          openingDue: 0,
          openingAdvance: 0,
          due: 0,
          carryForward: 0,
          currentPaid: 200,
          status: "Paid",
        },
      ],
      filteredRows: [
        {
          user: { id: "user-1", name: "Alice", monthlyBill: 1000, phone: "123", category: "Gold" },
          payment: { id: "pay-1", amount: 200, month: current.getMonth() + 1, year: current.getFullYear() },
          openingDue: 0,
          openingAdvance: 0,
          due: 0,
          carryForward: 0,
          currentPaid: 200,
          status: "Paid",
        },
      ],
      paid: [],
      total: 0,
      totalDue: 0,
      totalBill: 1000,
    });

    render(
      <MemoryRouter initialEntries={[{ pathname: "/monthly-sheet" }]}>
        <MonthlySheet />
      </MemoryRouter>,
    );

    expect(screen.getByTitle("Void")).not.toBeDisabled();
  });

  it("renders mobile rows without crashing when a row does not include a bill value", () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 375,
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

    expect(() => {
      render(
        <MemoryRouter initialEntries={[{ pathname: "/monthly-sheet" }]}>
          <MonthlySheet />
        </MemoryRouter>,
      );
    }).not.toThrow();

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  it("keeps the mobile order as summary, financial cards, filters, then collection list", () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 375,
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={[{ pathname: "/monthly-sheet" }]}>
        <MonthlySheet />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    const summary = screen.getByText(/total[_ ]users/i).closest(".monthly-sheet-summary-mobile-column");
    const totalBill = screen.getByText(/total[_ ]bill/i).closest(".monthly-sheet-financial-mobile-item");
    const totalDue = screen.getByText(/total[_ ]due/i).closest(".monthly-sheet-financial-mobile-item");
    const monthSelect = document.querySelector(".monthly-sheet-mini-select");
    const exportButton = screen.getByRole("button", { name: /export[_ ]?pdf/i });
    const searchInput = screen.getByPlaceholderText(/search customer by name or phone/i);

    expect(summary).toBeInTheDocument();
    expect(totalBill).toBeInTheDocument();
    expect(totalDue).toBeInTheDocument();
    expect(monthSelect).toBeInTheDocument();
    expect(exportButton).toBeInTheDocument();
    expect(searchInput).toBeInTheDocument();

    expect(summary.compareDocumentPosition(totalBill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(totalBill.compareDocumentPosition(totalDue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(totalDue.compareDocumentPosition(monthSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(monthSelect.compareDocumentPosition(exportButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(exportButton.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    unmount();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });
});
