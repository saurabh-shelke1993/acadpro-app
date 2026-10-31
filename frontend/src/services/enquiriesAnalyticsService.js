import { supabase } from "../supabaseClient";

// Read-only Enquiries Analytics. Cohorts use the enquiry creation month in
// Asia/Kolkata; conversion is counted to date, not in the conversion month.
// Do not return names, phone numbers, DOBs or other enquiry PII.
const PAGE_SIZE = 500;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function assertMonth(month) {
  const match = MONTH_PATTERN.exec(String(month || ""));
  if (!match) throw new Error("Select a valid reporting month (YYYY-MM).");
  return { year: Number(match[1]), monthNumber: Number(match[2]) };
}

function monthBoundary(year, monthNumber) {
  const nextYear = year + Math.floor((monthNumber - 1) / 12);
  const nextMonth = ((monthNumber - 1) % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+05:30`;
}

function cohortMonth(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit"
  }).formatToParts(date);
  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}`;
}

function emptyStats() {
  return { received: 0, converted: 0, conversionRate: null };
}

function finalize(stats) {
  return {
    ...stats,
    conversionRate: stats.received ? Math.round((stats.converted / stats.received) * 1000) / 10 : null
  };
}

async function fetchAll(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * @param {{id: string, academy_id: string, role?: string}} user signed-in academy owner
 * @param {{startMonth: string, endMonth: string}} range inclusive calendar months
 * @returns monthly academy/center cohort totals; never returns enquiry identities
 */
export async function getAcademyEnquiriesAnalytics(user, { startMonth, endMonth }) {
  if (!user?.id || !user?.academy_id || (user.role && user.role !== "academy_owner")) {
    throw new Error("Academy Owner access is required.");
  }
  const start = assertMonth(startMonth);
  const end = assertMonth(endMonth);
  const startIndex = start.year * 12 + start.monthNumber;
  const endIndex = end.year * 12 + end.monthNumber;
  if (endIndex < startIndex || endIndex - startIndex > 59) {
    throw new Error("Select a chronological reporting range of at most 60 calendar months.");
  }

  // This client uses the signed-in user's Supabase session and existing RLS.
  // Scope both source queries by academy_id, independently of UI selections.
  const centers = await fetchAll(() => supabase.from("centers")
    .select("id, center_name")
    .eq("academy_id", user.academy_id)
    .order("id", { ascending: true }));

  const enquiries = await fetchAll(() => supabase.from("inquiries")
    .select("id, assigned_center_id, created_at, status, converted_at, converted_player_id")
    .eq("academy_id", user.academy_id)
    .gte("created_at", monthBoundary(start.year, start.monthNumber))
    .lt("created_at", monthBoundary(end.year, end.monthNumber + 1))
    .order("created_at", { ascending: true })
    .order("id", { ascending: true }));

  const centerMap = new Map(centers.map(center => [String(center.id), center]));
  const months = [];
  for (let index = startIndex; index <= endIndex; index++) {
    const year = Math.floor((index - 1) / 12);
    const number = ((index - 1) % 12) + 1;
    const month = `${year}-${String(number).padStart(2, "0")}`;
    months.push({
      month,
      ...emptyStats(),
      centers: centers.map(center => ({
        centerId: String(center.id),
        centerName: center.center_name || "Unnamed center",
        ...emptyStats()
      })),
      unassigned: emptyStats(),
      unknownCenter: emptyStats()
    });
  }

  const byMonth = new Map(months.map(row => [row.month, row]));
  for (const enquiry of enquiries) {
    const row = byMonth.get(cohortMonth(enquiry.created_at));
    if (!row) continue;
    const converted = Boolean(enquiry.converted_player_id && enquiry.converted_at);
    const assignedId = enquiry.assigned_center_id == null ? null : String(enquiry.assigned_center_id);
    const target = assignedId === null
      ? row.unassigned
      : centerMap.has(assignedId)
        ? row.centers.find(center => center.centerId === assignedId)
        : row.unknownCenter;
    row.received += 1;
    target.received += 1;
    if (converted) {
      row.converted += 1;
      target.converted += 1;
    }
  }

  const finalizedMonths = months.map(row => ({
    ...finalize(row),
    centers: row.centers.map(finalize),
    unassigned: finalize(row.unassigned),
    unknownCenter: finalize(row.unknownCenter)
  }));
  const totals = finalizedMonths.reduce((acc, row) => {
    acc.received += row.received;
    acc.converted += row.converted;
    return acc;
  }, emptyStats());

  return {
    startMonth,
    endMonth,
    timezone: "Asia/Kolkata",
    conversionDefinition: "Enquiry creation-month cohort; converted to date when both converted_player_id and converted_at exist",
    totals: finalize(totals),
    months: finalizedMonths
  };
}
