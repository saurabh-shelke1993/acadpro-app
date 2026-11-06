import { supabase } from "../supabaseClient";
import { getAccessibleBatches } from "../utils/dataScope";

export const ATTENDANCE_HISTORY_PAGE_SIZE = 5;

/** Read only one RLS-scoped page and its exact filtered count. */
export const getAttendanceHistoryPage = async ({
  user, academyId = "", centerId = "", batchId = "",
  playerName = "", status = "", startDate = "", endDate = "", page = 1,
}) => {
  if (!user || !["super_admin", "academy_owner", "coach"].includes(user.role)) {
    return { rows: [], count: 0 };
  }
  if (user.role !== "super_admin" &&
      (!user.academy_id || (academyId && academyId !== user.academy_id))) {
    throw new Error("Attendance academy scope does not match this user.");
  }
  const scopedAcademy = user.role === "super_admin" ? academyId : user.academy_id;

  let centerBatchIds = [];
  if (centerId) {
    // Preserve historical rows without center_id: filter by authorized batches.
    const batches = await getAccessibleBatches(user, centerId);
    centerBatchIds = [...new Set((batches || []).map((batch) => batch.id).filter(Boolean))];
    if (!centerBatchIds.length || (batchId && !centerBatchIds.includes(batchId))) {
      return { rows: [], count: 0 };
    }
  }
  const search = playerName.trim();
  const playerRelation = search ? "players!inner(full_name)" : "players(full_name)";
  const fields = [
    "id", "academy_id", "player_id", "batch_id", "attendance_date", "status",
    playerRelation,
    "batches(batch_name,centers(center_name))",
    "batch_schedules(day_of_week,start_time,end_time,session_label)",
    "users!attendance_marked_by_fkey(full_name)",
  ].join(",");

  let query = supabase.from("attendance")
    .select(fields, { count: "exact" })
    .eq("is_deleted", false);
  if (scopedAcademy) query = query.eq("academy_id", scopedAcademy);
  if (centerId) query = query.in("batch_id", centerBatchIds);
  if (batchId) query = query.eq("batch_id", batchId);
  if (status) query = query.eq("status", status);
  if (startDate) query = query.gte("attendance_date", startDate);
  if (endDate) query = query.lte("attendance_date", endDate);
  if (search) query = query.ilike("players.full_name", `%${search}%`);

  const safePage = Math.max(1, Number.isInteger(page) ? page : 1);
  const from = (safePage - 1) * ATTENDANCE_HISTORY_PAGE_SIZE;
  const { data, count, error } = await query
    .order("attendance_date", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + ATTENDANCE_HISTORY_PAGE_SIZE - 1);
  if (error) throw error;
  if (count == null) throw new Error("Attendance history count unavailable.");
  return { rows: data || [], count };
};
