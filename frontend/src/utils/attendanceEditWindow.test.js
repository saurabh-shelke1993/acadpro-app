import {
  canCoachEditAttendanceDate,
  canEditAttendanceRecord,
  utcAttendanceToday,
} from "./attendanceEditWindow";

const record = (attendance_date) => ({ id: "attendance-1", attendance_date });

test("Coach UTC 7-calendar-date window includes today and six preceding dates", () => {
  expect(canCoachEditAttendanceDate("2026-11-05", "2026-11-05")).toBe(true);
  expect(canCoachEditAttendanceDate("2026-10-30", "2026-11-05")).toBe(true);
});

test("Coach window excludes the eighth day and future attendance", () => {
  expect(canCoachEditAttendanceDate("2026-10-29", "2026-11-05")).toBe(false);
  expect(canCoachEditAttendanceDate("2026-11-06", "2026-11-05")).toBe(false);
});

test("Coach date checks are calendar-based across month, year and leap boundaries", () => {
  expect(canCoachEditAttendanceDate("2025-12-27", "2026-01-02")).toBe(true);
  expect(canCoachEditAttendanceDate("2025-12-26", "2026-01-02")).toBe(false);
  expect(canCoachEditAttendanceDate("2024-02-29", "2024-03-06")).toBe(true);
});

test("Missing, malformed and impossible attendance dates fail closed", () => {
  for (const value of [null, "", "2026-2-05", "2026-02-31", "yesterday", "2026-11-05T00:00:00Z"]) {
    expect(canCoachEditAttendanceDate(value, "2026-11-05")).toBe(false);
  }
});

test("Owners and Super Admins retain edit rights to older History records", () => {
  const historical = record("2026-03-02");
  expect(canEditAttendanceRecord({ role: "academy_owner" }, historical, "2026-11-05")).toBe(true);
  expect(canEditAttendanceRecord({ role: "super_admin" }, historical, "2026-11-05")).toBe(true);
});

test("Coach history editing is limited by record date and Parent cannot edit", () => {
  const coach = { role: "coach" };
  expect(canEditAttendanceRecord(coach, record("2026-10-30"), "2026-11-05")).toBe(true);
  expect(canEditAttendanceRecord(coach, record("2026-10-29"), "2026-11-05")).toBe(false);
  expect(canEditAttendanceRecord({ role: "parent" }, record("2026-11-05"), "2026-11-05")).toBe(false);
  expect(canEditAttendanceRecord(null, record("2026-11-05"), "2026-11-05")).toBe(false);
});

test("Missing record identity or date prevents editing for every role", () => {
  expect(canEditAttendanceRecord({ role: "super_admin" }, null, "2026-11-05")).toBe(false);
  expect(canEditAttendanceRecord({ role: "academy_owner" }, { id: "id" }, "2026-11-05")).toBe(false);
  expect(canEditAttendanceRecord({ role: "coach" }, { attendance_date: "2026-11-05" }, "2026-11-05")).toBe(false);
});

test("Today helper uses UTC date, matching the live database timezone", () => {
  expect(utcAttendanceToday(new Date("2026-11-05T23:30:00Z"))).toBe("2026-11-05");
  expect(utcAttendanceToday(new Date("2026-11-06T00:30:00Z"))).toBe("2026-11-06");
});
