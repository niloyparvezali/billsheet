import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useMonthlySheet from "./useMonthlySheet";

const baseUsers = [
  {
    id: "u1",
    name: "Rahim Ahmed",
    phone: "01711111111",
    category: "Grocery",
    monthlyBill: 1000,
    active: true,
  },
  {
    id: "u2",
    name: "Nadia Khan",
    phone: "01922222222",
    category: "School",
    monthlyBill: 500,
    active: true,
  },
  {
    id: "u3",
    name: "Farah Ali",
    phone: "01833333333",
    category: "Transport",
    monthlyBill: 800,
    active: true,
  },
  {
    id: "u4",
    name: "Imran Chowdhury",
    phone: "01644444444",
    category: "Utilities",
    monthlyBill: 700,
    active: true,
  },
];

describe("useMonthlySheet search and status ordering", () => {
  it("filters by customer name, phone, and category case-insensitively with partial matches", () => {
    const { result: nameResult } = renderHook(() =>
      useMonthlySheet({
        users: baseUsers,
        allPayments: [],
        month: 8,
        year: 2026,
        search: "RAHIM",
        nameOrder: "asc",
        statusOrder: "pending",
      }),
    );

    const { result: phoneResult } = renderHook(() =>
      useMonthlySheet({
        users: baseUsers,
        allPayments: [],
        month: 8,
        year: 2026,
        search: "017",
        nameOrder: "asc",
        statusOrder: "pending",
      }),
    );

    const { result: categoryResult } = renderHook(() =>
      useMonthlySheet({
        users: baseUsers,
        allPayments: [],
        month: 8,
        year: 2026,
        search: "grocery",
        nameOrder: "asc",
        statusOrder: "pending",
      }),
    );

    expect(nameResult.current.filteredRows.map((row) => row.user.id)).toEqual(["u1"]);
    expect(phoneResult.current.filteredRows.map((row) => row.user.id)).toEqual(["u1"]);
    expect(categoryResult.current.filteredRows.map((row) => row.user.id)).toEqual(["u1"]);
  });

  it("prioritizes pending, partial, paid, and advance before the name sort", () => {
    const allPayments = [
      { customerId: "u1", amount: 0, month: 8, year: 2026 },
      { customerId: "u2", amount: 200, month: 8, year: 2026 },
      { customerId: "u3", amount: 800, month: 8, year: 2026 },
      { customerId: "u4", amount: 1000, month: 8, year: 2026 },
    ];

    const { result } = renderHook(() =>
      useMonthlySheet({
        users: baseUsers,
        allPayments,
        month: 8,
        year: 2026,
        search: "",
        nameOrder: "asc",
        statusOrder: "pending",
      }),
    );

    expect(result.current.filteredRows.map((row) => row.status)).toEqual([
      "Pending",
      "Partial",
      "Paid",
      "Advance",
    ]);
  });
});
