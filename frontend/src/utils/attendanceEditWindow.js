/**
 * Display-only attendance edit eligibility aligned to the live Supabase policy:
 * coach records may be updated on CURRENT_DATE - 6 through CURRENT_DATE,
 * inclusive, using the database's UTC calendar. RLS remains authoritative.
 */
const UTC_DAY_MS = 24 * 60 * 60 * 1000;
const parseDateOnly = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day) return null;
  return timestamp;
};

export const utcAttendanceToday = (now = new Date()) => now.toISOString().slice(0, 10);

export const canCoachEditAttendanceDate = (attendanceDate, today = utcAttendanceToday()) => {
  const record = parseDateOnly(attendanceDate);
  const current = parseDateOnly(today);
  return record !== null && current !== null &&
    record >= current - (6 * UTC_DAY_MS) && record <= current;
};

export const canEditAttendanceRecord = (user, record, today = utcAttendanceToday()) => {
  if (!record?.id || !record?.attendance_date) return false;
  if (user?.role === "academy_owner" || user?.role === "super_admin") return true;
  if (user?.role === "coach") return canCoachEditAttendanceDate(record.attendance_date, today);
  return false;
};
