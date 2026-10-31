import { aggregateFinancePeriod, financeGrowth, getFinanceComparison, getFinancePeriod } from "./financeHistoryService";

describe("F3 Indian financial-year periods", () => {
  test("quarter and year boundaries", () => {
    expect(getFinancePeriod("2027-02", "quarterly")).toEqual({ startMonth: "2027-01", endExclusiveMonth: "2027-04", months: 3 });
    expect(getFinancePeriod("2026-10", "halfYearly")).toEqual({ startMonth: "2026-10", endExclusiveMonth: "2027-04", months: 6 });
    expect(getFinancePeriod("2027-03", "yearly")).toEqual({ startMonth: "2026-04", endExclusiveMonth: "2027-04", months: 12 });
  });
  test("previous, last-year and custom comparison", () => {
    const current = getFinancePeriod("2026-10", "quarterly");
    expect(getFinanceComparison(current, "previous").startMonth).toBe("2026-07");
    expect(getFinanceComparison(current, "lastYear").startMonth).toBe("2025-10");
    expect(getFinanceComparison(current, "custom", { startMonth: "2025-04", endExclusiveMonth: "2025-07" }).months).toBe(3);
    expect(() => getFinanceComparison(current, "custom", { startMonth: "2025-07", endExclusiveMonth: "2025-07" })).toThrow();
  });
  test("aggregation and growth do not treat zero baseline as growth", () => {
    expect(aggregateFinancePeriod([{ collections: 200, adjustments: -20, expenses: 50, netCashMovement: 130 }, { collections: 100, adjustments: 0, expenses: 10, netCashMovement: 90 }]))
      .toEqual({ collections: 300, adjustments: -20, expenses: 60, netCashMovement: 220 });
    expect(financeGrowth(150, 100)).toBe(50);
    expect(financeGrowth(150, 0)).toBeNull();
  });
});
