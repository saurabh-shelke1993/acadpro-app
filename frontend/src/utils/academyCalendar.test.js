import {
  ACADEMY_TIME_ZONE, getAcademyDate, getAcademyIsoWeekday, isValidAcademyDate,
  getAcademyMonthDateBounds, getAcademyMonthUtcBounds, getInclusiveAcademyDateRange,
} from "./academyCalendar";

test("uses the approved explicit zone", () => {
  expect(ACADEMY_TIME_ZONE).toBe("Asia/Kolkata");
});

test.each([
  ["2024-02-28T18:29:59Z", "2024-02-28", 3],
  ["2024-02-28T18:30:00Z", "2024-02-29", 4],
  ["2024-02-29T18:29:59.999Z", "2024-02-29", 4],
  ["2024-02-29T18:30:00Z", "2024-03-01", 5],
  ["2024-03-01T00:00:00Z", "2024-03-01", 5],
  ["2024-12-31T18:29:59Z", "2024-12-31", 2],
  ["2024-12-31T18:30:00Z", "2025-01-01", 3],
  ["2024-03-02T18:30:00Z", "2024-03-03", 7],
  ["2024-03-01T00:00:00+05:30", "2024-03-01", 5],
  ["2024-02-29T13:30:00-05:00", "2024-03-01", 5],
])("%s has academy date %s and weekday %s", (instant, date, weekday) => {
  expect(getAcademyDate(instant)).toBe(date);
  expect(getAcademyIsoWeekday(instant)).toBe(weekday);
});

test("accepts a captured Date or epoch without mutating the Date or reading the clock", () => {
  const captured = new Date("2024-02-29T18:30:00Z");
  const before = captured.getTime();
  expect(getAcademyDate(captured)).toBe("2024-03-01");
  expect(getAcademyDate(before)).toBe("2024-03-01");
  expect(captured.getTime()).toBe(before);
  expect(getAcademyDate(0)).toBe("1970-01-01");
});

test.each(["2024-02-29", "2000-02-29", "2025-01-01", "0001-01-01", "0099-12-31", "9999-12-31"])(
  "validates real date-only %s without shifting it", (date) => {
    expect(isValidAcademyDate(date)).toBe(true);
    expect(getInclusiveAcademyDateRange(date, date)).toEqual([date]);
  }
);

test.each([undefined, null, 0, {}, new Date(), "", "2024-2-01", "2024-02-30", "2023-02-29",
  "1900-02-29", "2024-04-31", "2024-00-01", "2024-13-01", "2024-01-00", "0000-01-01",
  "10000-01-01", "2024-03-01T00:00:00Z", " 2024-03-01", "2024-03-01\n"])(
  "rejects invalid date-only %p", (value) => {
    expect(isValidAcademyDate(value)).toBe(false);
    expect(() => getAcademyMonthDateBounds(value)).toThrow(RangeError);
    expect(() => getAcademyMonthUtcBounds(value)).toThrow(RangeError);
    expect(() => getInclusiveAcademyDateRange(value, "2024-03-01")).toThrow(RangeError);
    expect(() => getInclusiveAcademyDateRange("2024-03-01", value)).toThrow(RangeError);
  }
);

test.each([undefined, null, {}, true, NaN, Infinity, 0.5, new Date(NaN),
  "2024-03-01", "2024-03-01T00:00:00", "2024-02-30T00:00:00Z", "2023-02-29T00:00:00Z",
  "2024-03-01T24:00:00Z", "2024-03-01T00:60:00Z", "2024-03-01T00:00:60Z",
  "2024-03-01T00:00:00+24:00", "2024-03-01T00:00:00+05:60", new Date("0000-01-01T00:00:00Z")])(
  "rejects ambiguous or invalid instant %p", (value) => {
    expect(() => getAcademyDate(value)).toThrow(RangeError);
    expect(() => getAcademyIsoWeekday(value)).toThrow(RangeError);
  }
);

test.each([
  ["2024-02-29", "2024-02-01", "2024-03-01", "2024-01-31T18:30:00.000Z", "2024-02-29T18:30:00.000Z"],
  ["2024-03-15", "2024-03-01", "2024-04-01", "2024-02-29T18:30:00.000Z", "2024-03-31T18:30:00.000Z"],
  ["2024-12-31", "2024-12-01", "2025-01-01", "2024-11-30T18:30:00.000Z", "2024-12-31T18:30:00.000Z"],
  ["2025-01-01", "2025-01-01", "2025-02-01", "2024-12-31T18:30:00.000Z", "2025-01-31T18:30:00.000Z"],
])("separates date and instant month bounds for %s", (date, startDate, endDateExclusive, startInstant, endInstantExclusive) => {
  expect(getAcademyMonthDateBounds(date)).toEqual({ startDate, endDateExclusive });
  expect(getAcademyMonthUtcBounds(date)).toEqual({ startInstant, endInstantExclusive });
  expect(getAcademyDate(startInstant)).toBe(startDate);
  expect(getAcademyDate(Date.parse(startInstant) - 1) < startDate).toBe(true);
  expect(getAcademyDate(Date.parse(endInstantExclusive) - 1) < endDateExclusive).toBe(true);
  expect(getAcademyDate(endInstantExclusive)).toBe(endDateExclusive);
});

test("generates seven inclusive calendar dates through leap day and year rollover", () => {
  expect(getInclusiveAcademyDateRange("2024-02-24", "2024-03-01")).toEqual([
    "2024-02-24", "2024-02-25", "2024-02-26", "2024-02-27", "2024-02-28", "2024-02-29", "2024-03-01",
  ]);
  expect(getInclusiveAcademyDateRange("2024-12-26", "2025-01-01")).toEqual([
    "2024-12-26", "2024-12-27", "2024-12-28", "2024-12-29", "2024-12-30", "2024-12-31", "2025-01-01",
  ]);
  expect(getInclusiveAcademyDateRange("2023-02-28", "2023-03-01")).toEqual(["2023-02-28", "2023-03-01"]);
  expect(() => getInclusiveAcademyDateRange("2024-03-02", "2024-03-01")).toThrow(RangeError);
});

test("rejects an unrepresentable exclusive next-month boundary", () => {
  expect(() => getAcademyMonthDateBounds("9999-12-01")).toThrow(RangeError);
  expect(() => getAcademyMonthUtcBounds("9999-12-01")).toThrow(RangeError);
});
