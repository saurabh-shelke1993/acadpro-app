/**
 * PS-L1P1: pure first-period, monthly tuition proration.
 *
 * No network, React, Supabase, locale clock, attendance, or database writes.
 * Academy-level billing alignment, enrollment/schedule authorization and
 * holiday snapshots MUST be verified by a future trusted server-side caller.
 *
 * Amounts are integer INR paise; all periods and enrollments are inclusive.
 */
import { addSubscriptionCalendarDays, calculateSubscriptionPeriod, isLeapYear } from "./subscriptionLifecycleDates";

export const SUBSCRIPTION_BILLING_ALIGNMENT = Object.freeze({
  FIXED_CALENDAR_MONTH: "fixed_calendar_month",
  ANNIVERSARY_MONTH: "anniversary_month",
});

export const SUBSCRIPTION_PRORATION_METHOD = Object.freeze({
  CALENDAR_DAYS: "calendar_days",
  SCHEDULED_SESSIONS: "scheduled_sessions",
});

const validateDate = (value) => addSubscriptionCalendarDays(value, 0);

const calendarOrdinal = (date) => {
  validateDate(date);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const y = year - 1;
  const beforeYear = 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);
  const monthDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return beforeYear + monthDays.slice(0, month - 1).reduce((sum, length) => sum + length, 0) + day;
};

const inclusiveCalendarDays = (start, end) => {
  const count = calendarOrdinal(end) - calendarOrdinal(start) + 1;
  if (count < 1) throw new RangeError("Calendar interval must have start <= end");
  return count;
};

const isoWeekday = (isoDate) => ((calendarOrdinal(isoDate) - 1) % 7) + 1;

const monthBounds = (joinDate) => {
  validateDate(joinDate);
  const monthStart = `${joinDate.slice(0, 7)}-01`;
  const fixedPeriod = calculateSubscriptionPeriod({
    anchorStartDate: monthStart,
    billingCycle: "monthly",
  });
  return {
    fullPeriodStartDate: monthStart,
    firstPeriodEndDate: fixedPeriod.effectiveEndDate,
    nextRenewalDate: fixedPeriod.nextRenewalDate,
  };
};

/**
 * Computes half-up monetary rounding in exact integer arithmetic; never
 * accumulate floating-point fractions across billing periods.
 */
const proratedPaise = (agreedAmountPaise, eligibleCount, totalCount) => {
  if (!Number.isSafeInteger(agreedAmountPaise) || agreedAmountPaise < 0) {
    throw new RangeError("Agreed recurring amount must be a nonnegative integer number of paise");
  }
  if (!Number.isSafeInteger(totalCount) || totalCount < 1 ||
      !Number.isSafeInteger(eligibleCount) || eligibleCount < 0 || eligibleCount > totalCount) {
    throw new RangeError("Invalid proration ratio");
  }
  const amount = BigInt(agreedAmountPaise);
  const numerator = amount * BigInt(eligibleCount);
  const total = BigInt(totalCount);
  const rounded = (2n * numerator + total) / (2n * total);
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Rounded amount exceeds safe integer");
  return Number(rounded);
};

const requireMethod = (method) => {
  if (!Object.values(SUBSCRIPTION_PRORATION_METHOD).includes(method)) {
    throw new RangeError("Unsupported proration method");
  }
};

const normalizedSessions = (sessionSlots) => {
  if (!Array.isArray(sessionSlots) || sessionSlots.length === 0) {
    throw new RangeError("Scheduled-session proration requires authorized active session slots");
  }
  const seen = new Set();
  return sessionSlots.map((slot) => {
    if (!slot || typeof slot !== "object" || Array.isArray(slot) ||
        typeof slot.scheduleId !== "string" || !slot.scheduleId.trim() ||
        !Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 1 || slot.dayOfWeek > 7 ||
        slot.isActive === false ||
        typeof slot.enrolledFrom !== "string") {
      throw new RangeError("Invalid or inactive assigned session slot");
    }
    if (slot.scheduleId !== slot.scheduleId.trim() || seen.has(slot.scheduleId)) {
      throw new RangeError("Duplicate or invalid assigned schedule ID");
    }
    seen.add(slot.scheduleId);
    validateDate(slot.enrolledFrom);
    if (slot.enrolledUntil != null) {
      validateDate(slot.enrolledUntil);
      if (slot.enrolledUntil < slot.enrolledFrom) {
        throw new RangeError("Session enrollment ends before it starts");
      }
    }
    return slot;
  });
};

/**
 * Exclusion rows are a trusted, audited future input (holiday/cancellation).
 * An exclusion must refer to a real occurrence in the selected full month.
 * There is no holiday/cancellation ledger in the existing application.
 */
const normalizedExclusions = (excludedOccurrences, slots, periodStart, periodEnd) => {
  if (!Array.isArray(excludedOccurrences)) throw new RangeError("Excluded occurrences must be an array");
  const byId = new Map(slots.map((slot) => [slot.scheduleId, slot]));
  const keys = new Set();
  excludedOccurrences.forEach((item) => {
    if (!item || typeof item.scheduleId !== "string" || typeof item.date !== "string") {
      throw new RangeError("Invalid session exclusion");
    }
    validateDate(item.date);
    const slot = byId.get(item.scheduleId);
    if (!slot || item.date < periodStart || item.date > periodEnd ||
        isoWeekday(item.date) !== slot.dayOfWeek) {
      throw new RangeError("Excluded occurrence does not match a scheduled session in this month");
    }
    const key = `${item.scheduleId}|${item.date}`;
    if (keys.has(key)) throw new RangeError("Duplicate excluded session occurrence");
    keys.add(key);
  });
  return keys;
};

const countSessionOccurrences = ({
  periodStart, periodEnd, joinDate, sessionSlots, excludedOccurrences,
}) => {
  const slots = normalizedSessions(sessionSlots);
  const excluded = normalizedExclusions(excludedOccurrences, slots, periodStart, periodEnd);
  let total = 0;
  let eligible = 0;
  const length = inclusiveCalendarDays(periodStart, periodEnd);
  for (let offset = 0; offset < length; offset += 1) {
    const date = addSubscriptionCalendarDays(periodStart, offset);
    const dayOfWeek = isoWeekday(date);
    slots.forEach((slot) => {
      if (slot.dayOfWeek !== dayOfWeek || excluded.has(`${slot.scheduleId}|${date}`)) return;
      total += 1;
      if (date >= joinDate && date >= slot.enrolledFrom &&
          (slot.enrolledUntil == null || date <= slot.enrolledUntil)) {
        eligible += 1;
      }
    });
  }
  if (total === 0) throw new RangeError("No scheduled sessions in the full billing month");
  return {
    totalCount: total,
    eligibleCount: eligible,
    scheduleIds: slots.map((slot) => slot.scheduleId),
    excludedCount: excluded.size,
  };
};

/**
 * One monthly admission quote, not a due or authorization.
 *
 * For anniversary billing, joining 15 Jan gives entitlement to 14 Feb at
 * full price. For fixed-calendar billing, 15-31 Jan may be prorated with
 * the requested calculation method; 1 Feb begins the next full-price cycle.
 *
 * sessionSlots must represent trusted, active, player-specific enrollments,
 * with stable IDs, ISO weekdays (Mon=1..Sun=7), inclusive enrolledFrom/
 * enrolledUntil. Multiple slots on one day count as distinct occurrences.
 */
export const calculateInitialMonthlyProration = ({
  billingAlignment,
  joinDate,
  agreedAmountPaise,
  prorationMethod,
  sessionSlots = [],
  excludedOccurrences = [],
}) => {
  validateDate(joinDate);
  if (!Number.isSafeInteger(agreedAmountPaise) || agreedAmountPaise < 0) {
    throw new RangeError("Agreed recurring amount must be a nonnegative integer number of paise");
  }
  if (!Object.values(SUBSCRIPTION_BILLING_ALIGNMENT).includes(billingAlignment)) {
    throw new RangeError("Billing alignment must be explicitly selected");
  }
  if (!Array.isArray(excludedOccurrences)) {
    throw new RangeError("Excluded occurrences must be an array");
  }
  if (billingAlignment === SUBSCRIPTION_BILLING_ALIGNMENT.ANNIVERSARY_MONTH) {
    if (prorationMethod !== undefined) requireMethod(prorationMethod);
    if (excludedOccurrences.length > 0) {
      throw new RangeError("Session exclusions cannot alter anniversary-based full pricing");
    }
    const period = calculateSubscriptionPeriod({ anchorStartDate: joinDate, billingCycle: "monthly" });
    return {
      billingAlignment,
      appliedMethod: "none",
      fullPeriodStartDate: joinDate,
      eligibleStartDate: joinDate,
      firstPeriodEndDate: period.effectiveEndDate,
      nextRenewalDate: period.nextRenewalDate,
      agreedAmountPaise,
      firstPeriodAmountPaise: agreedAmountPaise,
      discountPaise: 0,
      eligibleCount: 1,
      totalCount: 1,
      scheduleIds: [],
      excludedCount: 0,
      requiresReview: false,
    };
  }

  // Fixed-month billing must select a pricing basis explicitly; no silent default.
  requireMethod(prorationMethod);
  const { fullPeriodStartDate, firstPeriodEndDate, nextRenewalDate } = monthBounds(joinDate);
  let totalCount;
  let eligibleCount;
  let scheduleIds = [];
  let excludedCount = 0;

  if (prorationMethod === SUBSCRIPTION_PRORATION_METHOD.CALENDAR_DAYS) {
    if (excludedOccurrences.length !== 0) {
      throw new RangeError("Session exclusions are not applicable to calendar-day proration");
    }
    totalCount = inclusiveCalendarDays(fullPeriodStartDate, firstPeriodEndDate);
    eligibleCount = inclusiveCalendarDays(joinDate, firstPeriodEndDate);
  } else {
    const sessionCounts = countSessionOccurrences({
      periodStart: fullPeriodStartDate,
      periodEnd: firstPeriodEndDate,
      joinDate,
      sessionSlots,
      excludedOccurrences,
    });
    ({ totalCount, eligibleCount, scheduleIds, excludedCount } = sessionCounts);
  }

  const firstPeriodAmountPaise = proratedPaise(agreedAmountPaise, eligibleCount, totalCount);
  return {
    billingAlignment,
    appliedMethod: prorationMethod,
    fullPeriodStartDate,
    eligibleStartDate: joinDate,
    firstPeriodEndDate,
    nextRenewalDate,
    agreedAmountPaise,
    firstPeriodAmountPaise,
    discountPaise: agreedAmountPaise - firstPeriodAmountPaise,
    eligibleCount,
    totalCount,
    scheduleIds,
    excludedCount,
    // Future billing must be blocked or manually reviewed for zero entitlement.
    requiresReview: eligibleCount === 0,
  };
};
