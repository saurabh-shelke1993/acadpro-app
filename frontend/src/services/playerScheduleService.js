import { supabase } from "../supabaseClient";

const ENROLLMENT_SELECT = `
  id,
  academy_id,
  player_id,
  batch_schedule_id,
  is_active,
  enrolled_from,
  enrolled_until,
  created_at,
  updated_at,
  players ( id, full_name, batch_id, center_id ),
  batch_schedules (
    id,
    batch_id,
    center_id,
    day_of_week,
    start_time,
    end_time,
    session_label,
    is_active,
    centers ( id, center_name ),
    batches ( id, batch_name, age_group )
  )
`;

export const getPlayerScheduleEnrollments = async ({
  academyId = "",
  centerId = "",
  batchId = "",
  playerId = ""
} = {}) => {
  let query = supabase
    .from("player_batch_schedules")
    .select(ENROLLMENT_SELECT)
    .eq("is_active", true)
    .order("enrolled_from")
    .order("player_id");

  if (academyId) query = query.eq("academy_id", academyId);
  if (playerId) query = query.eq("player_id", playerId);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).filter((item) => {
    const schedule = item.batch_schedules;
    if (!schedule) return false;
    if (centerId && schedule.center_id !== centerId) return false;
    if (batchId && schedule.batch_id !== batchId) return false;
    return true;
  });
};

export const getPlayerScheduleEnrollment = async (playerId, scheduleId) => {
  const { data, error } = await supabase
    .from("player_batch_schedules")
    .select(ENROLLMENT_SELECT)
    .eq("player_id", playerId)
    .eq("batch_schedule_id", scheduleId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const enrollPlayerInSchedule = async ({
  academyId,
  playerId,
  batchScheduleId,
  enrolledFrom,
  enrolledUntil = null
}) => {
  const { data, error } = await supabase
    .from("player_batch_schedules")
    .insert({
      academy_id: academyId,
      player_id: playerId,
      batch_schedule_id: batchScheduleId,
      is_active: true,
      enrolled_from: enrolledFrom,
      enrolled_until: enrolledUntil || null
    })
    .select(ENROLLMENT_SELECT)
    .single();

  if (error) throw error;
  return data;
};

export const updatePlayerScheduleEnrollment = async (
  enrollmentId,
  { enrolledFrom, enrolledUntil = null }
) => {
  const { data, error } = await supabase
    .from("player_batch_schedules")
    .update({
      enrolled_from: enrolledFrom,
      enrolled_until: enrolledUntil || null
    })
    .eq("id", enrollmentId)
    .select(ENROLLMENT_SELECT)
    .single();

  if (error) throw error;
  return data;
};

export const deactivatePlayerScheduleEnrollment = async (enrollmentId) => {
  const { error } = await supabase
    .from("player_batch_schedules")
    .update({ is_active: false })
    .eq("id", enrollmentId);

  if (error) throw error;
};

export const getActiveSchedulesForBatch = async (batchId) => {
  if (!batchId) return [];

  const { data, error } = await supabase
    .from("batch_schedules")
    .select(`
      id,
      batch_id,
      center_id,
      day_of_week,
      start_time,
      end_time,
      session_label,
      is_active,
      centers ( id, center_name ),
      batches ( id, batch_name, age_group )
    `)
    .eq("batch_id", batchId)
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  if (error) throw error;
  return data || [];
};

export const getDayName = (dayOfWeek) =>
  ({
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday"
  })[Number(dayOfWeek)] || "—";
