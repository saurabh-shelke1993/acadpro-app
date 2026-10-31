import { supabase } from "../supabaseClient";

// Read-only F3 historical collection/expense reporting. All source reads are
// restricted to the signed-in owner's academy; no service-role client is used.
const monthIndex = month => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month.");
  const [year, m] = month.split("-").map(Number);
  return year * 12 + m - 1;
};
const monthName = index => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
export function getFinancePeriod(month, frequency = "monthly") {
  const index = monthIndex(month);
  const size = { monthly: 1, quarterly: 3, halfYearly: 6, yearly: 12 }[frequency];
  if (!size) throw new Error("Invalid frequency.");
  const fyStart = index - ((index % 12 - 3 + 12) % 12);
  const start = fyStart + Math.floor((index - fyStart) / size) * size;
  return { startMonth: monthName(start), endExclusiveMonth: monthName(start + size), months: size };
}
export function getFinanceComparison(period, mode = "previous", custom = null) {
  const start = monthIndex(period.startMonth);
  if (mode === "custom") {
    if (!custom) throw new Error("Custom comparison dates are required.");
    const customStart = monthIndex(custom.startMonth), customEnd = monthIndex(custom.endExclusiveMonth);
    if (customEnd <= customStart || customEnd - customStart > 60) throw new Error("Custom range must span 1–60 months.");
    return { startMonth: custom.startMonth, endExclusiveMonth: custom.endExclusiveMonth, months: customEnd - customStart };
  }
  if (!["previous", "lastYear"].includes(mode)) throw new Error("Invalid comparison mode.");
  const offset = mode === "previous" ? period.months : 12;
  return { startMonth: monthName(start - offset), endExclusiveMonth: monthName(start - offset + period.months), months: period.months };
}
const utcBoundary = month => month + "-01T00:00:00+05:30";
const toCents = value => {
  if (value === null || value === "" || !Number.isFinite(Number(value))) throw new Error("Invalid financial amount in ledger.");
  return Math.round(Number(value) * 100);
};
const pages = async queryPage => {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await queryPage(from);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
    if (rows.length > 100000) throw new Error("Financial report exceeds safe query limit.");
  }
  return rows;
};
export async function getFinanceHistory(user, startMonth, endExclusiveMonth) {
  if (!user?.academy_id || !user?.id) throw new Error("Academy Owner account required.");
  const start = monthIndex(startMonth), end = monthIndex(endExclusiveMonth);
  if (end <= start || end - start > 60) throw new Error("Select 1–60 months.");
  const academyId = user.academy_id;
  const players = await pages(from => supabase.from("players").select("id").eq("academy_id", academyId).order("id").range(from, from + 499));
  const playerIds = players.map(player => player.id);
  const payments = [];
  for (let offset = 0; offset < playerIds.length; offset += 100) {
    const ids = playerIds.slice(offset, offset + 100);
    const chunk = await pages(from => supabase.from("payments")
      .select("id,player_id,payment_date,amount_paid,payment_entry_type")
      .in("player_id", ids).gte("payment_date", utcBoundary(startMonth))
      .lt("payment_date", utcBoundary(endExclusiveMonth)).order("id").range(from, from + 499));
    payments.push(...chunk);
  }
  const expenses = await pages(from => supabase.from("expenses")
    .select("id,expense_date,amount_paid").eq("academy_id", academyId)
    .gte("expense_date", startMonth + "-01").lt("expense_date", endExclusiveMonth + "-01")
    .order("id").range(from, from + 499));
  const result = Array.from({ length: end - start }, (_, index) => ({
    month: monthName(start + index), collectionsCents: 0, adjustmentsCents: 0, expensesCents: 0, paymentCount: 0, expenseCount: 0
  }));
  const byMonth = new Map(result.map(row => [row.month, row]));
  for (const payment of payments) {
    const date = new Date(payment.payment_date);
    if (!Number.isFinite(date.getTime())) throw new Error("Invalid payment date.");
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(date);
    const key = month.find(p => p.type === "year").value + "-" + month.find(p => p.type === "month").value;
    const row = byMonth.get(key);
    if (!row) continue;
    const amount = toCents(payment.amount_paid);
    if (payment.payment_entry_type === "payment") { row.collectionsCents += amount; row.paymentCount++; }
    else if (payment.payment_entry_type === "adjustment") row.adjustmentsCents += amount;
    else throw new Error("Unsupported payment entry type; totals cannot be verified.");
  }
  for (const expense of expenses) {
    const row = byMonth.get(expense.expense_date?.slice(0, 7));
    if (row) { row.expensesCents += toCents(expense.amount_paid); row.expenseCount++; }
  }
  return result.map(row => ({
    month: row.month, collections: row.collectionsCents / 100, adjustments: row.adjustmentsCents / 100,
    expenses: row.expensesCents / 100, netCashMovement: (row.collectionsCents + row.adjustmentsCents - row.expensesCents) / 100,
    paymentCount: row.paymentCount, expenseCount: row.expenseCount
  }));
}
export function aggregateFinancePeriod(rows) {
  return rows.reduce((sum, row) => ({
    collections: sum.collections + row.collections, adjustments: sum.adjustments + row.adjustments,
    expenses: sum.expenses + row.expenses, netCashMovement: sum.netCashMovement + row.netCashMovement
  }), { collections: 0, adjustments: 0, expenses: 0, netCashMovement: 0 });
}
export function financeGrowth(current, previous) {
  return previous > 0 && Number.isFinite(current) && Number.isFinite(previous)
    ? Math.round(((current - previous) / previous) * 10000) / 100 : null;
}

export function buildFinanceTrend(rows, frequency = "monthly") {
  if (!["monthly", "quarterly", "halfYearly", "yearly"].includes(frequency)) throw new Error("Invalid trend frequency.");
  const groups = new Map();
  for (const row of rows) {
    const period = getFinancePeriod(row.month, frequency);
    if (!groups.has(period.startMonth)) groups.set(period.startMonth, {
      period: period.startMonth, endExclusiveMonth: period.endExclusiveMonth,
      collections: 0, adjustments: 0, expenses: 0, netCashMovement: 0, months: 0
    });
    const group = groups.get(period.startMonth);
    group.collections += row.collections;
    group.adjustments += row.adjustments;
    group.expenses += row.expenses;
    group.netCashMovement += row.netCashMovement;
    group.months++;
  }
  const sorted = Array.from(groups.values()).sort((a, b) => a.period.localeCompare(b.period));
  return sorted.map((group, index) => ({
    ...group,
    growthPercent: index > 0 ? financeGrowth(group.collections, sorted[index - 1].collections) : null,
    // A period is complete only when all expected monthly buckets were loaded.
    complete: group.months === getFinancePeriod(group.period, frequency).months
  }));
}
