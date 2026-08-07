import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TransactionHistory, {
  getPermanentBalanceSnapshot,
  getTransactionHistoryStatus,
} from "./TransactionHistory";

const { mockUseOwnedCollection, mockUseLanguage } = vi.hoisted(() => ({
  mockUseOwnedCollection: vi.fn(),
  mockUseLanguage: vi.fn(),
}));

vi.mock("../hooks/useOwnedCollection", () => ({
  default: mockUseOwnedCollection,
}));

vi.mock("../context/LanguageContext", () => ({
  useLanguage: () => mockUseLanguage(),
}));

vi.mock("../utils/pdf", () => ({
  exportTransactionPdf: vi.fn(),
}));

vi.mock("../utils/theme", () => ({
  getStoredTheme: () => "light",
}));

vi.mock("../components/FloatingSearch", () => ({
  default: () => null,
}));

describe("getTransactionHistoryStatus", () => {
  it("returns Partial when a payment exists but the current bill is not fully paid", () => {
    expect(
      getTransactionHistoryStatus({ bill: 500, paid: 300, previousDue: 0 }),
    ).toBe("Partial");
  });

  it("returns Paid when the current bill is fully paid even if previous dues remain", () => {
    expect(
      getTransactionHistoryStatus({ bill: 500, paid: 700, previousDue: 300 }),
    ).toBe("Paid");
  });

  it("returns Advance when the payment exceeds the total outstanding amount", () => {
    expect(
      getTransactionHistoryStatus({ bill: 500, paid: 900, previousDue: 300 }),
    ).toBe("Advance");
  });

  it("returns no status for zero-payment transactions", () => {
    expect(getTransactionHistoryStatus({ bill: 500, paid: 0, previousDue: 0 })).toBeNull();
  });

  it("preserves the actual paid amount from the payment transaction", () => {
    expect(
      getPermanentBalanceSnapshot({ amount: 200, currentPaid: 150, billAmount: 150 })
        .amount,
    ).toBe(200);
  });
});

describe("TransactionHistory routed customer navigation", () => {
  beforeEach(() => {
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
      if (collectionName === "payments") {
        return {
          data: [
            {
              id: "pay-1",
              customerId: "user-1",
              userId: "user-1",
              amount: 100,
              paymentDate: new Date("2024-01-01"),
            },
          ],
        };
      }
      if (collectionName === "users") {
        return { data: [{ id: "user-1", name: "Alice" }] };
      }
      return { data: [] };
    });
  });

  it("shows the routed customer’s history without requiring a manual filter", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/history",
            state: { selectedCustomerId: "user-1", selectedCustomerName: "Alice" },
          },
        ]}
      >
        <TransactionHistory />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/Alice/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$100/i).length).toBeGreaterThan(0);
  });
});
