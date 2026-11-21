import { addSubscriptionCalendarDays } from "./subscriptionLifecycleDates";

export const ACADEMY_TIME_ZONE = "Asia/Kolkata";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ACADEMY_TIME_ZONE, calendar: "gregory", numberingSystem: "latn",
  era: "short", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/** Strict Gregorian YYYY-MM-DD, supported years 0001-9999; never coerces input. */
export function isValidAcademyDate(value) {
  try {
    return addSubscriptionCalendarDays(value, 0) === value;
  } catch {
    return false;
  }
}

function requireDate(value) {
  if (!isValidAcademyDate(value)) throw new RangeError("Expected a real YYYY-MM-DD date");
  return value;
}

function instantMilliseconds(instant) {
  let milliseconds;
  if (instant instanceof Date) milliseconds = instant.getTime();
  else if (typeof instant === "number") milliseconds = instant;
  else if (typeof instant === "string") {
    // An instant must carry an offset. Reject Date.parse's normalization of bad dates.
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(instant);
    if (!match || !isValidAcademyDate(match[1]) || Number(match[2]) > 23 ||
        Number(match[3]) > 59 || Number(match[4]) > 59 ||
        (match[5] !== "Z" && (Number(match[6]) > 23 || Number(match[7]) > 59))) {
      throw new RangeError("Expected an ISO timestamp with explicit offset");
    }
    milliseconds = Date.parse(instant);
  }
  if (!Number.isSafeInteger(milliseconds) || !Number.isFinite(new Date(milliseconds).getTime())) {
    throw new RangeError("Expected a valid Date, integer epoch milliseconds, or offset ISO timestamp");
  }
  return milliseconds;
}

function localParts(milliseconds) {
  return Object.fromEntries(formatter.formatToParts(milliseconds)
    .filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
}

function dateFromParts(parts) {
  if (parts.era !== "AD") throw new RangeError("Instant is outside the supported calendar");
  return requireDate(`${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`);
}

/** Explicit captured instant -> academy-local date. No implicit current clock. */
export function getAcademyDate(instant) {
  return dateFromParts(localParts(instantMilliseconds(instant)));
}

/** Explicit captured instant -> academy-local ISO weekday, Monday=1, Sunday=7. */
export function getAcademyIsoWeekday(instant) {
  const day = new Date(`${getAcademyDate(instant)}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Date-only input -> half-open date-only month bounds (for PostgreSQL date columns). */
export function getAcademyMonthDateBounds(date) {
  requireDate(date);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  if (nextYear > 9999) throw new RangeError("Next month exceeds supported calendar");
  return {
    startDate: `${date.slice(0, 7)}-01`,
    endDateExclusive: `${String(nextYear).padStart(4, "0")}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`,
  };
}

function midnightInstant(date) {
  // Solve the explicit zone's wall-clock midnight using Intl offsets, not the host
  // timezone or a hardcoded +05:30. Date-only arithmetic stays in the reused helper.
  const wallMilliseconds = Date.parse(`${date}T00:00:00Z`);
  let candidate = wallMilliseconds;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = localParts(candidate);
    const wallAtCandidate = Date.parse(`${dateFromParts(parts)}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    const next = wallMilliseconds - (wallAtCandidate - candidate);
    if (next === candidate) return new Date(candidate).toISOString();
    candidate = next;
  }
  throw new RangeError("Unable to resolve academy midnight");
}

/** Date-only input -> UTC ISO instant bounds for timestamptz queries; never date slices. */
export function getAcademyMonthUtcBounds(date) {
  const { startDate, endDateExclusive } = getAcademyMonthDateBounds(date);
  return { startInstant: midnightInstant(startDate), endInstantExclusive: midnightInstant(endDateExclusive) };
}

/** Ascending inclusive date-only range. Reversed or invalid endpoints throw. */
export function getInclusiveAcademyDateRange(startDate, endDate) {
  requireDate(startDate);
  requireDate(endDate);
  if (startDate > endDate) throw new RangeError("Range start must not follow end");
  const dates = [startDate];
  while (dates[dates.length - 1] < endDate) {
    dates.push(addSubscriptionCalendarDays(dates[dates.length - 1], 1));
  }
  return dates;
}
