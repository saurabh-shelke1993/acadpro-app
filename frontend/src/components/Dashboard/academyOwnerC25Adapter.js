/** UI-C2.5 read-only adapter for the existing Academy Owner dashboard service. */
const COLORS = ["#2563eb", "#0d9488", "#d79630", "#7c3aed", "#d94680", "#64748b"];
const list = (v) => Array.isArray(v) ? v : null;
const count = (v) => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
export const formatCount = (v) => v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("en-IN");
export const formatMoney = (v) => v == null || !Number.isFinite(Number(v)) ? "—" : `₹${Number(v).toLocaleString("en-IN")}`;
export const formatTime = (v) => {
  const m = String(v || "").match(/^(\d{1,2}):(\d\d)/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return "Time TBC";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
};
export const centerPlayersPath = (center) => {
  if (!center?.id || !center?.academyId) return "/players";
  return `/players?${new URLSearchParams({academyId: String(center.academyId), centerId: String(center.id)})}`;
};
export const attendancePath = (session) => {
  if (!session?.centerId || !session?.batchId) return "/attendance";
  return `/attendance?${new URLSearchParams({centerId: String(session.centerId), batchId: String(session.batchId)})}`;
};
export const enquiriesPath = (group) => group?.centerId
  ? `/enquiries?${new URLSearchParams({centerId: String(group.centerId)})}` : "/enquiries";
export function recordedMarkSummary(batches) {
  if (!Array.isArray(batches)) return {rate:null, present:0, marked:0, recordedBatches:0, totalBatches:0};
  const present = batches.reduce((n, b) => n + count(b.presentRecords), 0);
  const marked = batches.reduce((n, b) => n + count(b.totalRecords), 0);
  return {rate: marked ? Math.round(100 * present / marked) : null,
    present, marked,
    recordedBatches: batches.filter((b) => count(b.totalRecords) > 0).length,
    totalBatches: batches.length};
}
export function adaptOwnerData(data) {
  if (!data || typeof data !== "object") return null;
  return {
    academyName: data.academyName || "Academy",
    totals: data.totals || {},
    centers: list(data.centers)?.map((c, i) => ({
      id: c.id, academyId: c.academyId, name: c.name || "Unnamed center",
      players: count(c.players), color: COLORS[i % COLORS.length],
      batches: (list(c.ageGroups) || []).map((b,j) => ({id:`${c.id || i}-${j}`, name:b.name || "Unnamed batch",players:count(b.players)}))
    })) ?? null,
    sessions: list(data.todaySessions),
    attendanceBatches: list(data.attendanceByBatch),
    financial: data.financial && typeof data.financial === "object" ? data.financial : null,
    enquiries: data.enquirySummary && typeof data.enquirySummary === "object" ? data.enquirySummary : null
  };
}
export function groupByCenter(rows, getKey, getLabel) {
  const groups = new Map();
  (list(rows) || []).forEach((row) => {
    const key = getKey(row);
    if (!groups.has(key)) groups.set(key, {key, name:getLabel(row), rows:[]});
    groups.get(key).rows.push(row);
  });
  return [...groups.values()];
}
