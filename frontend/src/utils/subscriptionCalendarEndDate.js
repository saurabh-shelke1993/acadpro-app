import { isLeapYear, SUBSCRIPTION_CYCLE_MONTHS } from "./subscriptionLifecycleDates";

/**
 * Calendar-aligned first-period end preview for a *new* subscription.
 * This differs deliberately from anniversary-based renewals: a Nov 12
 * monthly subscription ends Nov 30; quarterly runs Nov through January.
 * It does not indicate the paid-through date or trigger a renewal.
 */
export const calculateCalendarAlignedEndDate = (startDate, billingCycle) => {
  if (!Object.prototype.hasOwnProperty.call(SUBSCRIPTION_CYCLE_MONTHS, billingCycle)) {
    throw new RangeError("Unsupported billing cycle");
  }
  const months = SUBSCRIPTION_CYCLE_MONTHS[billingCycle];

  const match = typeof startDate === "string" &&
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  if (!match) throw new RangeError("Expected ISO YYYY-MM-DD date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const daysInMonth = (y, m) =>
    m === 2 ? (isLeapYear(y) ? 29 : 28) :
    [4, 6, 9, 11].includes(m) ? 30 : 31;
  if (year < 1 || year > 9999 || month < 1 || month > 12 ||
      day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError("Invalid subscription start date");
  }

  const endMonthIndex = (year - 1) * 12 + (month - 1) + months - 1;
  const endYear = Math.floor(endMonthIndex / 12) + 1;
  const endMonth = endMonthIndex % 12 + 1;
  if (endYear > 9999) throw new RangeError("End date exceeds supported calendar");
  const endDay = daysInMonth(endYear, endMonth);
  return [
    String(endYear).padStart(4, "0"),
    String(endMonth).padStart(2, "0"),
    String(endDay).padStart(2, "0")
  ].join("-");
};
