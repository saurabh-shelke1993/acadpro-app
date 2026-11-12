import { validateOneTimeCampPeriod } from "./subscriptionOneTimeCampPeriod";

describe("SP2 explicit One-time camp dates", () => {
  test.each([
    ["2026-05-12", "2026-05-25"],
    ["2026-12-22", "2027-01-05"],
    ["2028-02-29", "2028-02-29"],
    ["2026-11-13", "2026-11-13"],
  ])("accepts valid inclusive period %s through %s", (startDate, endDate) => {
    expect(validateOneTimeCampPeriod({ startDate, endDate })).toEqual({
      startDate,
      endDate,
    });
  });

  test("requires a manual end date; no automatic month-end inference", () => {
    expect(() => validateOneTimeCampPeriod({
      startDate: "2026-05-12", endDate: ""
    })).toThrow(/Enter an end date/);
  });

  test("rejects end before start without rewriting the interval", () => {
    expect(() => validateOneTimeCampPeriod({
      startDate: "2026-05-12", endDate: "2026-05-11"
    })).toThrow(/cannot be before/);
  });

  test.each([
    ["2026-02-30", "2026-03-10"],
    ["2026-02-01", "2026-02-30"],
    ["2026-6-02", "2026-06-10"],
    ["2025-02-29", "2025-03-10"],
    ["2026-13-01", "2026-13-03"],
  ])("rejects invalid Gregorian/ISO pair %s %s", (startDate, endDate) => {
    expect(() => validateOneTimeCampPeriod({ startDate, endDate })).toThrow(RangeError);
  });

  test("requires a start date", () => {
    expect(() => validateOneTimeCampPeriod({
      startDate: "", endDate: "2026-05-25"
    })).toThrow(/Select a start date/);
  });
});
