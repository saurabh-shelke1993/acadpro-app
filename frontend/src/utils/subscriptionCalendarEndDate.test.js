import { calculateCalendarAlignedEndDate as end } from "./subscriptionCalendarEndDate";

describe("RC1.3 calendar-aligned first period (inclusive)", () => {
  test.each([
    ["2026-11-12", "monthly", "2026-11-30"],
    ["2026-11-01", "monthly", "2026-11-30"],
    ["2026-11-12", "quarterly", "2027-01-31"],
    ["2026-11-01", "quarterly", "2027-01-31"],
    ["2026-12-31", "quarterly", "2027-02-28"],
    ["2024-01-31", "monthly", "2024-01-31"],
    ["2024-02-02", "monthly", "2024-02-29"],
    ["2027-02-02", "monthly", "2027-02-28"],
    ["2026-10-15", "half_yearly", "2027-03-31"],
    ["2026-12-15", "yearly", "2027-11-30"]
  ])("%s %s -> %s", (start, cycle, expected) => {
    expect(end(start, cycle)).toBe(expected);
  });

  test.each([
    ["", "monthly"], ["2026-02-30", "monthly"],
    ["2026-13-01", "monthly"], ["2026-00-05", "monthly"],
    ["2026-11-31", "monthly"], ["2026-1-01", "monthly"],
    ["2026-11-12", "weekly"], ["2026-11-12", ""],
    [null, "monthly"], ["9999-12-31", "quarterly"]
  ])("invalid %s / %s must not be saved", (start, cycle) => {
    expect(() => end(start, cycle)).toThrow(RangeError);
  });
});
