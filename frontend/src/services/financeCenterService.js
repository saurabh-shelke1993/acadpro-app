import { supabase } from "../supabaseClient";

// F6: center attribution is based on the player's CURRENT center, not a historical snapshot.
const pageAll = async makeQuery => {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await makeQuery(from);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
    if (rows.length > 100000) throw new Error("Center report exceeds safe query limit.");
  }
  return rows;
};
const cents = amount => {
  if (amount === null || amount === "" || !Number.isFinite(Number(amount))) throw new Error("Invalid financial amount.");
  return Math.round(Number(amount) * 100);
};
export function aggregateCenterCollections(centers, players, payments) {
  const centerById = new Map(centers.map(center => [center.id, center]));
  const playerToCenter = new Map(players.map(player => [player.id, player.center_id]));
  const totals = new Map(centers.map(center => [center.id, { centerId: center.id, centerName: center.center_name, collectionsCents: 0, adjustmentsCents: 0, paymentCount: 0 }]));
  let unattributedCents = 0, unattributedEntries = 0;
  for (const payment of payments) {
    const centerId = playerToCenter.get(payment.player_id);
    const amount = cents(payment.amount_paid);
    const target = centerById.has(centerId) ? totals.get(centerId) : null;
    if (payment.payment_entry_type !== "payment" && payment.payment_entry_type !== "adjustment") throw new Error("Unknown payment entry type.");
    if (!target) { unattributedEntries++; if (payment.payment_entry_type === "payment") unattributedCents += amount; continue; }
    if (payment.payment_entry_type === "payment") { target.collectionsCents += amount; target.paymentCount++; }
    else target.adjustmentsCents += amount;
  }
  const academyGrossCents = [...totals.values()].reduce((sum, center) => sum + center.collectionsCents, 0) + unattributedCents;
  return {
    academyGross: academyGrossCents / 100,
    unattributedGross: unattributedCents / 100,
    unattributedEntries,
    centers: [...totals.values()].map(center => ({
      centerId: center.centerId, centerName: center.centerName,
      collections: center.collectionsCents / 100, adjustments: center.adjustmentsCents / 100,
      paymentCount: center.paymentCount,
      contributionPercent: academyGrossCents > 0 ? Math.round(center.collectionsCents / academyGrossCents * 10000) / 100 : null
    })).sort((a, b) => b.collections - a.collections || a.centerName.localeCompare(b.centerName))
  };
}
export async function getCenterCollections(user, startMonth, endExclusiveMonth) {
  if (!user?.academy_id || !user?.id) throw new Error("Academy Owner account required.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(endExclusiveMonth) || startMonth >= endExclusiveMonth) throw new Error("Invalid center report range.");
  const academyId = user.academy_id;
  const [centers, players] = await Promise.all([
    pageAll(from => supabase.from("centers").select("id,center_name").eq("academy_id", academyId).order("id").range(from, from + 499)),
    pageAll(from => supabase.from("players").select("id,center_id").eq("academy_id", academyId).order("id").range(from, from + 499))
  ]);
  const ids = players.map(player => player.id);
  const payments = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    payments.push(...await pageAll(from => supabase.from("payments")
      .select("id,player_id,payment_date,amount_paid,payment_entry_type")
      .in("player_id", chunk).gte("payment_date", startMonth + "-01T00:00:00+05:30")
      .lt("payment_date", endExclusiveMonth + "-01T00:00:00+05:30").order("id").range(from, from + 499)));
  }
  return aggregateCenterCollections(centers, players, payments);
}
