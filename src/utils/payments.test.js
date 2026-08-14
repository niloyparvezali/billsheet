import { describe, expect, it } from "vitest";
import {
  buildMonthlyBillHistoryEntry,
  getEffectiveBillForPeriod,
} from "./payments";

describe("billing history stability", () => {
  it("keeps June and July at the old rate when August is changed, and carries August forward", () => {
    const user = {
      monthlyBill: 2000,
      billHistory: [
        { effectiveYear: 2026, effectiveMonth: 6, monthlyBill: 200 },
        { effectiveYear: 2026, effectiveMonth: 8, monthlyBill: 2000 },
      ],
    };

    expect(getEffectiveBillForPeriod(user, { month: 6, year: 2026 })).toBe(200);
    expect(getEffectiveBillForPeriod(user, { month: 7, year: 2026 })).toBe(200);
    expect(getEffectiveBillForPeriod(user, { month: 8, year: 2026 })).toBe(2000);
    expect(getEffectiveBillForPeriod(user, { month: 9, year: 2026 })).toBe(2000);
    expect(getEffectiveBillForPeriod(user, { month: 10, year: 2026 })).toBe(2000);
  });

  it("preserves historical month rates and applies new amounts only from the change month onward", () => {
    const user = {
      monthlyBill: 500,
      billHistory: [
        { effectiveYear: 2026, effectiveMonth: 7, monthlyBill: 150 },
        { effectiveYear: 2026, effectiveMonth: 8, monthlyBill: 500 },
      ],
    };

    expect(getEffectiveBillForPeriod(user, { month: 7, year: 2026 })).toBe(150);
    expect(getEffectiveBillForPeriod(user, { month: 8, year: 2026 })).toBe(500);
    expect(getEffectiveBillForPeriod(user, { month: 9, year: 2026 })).toBe(500);
  });

  it("creates a new bill history entry from the effective change month without mutating earlier periods", () => {
    const priorHistory = [
      { effectiveYear: 2026, effectiveMonth: 7, monthlyBill: 150 },
      { effectiveYear: 2026, effectiveMonth: 8, monthlyBill: 500 },
    ];

    expect(
      buildMonthlyBillHistoryEntry({
        existingHistory: priorHistory,
        effectiveMonth: 9,
        effectiveYear: 2026,
        newMonthlyBill: 700,
      }),
    ).toEqual([
      { effectiveYear: 2026, effectiveMonth: 7, monthlyBill: 150 },
      { effectiveYear: 2026, effectiveMonth: 8, monthlyBill: 500 },
      { effectiveYear: 2026, effectiveMonth: 9, monthlyBill: 700 },
    ]);
  });

  it("handles multiple bill changes in the same month by replacing the earlier change with the latest one", () => {
    // Scenario: User created in July with ৳150, bill changed to ৳500 in August,
    // then changed again to ৳200 in August
    const initialHistory = [
      { effectiveYear: 2026, effectiveMonth: 7, monthlyBill: 150 },
    ];

    // First change: August to ৳500
    const afterFirstChange = buildMonthlyBillHistoryEntry({
      existingHistory: initialHistory,
      effectiveMonth: 8,
      effectiveYear: 2026,
      newMonthlyBill: 500,
    });

    expect(afterFirstChange).toEqual([
      { effectiveYear: 2026, effectiveMonth: 7, monthlyBill: 150 },
      { effectiveYear: 2026, effectiveMonth: 8, monthlyBill: 500 },
    ]);

    // Second change: August to ৳200 (replaces the ৳500 entry)
    const afterSecondChange = buildMonthlyBillHistoryEntry({
      existingHistory: afterFirstChange,
      effectiveMonth: 8,
      effectiveYear: 2026,
      newMonthlyBill: 200,
    });

    expect(afterSecondChange).toEqual([
      { effectiveYear: 2026, effectiveMonth: 7, monthlyBill: 150 },
      { effectiveYear: 2026, effectiveMonth: 8, monthlyBill: 200 },
    ]);

    // Verify historical months stay locked
    const user = { monthlyBill: 200, billHistory: afterSecondChange };
    expect(getEffectiveBillForPeriod(user, { month: 7, year: 2026 })).toBe(150);
    expect(getEffectiveBillForPeriod(user, { month: 8, year: 2026 })).toBe(200);
    expect(getEffectiveBillForPeriod(user, { month: 9, year: 2026 })).toBe(200);
  });

  it("preserves historical month bills when no history entries exist and user.monthlyBill is later updated", () => {
    // Simulate a user created with no bill history (old users)
    const userInitial = {
      monthlyBill: 150, // Created in July with ৳150
      billHistory: [], // No history yet
    };

    // July should use the fallback monthlyBill
    expect(getEffectiveBillForPeriod(userInitial, { month: 7, year: 2026 })).toBe(150);

    // After adding a history entry for July
    const userWithHistory = {
      monthlyBill: 200,
      billHistory: [
        { effectiveYear: 2026, effectiveMonth: 7, monthlyBill: 150 },
        { effectiveYear: 2026, effectiveMonth: 8, monthlyBill: 200 },
      ],
    };

    // July should find the entry and use ৳150, not the new monthlyBill (200)
    expect(getEffectiveBillForPeriod(userWithHistory, { month: 7, year: 2026 })).toBe(150);
    expect(getEffectiveBillForPeriod(userWithHistory, { month: 8, year: 2026 })).toBe(200);
  });
});
