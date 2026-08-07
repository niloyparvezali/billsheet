import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Reports from "./Reports";

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
  exportAnnualCustomerPdf: vi.fn(),
}));

vi.mock("../utils/theme", () => ({
  getStoredTheme: () => "light",
}));

describe("Reports routed customer navigation", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.scrollTo = vi.fn();
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
        return { data: [{ id: "user-1", name: "Alice" }] };
      }
      if (collectionName === "payments") {
        return { data: [{ id: "pay-1", userId: "user-1", amount: 100, createdAt: new Date("2024-01-01") }] };
      }
      return { data: [] };
    });
  });

  it("preselects the routed customer report", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/reports",
            state: { customerId: "user-1", customerName: "Alice" },
          },
        ]}
      >
        <Reports />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/Alice/i).length).toBeGreaterThan(0);
  });

  it("switches to a dedicated customer report and restores the search state on back", () => {
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>,
    );

    const searchInput = screen.getByPlaceholderText(/search customer by name or phone/i);
    fireEvent.change(searchInput, { target: { value: "Ali" } });

    fireEvent.click(screen.getByRole("button", { name: /Alice/i }));

    expect(screen.getAllByRole("button", { name: /back/i }).length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText(/search customer by name or phone/i)).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /back/i })[0]);

    expect(screen.getByPlaceholderText(/search customer by name or phone/i).value).toBe("Ali");
  });
});
