jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
import { aggregateFinancePeriod, buildFinanceTrend, financeGrowth, getFinanceComparison, getFinancePeriod } from "./financeHistoryService";

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

describe("F5 trend grouping", () => {
  const row = (month, collections, expenses = 0) => ({ month, collections, adjustments: 0, expenses, netCashMovement: collections - expenses });
  test("quarterly buckets align to Indian FY and preserve zero months", () => {
    const trend = buildFinanceTrend([row("2026-03", 100), row("2026-04", 200), row("2026-05", 0), row("2026-06", 100)], "quarterly");
    expect(trend.map(item => item.period)).toEqual(["2026-01", "2026-04"]);
    expect(trend[1].collections).toBe(300);
    expect(trend[1].growthPercent).toBe(200);
    expect(trend[0].complete).toBe(false);
    expect(trend[1].complete).toBe(true);
  });
  test("yearly and half-yearly aggregation follows April boundaries", () => {
    const rows = [row("2026-03", 10), row("2026-04", 20), row("2026-10", 30)];
    expect(buildFinanceTrend(rows, "yearly").map(item => item.period)).toEqual(["2025-04", "2026-04"]);
    expect(buildFinanceTrend(rows, "halfYearly").map(item => item.period)).toEqual(["2025-10", "2026-04", "2026-10"]);
  });
});
