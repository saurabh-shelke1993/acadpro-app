import {
  SUBSCRIPTION_BILLING_ALIGNMENT as ALIGN,
  SUBSCRIPTION_PRORATION_METHOD as METHOD,
  calculateInitialMonthlyProration as quote,
} from "./subscriptionProration";

const slots = [
  { scheduleId: "mon", dayOfWeek: 1, enrolledFrom: "2027-01-15" },
  { scheduleId: "wed", dayOfWeek: 3, enrolledFrom: "2027-01-15" },
  { scheduleId: "fri", dayOfWeek: 5, enrolledFrom: "2027-01-15" },
];
const request = (overrides = {}) => ({
  billingAlignment: ALIGN.FIXED_CALENDAR_MONTH,
  joinDate: "2027-01-15",
  agreedAmountPaise: 150000,
  prorationMethod: METHOD.SCHEDULED_SESSIONS,
  sessionSlots: slots,
  ...overrides,
});

describe("PS-L1P1 billing alignment and initial fixed-period proration", () => {
  test("preserves the approved both-model configuration as explicit quote input", () => {
    expect(ALIGN).toEqual({
      FIXED_CALENDAR_MONTH: "fixed_calendar_month", ANNIVERSARY_MONTH: "anniversary_month",
    });
    expect(METHOD).toEqual({
      CALENDAR_DAYS: "calendar_days", SCHEDULED_SESSIONS: "scheduled_sessions",
    });
  });
  test("Mon/Wed/Fri January 2027 counts 13 total and 7 from Jan 15 inclusive", () => {
    expect(quote(request())).toEqual({
      billingAlignment: ALIGN.FIXED_CALENDAR_MONTH,
      appliedMethod: METHOD.SCHEDULED_SESSIONS,
      fullPeriodStartDate: "2027-01-01",
      eligibleStartDate: "2027-01-15",
      firstPeriodEndDate: "2027-01-31",
      nextRenewalDate: "2027-02-01",
      agreedAmountPaise: 150000, firstPeriodAmountPaise: 80769, discountPaise: 69231,
      eligibleCount: 7, totalCount: 13,
      scheduleIds: ["mon", "wed", "fri"], excludedCount: 0, requiresReview: false,
    });
  });
  test("calendar method counts 17 of 31 inclusive days, not 16", () => {
    const result = quote(request({ prorationMethod: METHOD.CALENDAR_DAYS, sessionSlots: [] }));
    expect(result).toMatchObject({
      appliedMethod: METHOD.CALENDAR_DAYS, firstPeriodAmountPaise: 82258,
      discountPaise: 67742, eligibleCount: 17, totalCount: 31,
      nextRenewalDate: "2027-02-01",
    });
  });
  test("anniversary method gives 15 Jan–14 Feb full-price regardless of weekly schedule", () => {
    expect(quote(request({ billingAlignment: ALIGN.ANNIVERSARY_MONTH, sessionSlots: [] }))).toMatchObject({
      appliedMethod: "none", fullPeriodStartDate: "2027-01-15",
      firstPeriodEndDate: "2027-02-14", nextRenewalDate: "2027-02-15",
      firstPeriodAmountPaise: 150000, discountPaise: 0, requiresReview: false,
    });
  });
  test.each([["2027-01-01",31,31],["2027-01-31",1,31]])(
    "fixed calendar days join %s earns %i/%i", (joinDate, eligible, total) => {
      const result = quote(request({ joinDate, prorationMethod: METHOD.CALENDAR_DAYS }));
      expect(result.eligibleCount).toBe(eligible);
      expect(result.totalCount).toBe(total);
      expect(result.firstPeriodAmountPaise).toBe(joinDate.endsWith("01") ? 150000 : 4839);
    }
  );
  test("original contracted rate remains unchanged even if the first period is discounted", () => {
    const result = quote(request());
    expect(result.agreedAmountPaise).toBe(150000);
    expect(result.agreedAmountPaise - result.discountPaise).toBe(result.firstPeriodAmountPaise);
    expect(Object.keys(result)).not.toContain("nextPeriodAmountPaise");
  });
  test("accepts 0 agreed recurring fee but still provides the calculation basis", () => {
    expect(quote(request({ agreedAmountPaise: 0 }))).toMatchObject({
      firstPeriodAmountPaise: 0, discountPaise: 0, eligibleCount: 7, totalCount: 13,
    });
  });
});

describe("PS-L1P1 actual scheduled occurrences and player enrollment", () => {
  test("counts two sessions on the same Friday separately", () => {
    const extra = { scheduleId: "fri-evening", dayOfWeek: 5, enrolledFrom: "2027-01-15" };
    expect(quote(request({ sessionSlots: [...slots, extra] }))).toMatchObject({
      totalCount: 18, eligibleCount: 10, firstPeriodAmountPaise: 83333,
    });
  });
  test("a later player-specific enrollment date reduces only eligible occurrences", () => {
    const modified = slots.map(s => ({ ...s, enrolledFrom: "2027-01-20" }));
    expect(quote(request({ sessionSlots: modified }))).toMatchObject({
      totalCount: 13, eligibleCount: 5, firstPeriodAmountPaise: 57692,
    });
  });
  test("enrolledUntil bounds a selected session without reducing the full-month denominator", () => {
    const modified = slots.map(s => ({ ...s, enrolledUntil: "2027-01-22" }));
    expect(quote(request({ sessionSlots: modified }))).toMatchObject({
      totalCount: 13, eligibleCount: 4, firstPeriodAmountPaise: 46154,
    });
  });
  test("approved exclusion removes a scheduled occurrence from both numerator and denominator", () => {
    const result = quote(request({
      excludedOccurrences: [{ scheduleId: "mon", date: "2027-01-18" }],
    }));
    expect(result).toMatchObject({
      totalCount: 12, eligibleCount: 6,
      firstPeriodAmountPaise: 75000, excludedCount: 1,
    });
  });
  test("exclusion on a pre-join session reduces only the denominator", () => {
    const result = quote(request({
      excludedOccurrences: [{ scheduleId: "mon", date: "2027-01-11" }],
    }));
    expect(result).toMatchObject({
      totalCount: 12, eligibleCount: 7, firstPeriodAmountPaise: 87500,
    });
  });
  test("no eligible sessions flags review and does not invent a payable due", () => {
    const modified = slots.map(s => ({ ...s, enrolledFrom: "2027-02-01" }));
    expect(quote(request({ sessionSlots: modified }))).toMatchObject({
      totalCount: 13, eligibleCount: 0, firstPeriodAmountPaise: 0, requiresReview: true,
    });
  });
  test("one Wednesday session per week is computed from real dates", () => {
    expect(quote(request({
      sessionSlots: [{ scheduleId: "wed", dayOfWeek: 3, enrolledFrom: "2027-01-15" }],
    })).toMatchObject({
      totalCount: 4, eligibleCount: 2, firstPeriodAmountPaise: 75000,
    });
  });
  test("ISO weekdays are Monday=1 and Sunday=7, including the first day of year 0001", () => {
    expect(quote(request({
      joinDate: "0001-01-01",
      sessionSlots: [{ scheduleId: "mon", dayOfWeek: 1, enrolledFrom: "0001-01-01" }],
    }))).toMatchObject({
      eligibleCount: 5, totalCount: 5, firstPeriodAmountPaise: 150000,
    });
  });
  test("Sunday training is counted through month and year boundaries", () => {
    const out = quote(request({
      joinDate: "2026-12-20",
      sessionSlots: [{ scheduleId: "sun", dayOfWeek: 7, enrolledFrom: "2026-12-20" }],
    }));
    expect(out).toMatchObject({
      fullPeriodStartDate: "2026-12-01", firstPeriodEndDate: "2026-12-31",
      nextRenewalDate: "2027-01-01", totalCount: 4, eligibleCount: 2,
      firstPeriodAmountPaise: 75000,
    });
  });
  test("February leap and non-leap calendars calculate correct inclusive day counts", () => {
    expect(quote(request({ joinDate: "2028-02-15", prorationMethod: METHOD.CALENDAR_DAYS })))
      .toMatchObject({ fullPeriodStartDate: "2028-02-01", firstPeriodEndDate: "2028-02-29", totalCount: 29, eligibleCount: 15 });
    expect(quote(request({ joinDate: "2027-02-15", prorationMethod: METHOD.CALENDAR_DAYS })))
      .toMatchObject({ firstPeriodEndDate: "2027-02-28", totalCount: 28, eligibleCount: 14 });
  });
  test("multiple session calculations do not modify their caller-owned arrays", () => {
    const frozen = Object.freeze(slots.map(s => Object.freeze({...s})));
    const first = quote(request({sessionSlots:frozen}));
    const second = quote(request({sessionSlots:frozen}));
    expect(first).toEqual(second);
    expect(frozen[0].enrolledFrom).toBe("2027-01-15");
  });
});

describe("PS-L1P1 fail-closed invalid inputs and money rounding", () => {
  test.each(["", "2027-02-29", "2027-01-32", "2027-1-15", "2027-01-15T00:00:00Z", null])(
    "rejects invalid join dates %s", joinDate => {
      expect(() => quote(request({ joinDate }))).toThrow(RangeError);
    }
  );
  test.each([null, "calendar", "", undefined])(
    "rejects missing/unknown billing alignment %s", billingAlignment => {
      expect(() => quote(request({billingAlignment}))).toThrow(RangeError);
    }
  );
  test.each(["attendance", "fixed_daily", null, ""])(
    "rejects unknown proration method %s", prorationMethod => {
      expect(() => quote(request({prorationMethod}))).toThrow(RangeError);
    }
  );
  test.each([-1, 1.5, "150000", Infinity, NaN, Number.MAX_SAFE_INTEGER + 2])(
    "rejects unsafe or noninteger paise %s", agreedAmountPaise => {
      expect(() => quote(request({agreedAmountPaise}))).toThrow(RangeError);
    }
  );
  test.each([
    [], null,
    [{ scheduleId: "mon", dayOfWeek: 0, enrolledFrom: "2027-01-15" }],
    [{ scheduleId: "mon", dayOfWeek: 8, enrolledFrom: "2027-01-15" }],
    [{ scheduleId: "mon", dayOfWeek: 1.5, enrolledFrom: "2027-01-15" }],
    [{ scheduleId: "mon", dayOfWeek: 1, enrolledFrom: "2027-01-15", isActive: false }],
    [{ scheduleId: "mon", dayOfWeek: 1 }],
    [{ scheduleId: "mon", dayOfWeek: 1, enrolledFrom: "2027-02-31" }],
    [{ scheduleId: "mon", dayOfWeek: 1, enrolledFrom: "2027-01-20", enrolledUntil: "2027-01-10" }],
    [{ scheduleId: "mon", dayOfWeek: 1, enrolledFrom: "2027-01-15" },
     { scheduleId: "mon", dayOfWeek: 1, enrolledFrom: "2027-01-15" }],
  ])("rejects invalid or untrusted session snapshot %j", sessionSlots => {
    expect(() => quote(request({sessionSlots}))).toThrow(RangeError);
  });
  test.each([
    [{ scheduleId: "invalid", date: "2027-01-18" }],
    [{ scheduleId: "mon", date: "2027-01-17" }],
    [{ scheduleId: "mon", date: "2027-02-01" }],
    [{ scheduleId: "mon", date: "2027-01-18" },{ scheduleId: "mon", date: "2027-01-18" }],
    [{ scheduleId: "mon", date: "bad" }],
    [null],
  ])("rejects invalid holiday/cancellation snapshot %j", excludedOccurrences => {
    expect(() => quote(request({excludedOccurrences}))).toThrow(RangeError);
  });
  test("rejects session exclusion for calendar-day and anniversary pricing", () => {
    const exclusion=[{scheduleId:"mon",date:"2027-01-18"}];
    expect(() => quote(request({
      prorationMethod:METHOD.CALENDAR_DAYS,excludedOccurrences:exclusion,
    }))).toThrow(RangeError);
    expect(() => quote(request({
      billingAlignment:ALIGN.ANNIVERSARY_MONTH,excludedOccurrences:exclusion,
    }))).toThrow(RangeError);
  });
  test("cannot calculate session price with a schedule having zero occurrences this month", () => {
    expect(() => quote(request({
      joinDate:"2027-02-15",
      sessionSlots:[{scheduleId:"mon",dayOfWeek:1,enrolledFrom:"2027-02-15"}],
      excludedOccurrences:[
        {scheduleId:"mon",date:"2027-02-01"},
        {scheduleId:"mon",date:"2027-02-08"},
        {scheduleId:"mon",date:"2027-02-15"},
        {scheduleId:"mon",date:"2027-02-22"},
      ],
    }))).toThrow(/No scheduled sessions/);
  });
  test("rounds exactly half a paisa up with integer arithmetic", () => {
    const example = quote(request({
      joinDate:"2027-01-16", agreedAmountPaise:1,
      prorationMethod:METHOD.CALENDAR_DAYS,
    }));
    expect(example).toMatchObject({eligibleCount:16,totalCount:31,firstPeriodAmountPaise:1});
  });
  test("high safely representable amount does not overflow intermediate multiplication", () => {
    expect(quote(request({
      agreedAmountPaise:Number.MAX_SAFE_INTEGER,
      joinDate:"2027-01-01",
      prorationMethod:METHOD.CALENDAR_DAYS,
    })).firstPeriodAmountPaise).toBe(Number.MAX_SAFE_INTEGER);
  });
});
