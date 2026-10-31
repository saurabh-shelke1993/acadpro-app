import { collectionGrowth, comparisonPeriod, customComparison, financePeriod, recordedCollections } from "./financePeriodUtils.ts";
Deno.test("Indian FY quarters, half-years and rollover", () => {
  const q = financePeriod("2027-02-01", "quarter");
  if (q.start !== "2027-01-01" || q.endExclusive !== "2027-04-01") throw new Error("Q4 boundary");
  const h = financePeriod("2026-10-01", "half_year");
  if (h.start !== "2026-10-01" || h.endExclusive !== "2027-04-01") throw new Error("H2 boundary");
  const y = financePeriod("2027-03-01", "year");
  if (y.start !== "2026-04-01" || y.endExclusive !== "2027-04-01") throw new Error("FY boundary");
});
Deno.test("previous and last-year comparisons preserve period length", () => {
  const current = financePeriod("2026-10-01", "quarter");
  if (comparisonPeriod(current, "quarter", "previous").start !== "2026-07-01") throw new Error("Previous quarter");
  if (comparisonPeriod(current, "quarter", "last_year").start !== "2025-10-01") throw new Error("Prior-year quarter");
  if (customComparison("2025-04-01", "2026-04-01").endExclusive !== "2026-04-01") throw new Error("Custom comparison");
});
Deno.test("invalid ranges and zero growth baselines do not invent percentages", () => {
  if (collectionGrowth(150, 100) !== 50 || collectionGrowth(150, 0) !== null || collectionGrowth(null, 100) !== null) throw new Error("Growth rule");
  for (const input of ["2026-02-02", "2026-13-01"]) {
    let rejected = false; try { financePeriod(input, "month"); } catch { rejected = true; }
    if (!rejected) throw new Error("Invalid date accepted");
  }
  let rejected = false; try { customComparison("2026-04-01", "2026-04-01"); } catch { rejected = true; }
  if (!rejected) throw new Error("Empty comparison accepted");
});
Deno.test("IST boundaries and adjustment separation", () => {
  const range = financePeriod("2026-10-01", "month");
  const rows = [
    { payment_date: "2026-09-30T18:29:59Z", payment_entry_type: "payment", amount_paid: 999 },
    { payment_date: "2026-09-30T18:30:00Z", payment_entry_type: "payment", amount_paid: 500 },
    { payment_date: "2026-10-02T00:00:00Z", payment_entry_type: "adjustment", amount_paid: -50 },
    { payment_date: "2026-10-31T18:30:00Z", payment_entry_type: "payment", amount_paid: 999 },
  ];
  const result = recordedCollections(rows, range);
  if (result.gross !== 500 || result.adjustments !== -50) throw new Error("Wrong collections");
});
