import { formatAttendanceClock, formatAttendanceSessionLabel, formatAttendanceTrainingDays, formatCoachAttendanceSessionOption, countAttendance } from "./attendancePresentation";

test("AM6.1 formats 24-hour DB times into readable 12-hour labels", () => {
  expect(formatAttendanceClock("17:00:00")).toBe("5:00 PM");
  expect(formatAttendanceClock("18:30:00")).toBe("6:30 PM");
  expect(formatAttendanceClock("00:00:00")).toBe("12:00 AM");
  expect(formatAttendanceClock("12:05")).toBe("12:05 PM");
});

test("AM6.1 displays weekday and both 12-hour session times", () => {
  expect(formatAttendanceSessionLabel({
    day_of_week: 4, start_time: "17:00:00", end_time: "18:00:00",
  })).toBe("Thursday · 5:00 PM–6:00 PM");
  expect(formatAttendanceSessionLabel({
    day_of_week: 1, start_time: "08:30", end_time: "09:30", session_label: "Morning",
  })).toBe("Monday · 8:30 AM–9:30 AM · Morning");
});

test("AM6.1 refuses malformed time values without fabricating a time", () => {
  for (const v of ["24:00", "12:61", "noon", "7:1", null, undefined]) {
    expect(formatAttendanceClock(v)).toBe("");
  }
  expect(formatAttendanceSessionLabel(null)).toBe("Session");
  expect(formatAttendanceSessionLabel({ day_of_week: 4 })).toBe("Thursday");
});

test("AM6.2 counts P/A/unmarked from visible roster only, without writes", () => {
  const roster = [
    { id: "a", status: "present" },
    { id: "b", status: "absent" },
    { id: "c", status: "" },
  ];
  expect(countAttendance(roster, (p) => p.status)).toEqual({
    total: 3, present: 1, absent: 1, unmarked: 1,
  });
  expect(countAttendance([], (p) => p.status)).toEqual({
    total: 0, present: 0, absent: 0, unmarked: 0,
  });
});

test("AM6.2 counts owner player_id draft marks without changing roster", () => {
  const roster = [{ player_id: "one" }, { player_id: "two" }];
  const marks = { one: "present" };
  expect(countAttendance(roster, (p) => marks[p.player_id])).toEqual({
    total: 2, present: 1, absent: 0, unmarked: 1,
  });
  expect(roster).toEqual([{ player_id: "one" }, { player_id: "two" }]);
});

test("AM6.6 sorts and deduplicates weekly weekdays without inventing missing days", () => {
  expect(formatAttendanceTrainingDays([5, 1, 3, 1, 0, 8, null])).toBe("Mon · Wed · Fri");
  expect(formatAttendanceTrainingDays([])).toBe("");
});
test("AM6.6 describes Coach batch, weekday, time and center", () => {
  expect(formatCoachAttendanceSessionOption({
    day_of_week: 4, start_time: "17:00:00", end_time: "18:00:00",
    batches: { batch_name: "Juniors" }, centers: { center_name: "Lodha Amara" },
  })).toBe("Juniors · Thursday · 5:00 PM–6:00 PM · Lodha Amara");
});
