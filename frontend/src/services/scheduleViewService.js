import { supabase } from "../supabaseClient";

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
  centers ( id, center_name ),
  batches ( id, batch_name, age_group )
`;

const todayIso = () => new Date().toISOString().split("T")[0];

const isoDay = (dateValue) => {
  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getDay() === 0 ? 7 : date.getDay();
};

const formatTime = (value) => (value ? String(value).slice(0, 5) : "");

const formatSession = (schedule) => {
  if (!schedule) return "Session";
  const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const day = dayNames[Number(schedule.day_of_week)] || "Session";
  const time = schedule.start_time && schedule.end_time
    ? `${formatTime(schedule.start_time)}–${formatTime(schedule.end_time)}`
    : "";
  return [day, time, schedule.session_label].filter(Boolean).join(" · ");
};

const getDateForWeekday = (baseDate, dayOfWeek) => {
  const base = new Date(`${baseDate}T00:00:00`);
  const current = base.getDay() === 0 ? 7 : base.getDay();
  const delta = Number(dayOfWeek) - current;
  base.setDate(base.getDate() + delta);
  return base.toISOString().split("T")[0];
};

const enrichSchedulesWithPlayers = async (schedules, dateValue) => {
  if (!schedules.length) return [];

  const scheduleIds = schedules.map((schedule) => schedule.id);
  const { data, error } = await supabase
    .from("player_batch_schedules")
    .select(`
      id,
      player_id,
      batch_schedule_id,
      enrolled_from,
      enrolled_until,
      players ( id, full_name, is_active )
    `)
    .in("batch_schedule_id", scheduleIds)
    .eq("is_active", true);

  if (error) throw error;

  const bySchedule = new Map();
  (data || []).forEach((enrollment) => {
    if (enrollment.enrolled_from > dateValue) return;
    if (enrollment.enrolled_until && enrollment.enrolled_until < dateValue) return;
    if (!enrollment.players?.is_active) return;
    const list = bySchedule.get(enrollment.batch_schedule_id) || [];
    list.push(enrollment.players);
    bySchedule.set(enrollment.batch_schedule_id, list);
  });

  return schedules.map((schedule) => ({
    ...schedule,
    sessionLabel: formatSession(schedule),
    players: bySchedule.get(schedule.id) || [],
    playerCount: (bySchedule.get(schedule.id) || []).length,
  }));
};

export const getCoachScheduleView = async (user, dateValue = todayIso()) => {
  if (!user?.id) return { today: [], week: [] };

  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id, academy_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (coachError) throw coachError;
  if (!coach) return { today: [], week: [] };

  const day = isoDay(dateValue);

  const { data: assignments, error } = await supabase
    .from("coach_batch_schedule_assignments")
    .select(`
      id,
      batch_schedule_id,
      assigned_from,
      assigned_until,
      batch_schedules ( ${SCHEDULE_SELECT} )
    `)
    .eq("coach_id", coach.id)
    .eq("is_active", true);

  if (error) throw error;

  const assignmentsForToday = (assignments || []).filter((assignment) =>
    assignment.batch_schedules?.is_active &&
    assignment.assigned_from <= dateValue &&
    (!assignment.assigned_until || assignment.assigned_until >= dateValue)
  );
  const todaySchedules = assignmentsForToday
    .map((assignment) => assignment.batch_schedules)
    .filter((schedule) => Number(schedule.day_of_week) === day);

  const uniqueAssignments = [...new Map(
    (assignments || [])
      .filter((assignment) => assignment.batch_schedules?.is_active)
      .map((assignment) => [assignment.batch_schedule_id, {
        ...assignment.batch_schedules,
        assignment_id: assignment.id,
        assignment_from: assignment.assigned_from,
        assignment_until: assignment.assigned_until,
      }])
  ).values()];

  const enrichedToday = await enrichSchedulesWithPlayers(todaySchedules, dateValue);
  const enrichedWeek = (await Promise.all(uniqueAssignments.map(async (schedule) => {
    const sessionDate = getDateForWeekday(dateValue, schedule.day_of_week);
    if (schedule.assignment_from > sessionDate ||
        (schedule.assignment_until && schedule.assignment_until < sessionDate)) return null;
    const [enriched] = await enrichSchedulesWithPlayers([schedule], sessionDate);
    return enriched ? { ...enriched, date: sessionDate } : null;
  }))).filter(Boolean).sort((a, b) =>
    a.date.localeCompare(b.date) || String(a.start_time).localeCompare(String(b.start_time))
  );

  return {
    today: enrichedToday.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))),
    week: enrichedWeek,
  };
};

export const getParentScheduleView = async (childId, dateValue = todayIso()) => {
  if (!childId) return { today: [], next: null, week: [] };

  const { data, error } = await supabase
    .from("player_batch_schedules")
    .select(`
      id,
      player_id,
      batch_schedule_id,
      enrolled_from,
      enrolled_until,
      batch_schedules ( ${SCHEDULE_SELECT} )
    `)
    .eq("player_id", childId)
    .eq("is_active", true);

  if (error) throw error;

  const valid = (data || []).filter((enrollment) => enrollment.batch_schedules?.is_active);
  const currentDay = isoDay(dateValue);

  const todayEnrollmentRows = valid.filter((enrollment) =>
    Number(enrollment.batch_schedules.day_of_week) === currentDay &&
    enrollment.enrolled_from <= dateValue &&
    (!enrollment.enrolled_until || enrollment.enrolled_until >= dateValue)
  );
  const today = await enrichSchedulesWithPlayers(
    todayEnrollmentRows.map((enrollment) => enrollment.batch_schedules),
    dateValue
  );
  today.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

  const uniqueSchedules = [...new Map(
    valid.map((enrollment) => [enrollment.batch_schedule_id, {
      ...enrollment.batch_schedules,
      enrollment_from: enrollment.enrolled_from,
      enrollment_until: enrollment.enrolled_until,
    }])
  ).values()];
  const week = (await Promise.all(uniqueSchedules.map(async (schedule) => {
    const sessionDate = getDateForWeekday(dateValue, schedule.day_of_week);
    if (schedule.enrollment_from > sessionDate ||
        (schedule.enrollment_until && schedule.enrollment_until < sessionDate)) return null;
    const [enriched] = await enrichSchedulesWithPlayers([schedule], sessionDate);
    return enriched ? { ...enriched, date: sessionDate } : null;
  }))).filter(Boolean).sort((a, b) =>
    a.date.localeCompare(b.date) || String(a.start_time).localeCompare(String(b.start_time))
  );

  const nowTime = new Date().toTimeString().slice(0, 5);
  const next = today.find((schedule) => formatTime(schedule.end_time) >= nowTime) ||
    week.find((schedule) => schedule.date > dateValue);

  return { today, next: next || null, week };
};

export const getCoachAttendanceSessions = async (user, dateValue = todayIso()) => {
  const view = await getCoachScheduleView(user, dateValue);
  return view.today;
};

export const getAttendanceSessionsForBatch = async (batchId, centerId = "", dateValue = todayIso()) => {
  if (!batchId) return [];
  const day = isoDay(dateValue);

  let query = supabase
    .from("batch_schedules")
    .select(SCHEDULE_SELECT)
    .eq("batch_id", batchId)
    .eq("is_active", true)
    .eq("day_of_week", day)
    .order("start_time");

  if (centerId) query = query.eq("center_id", centerId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getEnrolledPlayersForSchedule = async (scheduleId, attendanceDate) => {
  if (!scheduleId) return [];

  const { data, error } = await supabase
    .from("player_batch_schedules")
    .select(`
      player_id,
      enrolled_from,
      enrolled_until,
      players!inner ( id, full_name, is_active, batch_id, center_id )
    `)
    .eq("batch_schedule_id", scheduleId)
    .eq("is_active", true)
    .lte("enrolled_from", attendanceDate);

  if (error) throw error;

  return (data || [])
    .filter((row) => !row.enrolled_until || row.enrolled_until >= attendanceDate)
    .filter((row) => row.players?.is_active)
    .map((row) => ({
      id: row.player_id,
      player_id: row.player_id,
      full_name: row.players?.full_name,
      batch_id: row.players?.batch_id,
      center_id: row.players?.center_id,
    }));
};

export const formatScheduleTime = formatTime;
export const formatScheduleLabel = formatSession;
