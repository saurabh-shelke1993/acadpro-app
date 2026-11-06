/**
 * PS-L1: pure ISO YYYY-MM-DD subscription calendar calculations.
 * No Date/timezone APIs, React/Supabase imports, billing side-effects or writes.
 *
 * Inclusive intervals: [startDate, effectiveEndDate].
 * In uninterrupted renewals, pass the SAME original anchorStartDate and increase
 * periodIndex; never derive the next anniversary from a February-clamped date.
 * After an approved extension or resume, a NEW anchor starts at the calculated
 * nextRenewalDate (the eventual persisted period/event is a later phase).
 */
export const SUBSCRIPTION_CYCLE_MONTHS = Object.freeze({
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
});

const daysBeforeYear = (year) => {
  const n = year - 1;
  return 365 * n + Math.floor(n / 4) - Math.floor(n / 100) + Math.floor(n / 400);
};

export const isLeapYear = (year) =>
  Number.isInteger(year) && year >= 1 && year <= 9999 &&
  (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));

const monthLength = (year, month) => {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

const parseIsoDate = (value) => {
  if (typeof value !== "string") throw new RangeError("Expected ISO YYYY-MM-DD calendar date");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError("Expected ISO YYYY-MM-DD calendar date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthLength(year, month)) {
    throw new RangeError("Invalid calendar date");
  }
  return { year, month, day };
};

const toIsoDate = ({ year, month, day }) =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const toOrdinal = (date) => {
  const { year, month, day } = parseIsoDate(date);
  let dayOfYear = day;
  for (let m = 1; m < month; m += 1) dayOfYear += monthLength(year, m);
  return daysBeforeYear(year) + dayOfYear;
};

const fromOrdinal = (ordinal) => {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > daysBeforeYear(10000)) {
    throw new RangeError("Calendar date outside supported years 0001–9999");
  }
  let lo = 1;
  let hi = 9999;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (daysBeforeYear(mid) < ordinal) lo = mid;
    else hi = mid - 1;
  }
  let dayOfYear = ordinal - daysBeforeYear(lo);
  let month = 1;
  while (dayOfYear > monthLength(lo, month)) {
    dayOfYear -= monthLength(lo, month);
    month += 1;
  }
  return toIsoDate({ year: lo, month, day: dayOfYear });
};

export const addSubscriptionCalendarDays = (date, dayOffset) => {
  if (!Number.isSafeInteger(dayOffset)) throw new RangeError("Calendar day offset must be an integer");
  return fromOrdinal(toOrdinal(date) + dayOffset);
};

const cycleMonths = (billingCycle) => {
  if (!Object.prototype.hasOwnProperty.call(SUBSCRIPTION_CYCLE_MONTHS, billingCycle)) {
    throw new RangeError("Unsupported subscription billing cycle");
  }
  return SUBSCRIPTION_CYCLE_MONTHS[billingCycle];
};

const anniversaryAtMonthOffset = (anchor, monthOffset) => {
  if (!Number.isSafeInteger(monthOffset) || monthOffset < 0) {
    throw new RangeError("Month offset must be a nonnegative integer");
  }
  const initial = parseIsoDate(anchor);
  const zeroBasedTarget = (initial.year - 1) * 12 + (initial.month - 1) + monthOffset;
  if (!Number.isSafeInteger(zeroBasedTarget) || zeroBasedTarget >= 9999 * 12) {
    throw new RangeError("Subscription anniversary exceeds year 9999");
  }
  const year = Math.floor(zeroBasedTarget / 12) + 1;
  const month = (zeroBasedTarget % 12) + 1;
  const day = Math.min(initial.day, monthLength(year, month));
  return toIsoDate({ year, month, day });
};

/**
 * periodIndex 0 is the initial period. Indices 1+ preserve the ORIGINAL
 * anniversary day even when an intermediate February is shortened.
 */
export const calculateSubscriptionPeriod = ({
  anchorStartDate,
  billingCycle,
  periodIndex = 0,
}) => {
  const months = cycleMonths(billingCycle);
  if (!Number.isSafeInteger(periodIndex) || periodIndex < 0) {
    throw new RangeError("Period index must be a nonnegative integer");
  }
  const startDate = anniversaryAtMonthOffset(anchorStartDate, periodIndex * months);
  const nextRenewalDate = anniversaryAtMonthOffset(anchorStartDate, (periodIndex + 1) * months);
  const originalEndDate = addSubscriptionCalendarDays(nextRenewalDate, -1);
  return {
    startDate,
    originalEndDate,
    effectiveEndDate: originalEndDate,
    nextRenewalDate,
    anniversaryDay: parseIsoDate(anchorStartDate).day,
    billingCycle,
    periodIndex,
  };
};

/** Rebase ONLY after an approved extension or pause/resume, not a normal renewal. */
export const calculateRebasedSubscriptionPeriod = ({ effectiveEndDate, billingCycle }) => {
  const anchorStartDate = addSubscriptionCalendarDays(effectiveEndDate, 1);
  return calculateSubscriptionPeriod({ anchorStartDate, billingCycle, periodIndex: 0 });
};

/** Pure preview. Caller must confirm Owner approval and no generated successor/due. */
export const calculateVacationExtension = ({
  effectiveEndDate,
  extensionDays,
  successorPeriodExists = false,
  successorDueExists = false,
}) => {
  if (successorPeriodExists || successorDueExists) {
    throw new RangeError("Cannot extend after the next period or due exists");
  }
  if (!Number.isSafeInteger(extensionDays) || extensionDays <= 0) {
    throw new RangeError("Vacation extension requires positive whole calendar days");
  }
  const revisedEffectiveEndDate = addSubscriptionCalendarDays(effectiveEndDate, extensionDays);
  return {
    previousEffectiveEndDate: effectiveEndDate,
    extensionDays,
    effectiveEndDate: revisedEffectiveEndDate,
    nextRenewalDate: addSubscriptionCalendarDays(revisedEffectiveEndDate, 1),
  };
};

/**
 * Freeze only VERIFIED PAID unused days, counting the pause day inclusively.
 * A due marked Paid without approved paid-through evidence is insufficient.
 */
export const calculatePauseEntitlement = ({
  periodStartDate,
  effectiveEndDate,
  verifiedPaidThroughDate,
  pauseDate,
}) => {
  const start = toOrdinal(periodStartDate);
  const end = toOrdinal(effectiveEndDate);
  const paidThrough = toOrdinal(verifiedPaidThroughDate);
  const pause = toOrdinal(pauseDate);
  if (start > end) throw new RangeError("Period starts after its end");
  if (paidThrough < end) throw new RangeError("Entire period must have verified paid entitlement");
  if (pause < start || pause > end) throw new RangeError("Pause must be inside the paid period");
  return {
    pausedAt: pauseDate,
    originalEffectiveEndDate: effectiveEndDate,
    remainingPaidDays: end - pause + 1,
  };
};

/**
 * Reapply frozen entitlement from the approved resume date. The returned
 * nextRenewalDate becomes the new anniversary anchor for FUTURE periods.
 */
export const calculateResumeEntitlement = ({
  pausedAt,
  resumeDate,
  remainingPaidDays,
}) => {
  const pausedOrdinal = toOrdinal(pausedAt);
  const resumeOrdinal = toOrdinal(resumeDate);
  if (resumeOrdinal <= pausedOrdinal) throw new RangeError("Resume date must follow pause date");
  if (!Number.isSafeInteger(remainingPaidDays) || remainingPaidDays <= 0) {
    throw new RangeError("Remaining paid days must be a positive integer");
  }
  const resumedEffectiveEndDate = fromOrdinal(resumeOrdinal + remainingPaidDays - 1);
  return {
    resumedAt: resumeDate,
    remainingPaidDays,
    effectiveEndDate: resumedEffectiveEndDate,
    nextRenewalDate: addSubscriptionCalendarDays(resumedEffectiveEndDate, 1),
  };
};
