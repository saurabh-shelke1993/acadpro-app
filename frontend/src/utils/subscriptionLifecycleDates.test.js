import {
  SUBSCRIPTION_CYCLE_MONTHS,
  isLeapYear,
  addSubscriptionCalendarDays,
  calculateSubscriptionPeriod,
  calculateRebasedSubscriptionPeriod,
  calculateVacationExtension,
  calculatePauseEntitlement,
  calculateResumeEntitlement,
} from "./subscriptionLifecycleDates";

const period = (anchorStartDate, billingCycle = "monthly", periodIndex = 0) =>
  calculateSubscriptionPeriod({ anchorStartDate, billingCycle, periodIndex });

describe("PS-L1 billing calendars: inclusive valid-to and anniversary", () => {
  test("defines exactly the four approved calendar billing cycles", () => {
    expect(SUBSCRIPTION_CYCLE_MONTHS).toEqual({
      monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12,
    });
  });

  test.each([
    ["monthly", "2026-12-04", "2026-12-05"],
    ["quarterly", "2027-02-04", "2027-02-05"],
    ["half_yearly", "2027-05-04", "2027-05-05"],
    ["yearly", "2027-11-04", "2027-11-05"],
  ])("%s on 5 Nov has inclusive end %s", (cycle, end, renewal) => {
    expect(period("2026-11-05", cycle)).toMatchObject({
      startDate: "2026-11-05", originalEndDate: end,
      effectiveEndDate: end, nextRenewalDate: renewal, anniversaryDay: 5,
      billingCycle: cycle, periodIndex: 0,
    });
  });

  test.each([
    [0, "2027-01-31", "2027-02-27", "2027-02-28"],
    [1, "2027-02-28", "2027-03-30", "2027-03-31"],
    [2, "2027-03-31", "2027-04-29", "2027-04-30"],
    [3, "2027-04-30", "2027-05-30", "2027-05-31"],
    [4, "2027-05-31", "2027-06-29", "2027-06-30"],
  ])("31-Jan anchor period %s retains the 31st (or clamped last day)", (i, start, end, next) => {
    expect(period("2027-01-31", "monthly", i)).toMatchObject({
      startDate: start, effectiveEndDate: end, nextRenewalDate: next, anniversaryDay: 31,
    });
  });

  test.each([
    [0, "2024-01-31", "2024-02-28", "2024-02-29"],
    [1, "2024-02-29", "2024-03-30", "2024-03-31"],
    [2, "2024-03-31", "2024-04-29", "2024-04-30"],
  ])("leap-year Jan-31 anchor index %i", (i, start, end, next) => {
    expect(period("2024-01-31", "monthly", i)).toMatchObject({
      startDate: start, effectiveEndDate: end, nextRenewalDate: next,
    });
  });

  test.each([
    [0, "2024-02-29", "2025-02-27", "2025-02-28"],
    [1, "2025-02-28", "2026-02-27", "2026-02-28"],
    [2, "2026-02-28", "2027-02-27", "2027-02-28"],
    [3, "2027-02-28", "2028-02-28", "2028-02-29"],
    [4, "2028-02-29", "2029-02-27", "2029-02-28"],
  ])("yearly leap-day anchor index %i", (i, start, end, next) => {
    expect(period("2024-02-29", "yearly", i)).toMatchObject({
      startDate: start, effectiveEndDate: end, nextRenewalDate: next,
    });
  });

  test.each([
    ["2026-11-30", "quarterly", "2027-02-27", "2027-02-28"],
    ["2024-08-31", "half_yearly", "2025-02-27", "2025-02-28"],
    ["2023-02-28", "yearly", "2024-02-27", "2024-02-28"],
    ["2026-12-31", "monthly", "2027-01-30", "2027-01-31"],
    ["2026-01-30", "monthly", "2026-02-27", "2026-02-28"],
  ])("%s %s handles short month and year rollovers", (start, cycle, end, next) => {
    expect(period(start, cycle)).toMatchObject({
      effectiveEndDate: end, nextRenewalDate: next,
    });
  });

  test("all ordinary periods have no overlap or gap across 3 years", () => {
    for (const cycle of Object.keys(SUBSCRIPTION_CYCLE_MONTHS)) {
      for (let i = 0; i < 36 / SUBSCRIPTION_CYCLE_MONTHS[cycle] - 1; i += 1) {
        const first = period("2024-01-31", cycle, i);
        const second = period("2024-01-31", cycle, i + 1);
        expect(addSubscriptionCalendarDays(first.effectiveEndDate, 1)).toBe(second.startDate);
        expect(first.nextRenewalDate).toBe(second.startDate);
      }
    }
  });

  test("counts leap centuries correctly and never relies on local time or DST", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2027)).toBe(false);
    expect(addSubscriptionCalendarDays("2000-02-28", 1)).toBe("2000-02-29");
    expect(addSubscriptionCalendarDays("1900-02-28", 1)).toBe("1900-03-01");
    expect(addSubscriptionCalendarDays("2026-03-29", 2)).toBe("2026-03-31");
    expect(addSubscriptionCalendarDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addSubscriptionCalendarDays("2024-02-29", -1)).toBe("2024-02-28");
  });

  test("preserves exact four-digit years 0001 and 0099 without JS Date year coercion", () => {
    expect(addSubscriptionCalendarDays("0001-01-01", 365)).toBe("0002-01-01");
    expect(addSubscriptionCalendarDays("0099-12-31", 1)).toBe("0100-01-01");
    expect(period("0099-01-31")).toMatchObject({
      startDate: "0099-01-31", nextRenewalDate: "0099-02-28",
    });
  });

  test.each([
    null, undefined, "", "2026-2-05", "2026-02-5", "2026-02-30",
    "2025-02-29", "1900-02-29", "2026-04-31", "2026-00-01",
    "2026-13-01", "0000-01-01", "2026-11-05T00:00:00Z", "tomorrow",
  ])("rejects malformed or impossible date %s", (invalid) => {
    expect(() => period(invalid)).toThrow(RangeError);
    expect(() => addSubscriptionCalendarDays(invalid, 1)).toThrow(RangeError);
  });

  test.each(["weekly", "annual", "half-yearly", "Monthly", "", null, "__proto__"])(
    "rejects unsupported billing cycle %s", (invalid) => {
      expect(() => period("2026-11-05", invalid)).toThrow(RangeError);
    }
  );

  test.each([-1, 0.5, Infinity, NaN, "2", null, Number.MAX_SAFE_INTEGER])(
    "rejects invalid period index %s", (invalid) => {
      if (invalid === Number.MAX_SAFE_INTEGER) {
        expect(() => period("2026-11-05", "monthly", invalid)).toThrow(RangeError);
      } else {
        expect(() => period("2026-11-05", "monthly", invalid)).toThrow(RangeError);
      }
    }
  );
  test("rejects calendar arithmetic past supported years", () => {
    expect(() => addSubscriptionCalendarDays("0001-01-01", -1)).toThrow(RangeError);
    expect(() => addSubscriptionCalendarDays("9999-12-31", 1)).toThrow(RangeError);
    expect(() => period("9999-12-01", "quarterly")).toThrow(RangeError);
    expect(() => addSubscriptionCalendarDays("2026-01-01", 1.5)).toThrow(RangeError);
  });
});

describe("PS-L1 vacation extensions and rebased anniversaries", () => {
  test("free ten-day extension moves due boundary without changing original end", () => {
    const base = period("2026-11-05");
    const extension = calculateVacationExtension({
      effectiveEndDate: base.effectiveEndDate, extensionDays: 10,
    });
    expect(base.originalEndDate).toBe("2026-12-04");
    expect(extension).toEqual({
      previousEffectiveEndDate: "2026-12-04",
      extensionDays: 10,
      effectiveEndDate: "2026-12-14",
      nextRenewalDate: "2026-12-15",
    });
    expect(calculateRebasedSubscriptionPeriod({
      effectiveEndDate: extension.effectiveEndDate, billingCycle: "monthly",
    })).toMatchObject({
      startDate: "2026-12-15", effectiveEndDate: "2027-01-14",
      nextRenewalDate: "2027-01-15", anniversaryDay: 15,
    });
  });

  test("successive extensions add to effective end only (caller audits each approval)", () => {
    const first = calculateVacationExtension({
      effectiveEndDate: "2026-12-04", extensionDays: 5,
    });
    expect(calculateVacationExtension({
      effectiveEndDate: first.effectiveEndDate, extensionDays: 5,
    })).toMatchObject({
      previousEffectiveEndDate: "2026-12-09",
      effectiveEndDate: "2026-12-14", nextRenewalDate: "2026-12-15",
    });
  });

  test("extension across leap February shifts the next renewal", () => {
    expect(calculateVacationExtension({
      effectiveEndDate: "2024-02-27", extensionDays: 3,
    })).toMatchObject({ effectiveEndDate: "2024-03-01", nextRenewalDate: "2024-03-02" });
  });

  test.each([0, -1, 1.5, "10", null, Infinity, Number.MAX_SAFE_INTEGER])(
    "refuses invalid extension days %s", (days) => {
      expect(() => calculateVacationExtension({
        effectiveEndDate: "2026-12-04", extensionDays: days,
      })).toThrow(RangeError);
    }
  );

  test.each([
    { successorPeriodExists: true },
    { successorDueExists: true },
    { successorPeriodExists: true, successorDueExists: true },
  ])("blocks extension if any successor or due already exists", (existing) => {
    expect(() => calculateVacationExtension({
      effectiveEndDate: "2026-12-04", extensionDays: 10, ...existing,
    })).toThrow(/next period or due/);
  });
});

describe("PS-L1 paid entitlement pause and resume previews", () => {
  const base = {
    periodStartDate: "2026-11-05",
    effectiveEndDate: "2026-12-04",
    verifiedPaidThroughDate: "2026-12-04",
  };
  test("pause counts effective pause day and leaves unused 15 days", () => {
    expect(calculatePauseEntitlement({ ...base, pauseDate: "2026-11-20" })).toEqual({
      pausedAt: "2026-11-20", originalEffectiveEndDate: "2026-12-04",
      remainingPaidDays: 15,
    });
  });

  test("pause at period start preserves all days and at end preserves one", () => {
    expect(calculatePauseEntitlement({ ...base, pauseDate: base.periodStartDate }).remainingPaidDays).toBe(30);
    expect(calculatePauseEntitlement({ ...base, pauseDate: base.effectiveEndDate }).remainingPaidDays).toBe(1);
  });

  test("resume after break consumes saved days and reanchors the next period", () => {
    const paused = calculatePauseEntitlement({ ...base, pauseDate: "2026-11-20" });
    const resumed = calculateResumeEntitlement({
      pausedAt: paused.pausedAt, resumeDate: "2027-01-10",
      remainingPaidDays: paused.remainingPaidDays,
    });
    expect(resumed).toEqual({
      resumedAt: "2027-01-10", remainingPaidDays: 15,
      effectiveEndDate: "2027-01-24", nextRenewalDate: "2027-01-25",
    });
    expect(calculateRebasedSubscriptionPeriod({
      effectiveEndDate: resumed.effectiveEndDate, billingCycle: "monthly",
    })).toMatchObject({
      startDate: "2027-01-25", effectiveEndDate: "2027-02-24",
      nextRenewalDate: "2027-02-25",
    });
  });

  test("remaining entitlement spans leap day without using elapsed hours", () => {
    expect(calculateResumeEntitlement({
      pausedAt: "2024-02-20", resumeDate: "2024-02-28", remainingPaidDays: 3,
    })).toMatchObject({
      effectiveEndDate: "2024-03-01", nextRenewalDate: "2024-03-02",
    });
  });

  test.each([
    { ...base, pauseDate: "2026-11-04" },
    { ...base, pauseDate: "2026-12-05" },
    { ...base, pauseDate: "2026-02-30" },
    { ...base, verifiedPaidThroughDate: "2026-12-03", pauseDate: "2026-11-20" },
    { ...base, verifiedPaidThroughDate: null, pauseDate: "2026-11-20" },
    { ...base, periodStartDate: "2026-12-05", pauseDate: "2026-12-03" },
  ])("refuses pause outside valid and verified fully paid period", (input) => {
    expect(() => calculatePauseEntitlement(input)).toThrow(RangeError);
  });

  test.each([
    { pausedAt: "2026-11-20", resumeDate: "2026-11-20", remainingPaidDays: 15 },
    { pausedAt: "2026-11-20", resumeDate: "2026-11-19", remainingPaidDays: 15 },
    { pausedAt: "2026-11-20", resumeDate: "2026-12-10", remainingPaidDays: 0 },
    { pausedAt: "2026-11-20", resumeDate: "2026-12-10", remainingPaidDays: -2 },
    { pausedAt: "2026-11-20", resumeDate: "2026-12-10", remainingPaidDays: 1.5 },
    { pausedAt: "2026-11-20", resumeDate: "2026-12-10", remainingPaidDays: "15" },
    { pausedAt: "2026-11-20", resumeDate: "bad", remainingPaidDays: 15 },
  ])("refuses unapproved-like invalid resume inputs", (input) => {
    expect(() => calculateResumeEntitlement(input)).toThrow(RangeError);
  });

  test("same input remains deterministic without modifying input objects", () => {
    const input = Object.freeze({ ...base, pauseDate: "2026-11-20" });
    expect(calculatePauseEntitlement(input)).toEqual(calculatePauseEntitlement(input));
    expect(input).toEqual({ ...base, pauseDate: "2026-11-20" });
  });
});
