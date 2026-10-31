import { supabase } from "../supabaseClient";

const readAll = async query => {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query(offset);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
    if (rows.length > 100000) throw new Error("Quality audit exceeds safe query limit.");
  }
};
const toCents = amount => {
  if (amount === null || amount === "" || !Number.isFinite(Number(amount))) throw new Error("Invalid ledger amount.");
  return Math.round(Number(amount) * 100);
};
export function reconcileFinanceDues(dues, payments) {
  const ledger = new Map();
  for (const payment of payments) {
    if (!["payment", "adjustment"].includes(payment.payment_entry_type)) throw new Error("Unknown payment entry type.");
    ledger.set(payment.due_id, (ledger.get(payment.due_id) || 0) + toCents(payment.amount_paid));
  }
  let mismatchCount = 0, differenceCents = 0, paidWithoutEntries = 0, overlinkedCount = 0, underlinkedCount = 0, noLinkedTransactionAmountCents = 0;
  for (const due of dues) {
    const recorded = toCents(due.paid_amount);
    const linked = ledger.get(due.id) || 0;
    if (recorded !== linked) {
      mismatchCount++;
      differenceCents += recorded - linked;
      if (recorded < linked) overlinkedCount++;
      if (recorded > linked) underlinkedCount++;
      if (!ledger.has(due.id) && recorded > 0) { paidWithoutEntries++; noLinkedTransactionAmountCents += recorded; }
    }
  }
  return { dueCount: dues.length, mismatchCount, difference: differenceCents / 100, paidWithoutEntries,
    overlinkedCount, underlinkedCount, noLinkedTransactionAmount: noLinkedTransactionAmountCents / 100,
    quality: mismatchCount ? "partial" : "reconciled",
    historicalOutstandingAvailable: false, collectionEfficiencyAvailable: false };
}
export async function getFinanceQuality(user) {
  if (!user?.academy_id || !user?.id) throw new Error("Academy Owner account required.");
  const players = await readAll(from => supabase.from("players").select("id").eq("academy_id", user.academy_id).order("id").range(from, from + 499));
  const ids = players.map(row => row.id);
  const dues = [], payments = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    dues.push(...await readAll(from => supabase.from("payment_dues").select("id,paid_amount").in("player_id", chunk).order("id").range(from, from + 499)));
    payments.push(...await readAll(from => supabase.from("payments").select("id,due_id,amount_paid,payment_entry_type").in("player_id", chunk).order("id").range(from, from + 499)));
  }
  return reconcileFinanceDues(dues, payments);
}
