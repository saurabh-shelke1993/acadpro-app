import { supabase } from "../supabaseClient";

const ASSIGNMENT_SELECT = `
  id,
  academy_id,
  batch_schedule_id,
  coach_id,
  is_active,
  assigned_from,
  assigned_until,
  created_at,
  updated_at,
  coaches ( id, full_name, is_active ),
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

export const getCoachScheduleAssignments = async ({
  academyId = "",
  centerId = "",
  batchId = "",
  scheduleId = "",
  coachId = ""
} = {}) => {
  let query = supabase
    .from("coach_batch_schedule_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("is_active", true)
    .order("assigned_from")
    .order("coach_id");

  if (academyId) query = query.eq("academy_id", academyId);
  if (scheduleId) query = query.eq("batch_schedule_id", scheduleId);
  if (coachId) query = query.eq("coach_id", coachId);

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

export const assignCoachToSchedule = async ({
  academyId,
  batchScheduleId,
  coachId,
  assignedFrom,
  assignedUntil = null
}) => {
  const { data, error } = await supabase
    .from("coach_batch_schedule_assignments")
    .insert({
      academy_id: academyId,
      batch_schedule_id: batchScheduleId,
      coach_id: coachId,
      is_active: true,
      assigned_from: assignedFrom,
      assigned_until: assignedUntil || null
    })
    .select(ASSIGNMENT_SELECT)
    .single();

  if (error) throw error;
  return data;
};

export const updateCoachScheduleAssignment = async (
  assignmentId,
  { assignedFrom, assignedUntil = null }
) => {
  const { data, error } = await supabase
    .from("coach_batch_schedule_assignments")
    .update({
      assigned_from: assignedFrom,
      assigned_until: assignedUntil || null
    })
    .eq("id", assignmentId)
    .select(ASSIGNMENT_SELECT)
    .single();

  if (error) throw error;
  return data;
};

export const deactivateCoachScheduleAssignment = async (assignmentId) => {
  const { error } = await supabase
    .from("coach_batch_schedule_assignments")
    .update({ is_active: false })
    .eq("id", assignmentId);

  if (error) throw error;
};

export const getActiveCoachesForAcademy = async (academyId) => {
  if (!academyId) return [];
  const { data, error } = await supabase
    .from("coaches")
    .select("id, full_name, is_active")
    .eq("academy_id", academyId)
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  return data || [];
};

export const getActiveSchedules = async ({ academyId = "", centerId = "", batchId = "" } = {}) => {
  let query = supabase
    .from("batch_schedules")
    .select(`
      id,
      academy_id,
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
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  if (academyId) query = query.eq("academy_id", academyId);
  if (centerId) query = query.eq("center_id", centerId);
  if (batchId) query = query.eq("batch_id", batchId);

  const { data, error } = await query;
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
