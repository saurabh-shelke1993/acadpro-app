/** Pure presentation helpers for the Owner preview. No reads, writes or date policy.
 * Selectively adapted from UI-C2.10's academyOwnerC25Adapter (3756914c).
 * null means unavailable; [] and 0 mean known empty/zero. IDs are filters,
 * never authorization. Batch breakdown labels are not authoritative batch IDs.
 */
const list = (value) => Array.isArray(value) ? value : null;
const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const text = (value) => typeof value === "string" && value.trim() ? value : null;
const number = (value) => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};
const count = (value) => {
  const result = number(value);
  return result !== null && Number.isSafeInteger(result) && result >= 0 ? result : null;
};

export const formatCount = (value) => count(value)?.toLocaleString("en-IN") ?? "—";
export const formatMoney = (value) => {
  const amount = number(value);
  return amount === null ? "—" : `₹${amount.toLocaleString("en-IN")}`;
};
export const formatTime = (value) => {
  const match = typeof value === "string" && value.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match || Number(match[1]) > 23) return "Time TBC";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
};

export const attendancePath = (session) => {
  const params = new URLSearchParams({ view: "mark" });
  // Without both IDs, open the canonical workspace rather than a partial scope.
  if (text(session?.centerId) && text(session?.batchId)) {
    params.set("centerId", session.centerId);
    params.set("batchId", session.batchId);
  }
  return `/attendance?${params}`;
};
export const centerPlayersPath = (center) => text(center?.id) && text(center?.academyId)
  ? `/players?${new URLSearchParams({ academyId: center.academyId, centerId: center.id })}`
  : "/players";
export const enquiriesPath = (group) => text(group?.centerId) && group.centerId !== "unassigned-center"
  ? `/enquiries?${new URLSearchParams({ centerId: group.centerId })}` : "/enquiries";

/** Group by IDs, including one null bucket for unidentified centers; never by name. */
export function groupAttendanceByCenter(rows) {
  if (!list(rows)) return null;
  const groups = new Map();
  rows.forEach((row) => {
    const centerId = text(row?.centerId);
    if (!groups.has(centerId)) {
      groups.set(centerId, { centerId, centerName: text(row?.centerName), rows: [] });
    }
    const group = groups.get(centerId);
    if (group.centerName === null) group.centerName = text(row?.centerName);
    group.rows.push(row);
  });
  return [...groups.values()];
}

/** undefined selects all; null selects unidentified centers; strings select exact IDs. */
export function filterAttendanceByCenter(rows, centerId) {
  if (!list(rows)) return null;
  return centerId === undefined ? [...rows] : rows.filter((row) => text(row?.centerId) === centerId);
}

/** Unknown/inconsistent counts invalidate the summary instead of implying zero marks. */
export function recordedMarkSummary(rows) {
  const unknown = { rate: null, present: null, marked: null, recordedBatches: null, totalBatches: null };
  if (!list(rows)) return unknown;
  let present = 0;
  let marked = 0;
  let recordedBatches = 0;
  for (const row of rows) {
    const rowPresent = count(row?.presentRecords);
    const rowMarked = count(row?.totalRecords);
    if (rowPresent === null || rowMarked === null || rowPresent > rowMarked) {
      return { ...unknown, totalBatches: rows.length };
    }
    present += rowPresent;
    marked += rowMarked;
    if (rowMarked > 0) recordedBatches += 1;
  }
  return { rate: marked ? Math.round(100 * present / marked) : null,
    present, marked, recordedBatches, totalBatches: rows.length };
}

/** Preserve the supplied service rate, including >100%; never recalculate or cap it. */
export function getCollectionRateLabel(financial) {
  const billed = number(financial?.totalBilledThisMonth);
  if (billed === 0) return "N/A";
  const rate = number(financial?.collectionRate);
  return billed !== null && billed > 0 && rate !== null ? `${rate.toLocaleString("en-IN")}%` : "—";
}

export function adaptOwnerData(data) {
  if (!record(data)) return null;
  const centers = list(data.centers)?.map((center) => ({
    id: text(center?.id), academyId: text(center?.academyId), name: text(center?.name),
    players: count(center?.players),
    batches: list(center?.ageGroups)?.map((batch) => ({
      name: text(batch?.name), players: count(batch?.players),
    })) ?? null,
  })) ?? null;
  const knownMemberships = centers && centers.every((center) => center.players !== null);
  return {
    academyName: text(data.academyName),
    totals: { ...record(data.totals), players: count(data.totals?.players),
      centers: count(data.totals?.centers), batches: count(data.totals?.batches) },
    centers,
    centerMemberships: knownMemberships ? centers.reduce((sum, center) => sum + center.players, 0) : null,
    sessions: list(data.todaySessions),
    attendanceBatches: list(data.attendanceByBatch),
    financial: record(data.financial),
    enquiries: record(data.enquirySummary),
  };
}
