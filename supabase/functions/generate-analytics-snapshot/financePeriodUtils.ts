// Pure Indian financial-year period and comparison calculator. No database access.
export type Granularity = "month" | "quarter" | "half_year" | "year";
export type Period = { start: string; endExclusive: string; startInstant: string; endInstant: string };
const iso = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`;
function monthIndex(date: string): number {
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(date)) throw new Error("Expected first day of month YYYY-MM-01.");
  const [year, month] = date.split("-").map(Number);
  return year * 12 + month - 1;
}
function period(startIndex: number, months: number): Period {
  const first = iso(Math.floor(startIndex / 12), startIndex % 12 + 1);
  const next = startIndex + months;
  const end = iso(Math.floor(next / 12), next % 12 + 1);
  return { start: first, endExclusive: end, startInstant: first + "T00:00:00+05:30", endInstant: end + "T00:00:00+05:30" };
}
export function financePeriod(month: string, granularity: Granularity): Period {
  const index = monthIndex(month);
  const m = index % 12; // January=0; April=3
  const fyStart = index - ((m - 3 + 12) % 12);
  const size = ({ month: 1, quarter: 3, half_year: 6, year: 12 } as const)[granularity];
  if (!size) throw new Error("Unsupported granularity.");
  return period(fyStart + Math.floor((index - fyStart) / size) * size, size);
}
export function comparisonPeriod(current: Period, granularity: Granularity, mode: "previous" | "last_year"): Period {
  const size = ({ month: 1, quarter: 3, half_year: 6, year: 12 } as const)[granularity];
  if (!size || monthIndex(current.endExclusive) - monthIndex(current.start) !== size) throw new Error("Invalid current period.");
  return period(monthIndex(current.start) - (mode === "previous" ? size : 12), size);
}
export function customComparison(startMonth: string, endExclusiveMonth: string): Period {
  const start = monthIndex(startMonth), end = monthIndex(endExclusiveMonth);
  if (end <= start || end - start > 60) throw new Error("Custom comparison must be 1–60 months.");
  return period(start, end - start);
}
export function collectionGrowth(current: number | null, baseline: number | null): number | null {
  if (current === null || baseline === null || !Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0) return null;
  return Math.round(((current - baseline) / baseline) * 10000) / 100;
}
export function recordedCollections<T extends { payment_date: string | null; payment_entry_type: string | null; amount_paid: string | number | null }>(rows: T[], range: Period) {
  let gross = 0, adjustments = 0, invalidCount = 0, unclassifiedCount = 0;
  const from = Date.parse(range.startInstant), until = Date.parse(range.endInstant);
  for (const row of rows) {
    const time = Date.parse(row.payment_date ?? "");
    if (!Number.isFinite(time) || time < from || time >= until) continue;
    if (row.payment_entry_type !== "payment" && row.payment_entry_type !== "adjustment") { unclassifiedCount++; continue; }
    const amount = row.amount_paid === null || String(row.amount_paid).trim() === "" ? NaN : Number(row.amount_paid);
    if (!Number.isFinite(amount)) { invalidCount++; continue; }
    if (row.payment_entry_type === "payment") gross += amount;
    else adjustments += amount;
  }
  return { gross: invalidCount || unclassifiedCount ? null : Math.round(gross * 100) / 100,
    adjustments: invalidCount || unclassifiedCount ? null : Math.round(adjustments * 100) / 100,
    invalidCount, unclassifiedCount };
}
