/** Attendance display helpers only. They do not change schedules or RLS. */
const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const formatAttendanceClock = (value) => {
  if (typeof value !== "string") return "";
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`;
};

export const formatAttendanceSessionLabel = (schedule) => {
  if (!schedule) return "Session";
  const day = DAYS[Number(schedule.day_of_week)] || "Session";
  const start = formatAttendanceClock(schedule.start_time);
  const end = formatAttendanceClock(schedule.end_time);
  const time = start && end ? `${start}–${end}` : "";
  return [day, time, schedule.session_label].filter(Boolean).join(" · ");
};

/** Active weekly batch days, sorted Monday first and de-duplicated. */
export const formatAttendanceTrainingDays = (days) =>
  [...new Set((days || []).map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))]
    .sort((a, b) => a - b)
    .map((day) => SHORT_DAYS[day])
    .join(" · ");

/** Identify the Coach's batch, weekday/time and center before marking. */
export const formatCoachAttendanceSessionOption = (session) => {
  if (!session) return "Select session";
  return [
    session.batches?.batch_name || "Batch",
    formatAttendanceSessionLabel(session),
    session.centers?.center_name || "Center",
  ].join(" · ");
};

export const countAttendance = (players, getStatus) => (players || []).reduce((totals, player) => {
  const status = getStatus(player);
  totals.total += 1;
  if (status === "present") totals.present += 1;
  else if (status === "absent") totals.absent += 1;
  else totals.unmarked += 1;
  return totals;
}, { total: 0, present: 0, absent: 0, unmarked: 0 });
