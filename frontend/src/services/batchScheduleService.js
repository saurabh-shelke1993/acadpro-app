import { supabase } from "../supabaseClient";

const DAY_NAMES = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday"
};

const SCHEDULE_SELECT = `
  id,
  academy_id,
  batch_id,
  center_id,
  day_of_week,
  start_time,
  end_time,
  session_label,
  is_active,
  created_at,
  updated_at,
  academies ( id, academy_name ),
  centers ( id, center_name ),
  batches ( id, batch_name, age_group, start_time, end_time )
`;

export const getDayName = (dayOfWeek) =>
  DAY_NAMES[Number(dayOfWeek)] || "—";

export const getAccessibleBatchSchedules = async ({
  academyId = "",
  centerId = "",
  batchId = ""
} = {}) => {
  let query = supabase
    .from("batch_schedules")
    .select(SCHEDULE_SELECT)
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time")
    .order("session_label");

  if (academyId) query = query.eq("academy_id", academyId);
  if (centerId) query = query.eq("center_id", centerId);
  if (batchId) query = query.eq("batch_id", batchId);

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
};

export const createBatchSchedule = async ({
  academyId,
  batchId,
  centerId,
  dayOfWeek,
  startTime,
  endTime,
  sessionLabel = ""
}) => {
  const { data, error } = await supabase
    .from("batch_schedules")
    .insert({
      academy_id: academyId,
      batch_id: batchId,
      center_id: centerId,
      day_of_week: Number(dayOfWeek),
      start_time: startTime,
      end_time: endTime,
      session_label: sessionLabel.trim() || null,
      is_active: true
    })
    .select(SCHEDULE_SELECT)
    .single();

  if (error) throw error;
  return data;
};

export const updateBatchSchedule = async (
  scheduleId,
  {
    academyId,
    batchId,
    centerId,
    dayOfWeek,
    startTime,
    endTime,
    sessionLabel = ""
  }
) => {
  const { data, error } = await supabase
    .from("batch_schedules")
    .update({
      academy_id: academyId,
      batch_id: batchId,
      center_id: centerId,
      day_of_week: Number(dayOfWeek),
      start_time: startTime,
      end_time: endTime,
      session_label: sessionLabel.trim() || null
    })
    .eq("id", scheduleId)
    .select(SCHEDULE_SELECT)
    .single();

  if (error) throw error;
  return data;
};

export const deactivateBatchSchedule = async (scheduleId) => {
  const { error } = await supabase
    .from("batch_schedules")
    .update({ is_active: false })
    .eq("id", scheduleId);

  if (error) throw error;
};
