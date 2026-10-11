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
  const date = new Date(`${dateValue}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay() === 0 ? 7 : date.getUTCDay();
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
  const base = new Date(`${baseDate}T00:00:00Z`);
  const current = base.getUTCDay() === 0 ? 7 : base.getUTCDay();
  const delta = Number(dayOfWeek) - current;
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().split("T")[0];
};

const enrichSchedulesWithPlayers = async (schedules, dateValue) => {
  if (!schedules.length) return [];

  const scheduleIds = schedules.map((schedule) => schedule.id);
  const { data: enrollments, error: enrollmentError } = await supabase
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

  if (enrollmentError) throw enrollmentError;

  const bySchedule = new Map();
  const enrolledScheduleIds = new Set();
  (enrollments || []).forEach((enrollment) => {
    if (enrollment.enrolled_from > dateValue) return;
    if (enrollment.enrolled_until && enrollment.enrolled_until < dateValue) return;
    if (!enrollment.players?.is_active) return;
    const list = bySchedule.get(enrollment.batch_schedule_id) || [];
    list.push(enrollment.players);
    bySchedule.set(enrollment.batch_schedule_id, list);
    enrolledScheduleIds.add(enrollment.batch_schedule_id);
  });

  // Player assignments are currently maintained at batch level in player_batches.
  // Use them when a schedule has no per-session enrollment rows so coaches still
  // see the players enrolled in their assigned batch.
  const fallbackBatchIds = [...new Set(
    schedules
      .filter((schedule) => !enrolledScheduleIds.has(schedule.id))
      .map((schedule) => schedule.batch_id)
      .filter(Boolean)
  )];
  if (fallbackBatchIds.length) {
    const { data: batchAssignments, error: batchError } = await supabase
      .from("player_batches")
      .select("batch_id, players!inner(id, full_name, is_active)")
      .in("batch_id", fallbackBatchIds)
      .eq("players.is_active", true);
    if (batchError) throw batchError;

    (batchAssignments || []).forEach((assignment) => {
      const schedule = schedules.find((item) =>
        item.batch_id === assignment.batch_id && !enrolledScheduleIds.has(item.id)
      );
      if (!schedule) return;
      const list = bySchedule.get(schedule.id) || [];
      if (!list.some((player) => player.id === assignment.players?.id)) {
        list.push(assignment.players);
      }
      bySchedule.set(schedule.id, list);
    });
  }

  return schedules.map((schedule) => ({
    ...schedule,
    sessionLabel: formatSession(schedule),
    players: bySchedule.get(schedule.id) || [],
    playerCount: (bySchedule.get(schedule.id) || []).length,
  }));
};

export const getCoachScheduleView = async (user, dateValue = todayIso()) => {
  if (!user?.id) return { today: [], upcoming: [], week: [] };

  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id, academy_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (coachError) throw coachError;
  if (!coach) return { today: [], upcoming: [], week: [] };

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

  const validAssignments = (assignments || []).filter((assignment) =>
    assignment.batch_schedules?.is_active
  );
  const assignmentsForToday = validAssignments.filter((assignment) =>
    assignment.assigned_from <= dateValue &&
    (!assignment.assigned_until || assignment.assigned_until >= dateValue)
  );
  const todaySchedules = assignmentsForToday
    .map((assignment) => assignment.batch_schedules)
    .filter((schedule) => Number(schedule.day_of_week) === day);

  // Keep today's list for attendance workflows; the dashboard uses future occurrences.
  const enrichedToday = await enrichSchedulesWithPlayers(todaySchedules, dateValue);

  const nowTime = new Date().toTimeString().slice(0, 5);
  const occurrences = validAssignments.map((assignment) => {
    const schedule = assignment.batch_schedules;
    const currentDay = isoDay(dateValue);
    let delta = (Number(schedule.day_of_week) - currentDay + 7) % 7;
    if (delta === 0 && dateValue === todayIso() && formatTime(schedule.start_time) <= nowTime) {
      delta = 7;
    }
    const occurrenceDate = new Date(`${dateValue}T00:00:00Z`);
    occurrenceDate.setUTCDate(occurrenceDate.getUTCDate() + delta);
    const sessionDate = occurrenceDate.toISOString().split("T")[0];

    if (assignment.assigned_from > sessionDate ||
        (assignment.assigned_until && assignment.assigned_until < sessionDate)) {
      return null;
    }

    return {
      ...schedule,
      assignment_id: assignment.id,
      assignment_from: assignment.assigned_from,
      assignment_until: assignment.assigned_until,
      date: sessionDate,
    };
  }).filter(Boolean);

  const uniqueOccurrences = [...new Map(
    occurrences.map((schedule) => [schedule.id, schedule])
  ).values()].sort((a, b) =>
    a.date.localeCompare(b.date) || String(a.start_time).localeCompare(String(b.start_time))
  );

  const enrichedUpcoming = (await Promise.all(uniqueOccurrences.map(async (schedule) => {
    const [enriched] = await enrichSchedulesWithPlayers([schedule], schedule.date);
    return enriched ? { ...enriched, date: schedule.date } : null;
  }))).filter(Boolean);

  return {
    today: enrichedToday.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))),
    upcoming: enrichedUpcoming,
    week: enrichedUpcoming,
  };
};

export const getParentScheduleView = async (childId, dateValue = todayIso()) => {
  if (!childId) return { today: [], next: null, week: [] };

  const { data: sessionEnrollments, error: enrollmentError } = await supabase
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

  if (enrollmentError) throw enrollmentError;

  let valid = (sessionEnrollments || []).filter((enrollment) =>
    enrollment.batch_schedules?.is_active &&
    (!enrollment.enrolled_from || enrollment.enrolled_from <= dateValue) &&
    (!enrollment.enrolled_until || enrollment.enrolled_until >= dateValue)
  );

  // Player management currently maintains enrollment at batch level. If no
  // session-specific enrollments exist, derive the child's recurring sessions
  // from their active player_batches assignment instead of showing an empty week.
  if (valid.length === 0) {
    const { data: batchAssignments, error: batchError } = await supabase
      .from("player_batches")
      .select("batch_id")
      .eq("player_id", childId);

    if (batchError) throw batchError;

    let batchIds = [...new Set((batchAssignments || []).map((row) => row.batch_id).filter(Boolean))];

    // Compatibility fallback for player records that still store their primary batch.
    if (!batchIds.length) {
      const { data: player, error: playerError } = await supabase
        .from("players")
        .select("batch_id")
        .eq("id", childId)
        .maybeSingle();
      if (playerError) throw playerError;
      if (player?.batch_id) batchIds = [player.batch_id];
    }

    if (batchIds.length) {
      const { data: schedules, error: scheduleError } = await supabase
        .from("batch_schedules")
        .select(SCHEDULE_SELECT)
        .in("batch_id", batchIds)
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time");

      if (scheduleError) throw scheduleError;

      valid = (schedules || []).map((schedule) => ({
        batch_schedule_id: schedule.id,
        batch_schedules: schedule,
        enrolled_from: null,
        enrolled_until: null,
      }));
    }
  }

  const currentDay = isoDay(dateValue);
  const todaySchedules = valid
    .filter((enrollment) => Number(enrollment.batch_schedules.day_of_week) === currentDay)
    .map((enrollment) => enrollment.batch_schedules);
  const today = await enrichSchedulesWithPlayers(todaySchedules, dateValue);
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
    if ((schedule.enrollment_from && schedule.enrollment_from > sessionDate) ||
        (schedule.enrollment_until && schedule.enrollment_until < sessionDate)) return null;
    const [enriched] = await enrichSchedulesWithPlayers([schedule], sessionDate);
    return enriched ? { ...enriched, date: sessionDate } : null;
  }))).filter(Boolean).sort((a, b) =>
    a.date.localeCompare(b.date) || String(a.start_time).localeCompare(String(b.start_time))
  );

  const nowTime = new Date().toTimeString().slice(0, 5);
  const nextToday = today.find((schedule) => formatTime(schedule.end_time) >= nowTime);
  const nextThisWeek = week.find((schedule) => schedule.date > dateValue);
  const nextNextWeek = !nextToday && !nextThisWeek
    ? week
      .map((schedule) => ({
        ...schedule,
        date: new Date(`${schedule.date}T00:00:00Z`).setUTCDate(
          new Date(`${schedule.date}T00:00:00Z`).getUTCDate() + 7
        ),
      }))
      .map((schedule) => ({
        ...schedule,
        date: new Date(schedule.date).toISOString().split("T")[0],
      }))
      .filter((schedule) =>
        (!schedule.enrollment_from || schedule.enrollment_from <= schedule.date) &&
        (!schedule.enrollment_until || schedule.enrollment_until >= schedule.date)
      )
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.start_time).localeCompare(String(b.start_time)))[0]
    : null;
  const next = nextToday ? { ...nextToday, date: dateValue } : nextThisWeek || nextNextWeek;

  return { today, next: next || null, week };
};

export const getCoachAttendanceSessions = async (user, dateValue = todayIso()) => {
  if (!user?.id || dateValue > todayIso()) return [];

  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (coachError) throw coachError;
  if (!coach) return [];

  const day = isoDay(dateValue);
  const { data, error } = await supabase
    .from("coach_batch_schedule_assignments")
    .select(`
      id,
      batch_schedule_id,
      assigned_from,
      assigned_until,
      is_active,
      batch_schedules ( ${SCHEDULE_SELECT} )
    `)
    .eq("coach_id", coach.id)
    .eq("is_active", true);

  if (error) throw error;

  // For past attendance, allow an active current assignment to be selected for its
  // matching weekday even if the mapping was created later; future dates are blocked.
  const schedules = (data || [])
    .filter((assignment) => {
      const schedule = assignment.batch_schedules;
      if (!schedule?.is_active || Number(schedule.day_of_week) !== day) return false;
      if (dateValue <= todayIso()) {
        return !assignment.assigned_until || assignment.assigned_until >= dateValue;
      }
      return false;
    })
    .map((assignment) => ({
      ...assignment.batch_schedules,
      assignment_id: assignment.id,
      center_id: assignment.batch_schedules.center_id,
      batch_id: assignment.batch_schedules.batch_id,
    }));

  return enrichSchedulesWithPlayers(schedules, dateValue);
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

  const { data: schedule, error: scheduleError } = await supabase
    .from("batch_schedules")
    .select("id, batch_id")
    .eq("id", scheduleId)
    .maybeSingle();
  if (scheduleError) throw scheduleError;
  if (!schedule) return [];

  // Read enrollment rows first, then query players directly. Avoid relying on
  // PostgREST embedded relationship payloads, which can be null/array-shaped
  // under different relationship and RLS conditions.
  const { data: scheduleEnrollments, error: enrollmentError } = await supabase
    .from("player_batch_schedules")
    .select("player_id, enrolled_from, enrolled_until")
    .eq("batch_schedule_id", scheduleId)
    .eq("is_active", true)
    .lte("enrolled_from", attendanceDate);

  if (enrollmentError) throw enrollmentError;

  const eligibleEnrollmentIds = [...new Set(
    (scheduleEnrollments || [])
      .filter((row) => !row.enrolled_until || row.enrolled_until >= attendanceDate)
      .map((row) => row.player_id)
      .filter(Boolean)
  )];

  if (eligibleEnrollmentIds.length) {
    const { data: enrolledPlayerRows, error: enrolledPlayersError } = await supabase
      .from("players")
      .select("id, full_name, is_active, batch_id, center_id")
      .in("id", eligibleEnrollmentIds)
      .eq("is_active", true);

    if (enrolledPlayersError) throw enrolledPlayersError;

    const playersById = new Map(
      (enrolledPlayerRows || []).map((player) => [player.id, player])
    );

    const enrolledPlayers = eligibleEnrollmentIds
      .map((playerId) => {
        const player = playersById.get(playerId);
        if (!player) return null;
        return {
          id: player.id,
          player_id: player.id,
          full_name: player.full_name,
          batch_id: player.batch_id,
          center_id: player.center_id,
        };
      })
      .filter(Boolean);

    if (enrolledPlayers.length) return enrolledPlayers;
  }

  // Existing player enrollment flow also supports batch-level assignments.
  // Query players directly rather than embedding the players relationship.
  const { data: batchEnrollments, error: batchError } = await supabase
    .from("player_batches")
    .select("player_id")
    .eq("batch_id", schedule.batch_id);

  if (batchError) throw batchError;

  const batchPlayerIds = [...new Set(
    (batchEnrollments || []).map((row) => row.player_id).filter(Boolean)
  )];
  if (!batchPlayerIds.length) return [];

  const { data: batchPlayers, error: batchPlayersError } = await supabase
    .from("players")
    .select("id, full_name, is_active, batch_id, center_id")
    .in("id", batchPlayerIds)
    .eq("is_active", true);

  if (batchPlayersError) throw batchPlayersError;

  return (batchPlayers || []).map((player) => ({
    id: player.id,
    player_id: player.id,
    full_name: player.full_name,
    batch_id: player.batch_id,
    center_id: player.center_id,
  }));
};

export const formatScheduleTime = formatTime;
export const formatScheduleLabel = formatSession;
