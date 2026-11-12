import { addSubscriptionCalendarDays } from "./subscriptionLifecycleDates";

/**
 * A One-time plan has an explicitly approved inclusive camp period.
 * Do not infer its end from a billing-cycle length or create any payment due.
 * Uses existing date-only Gregorian validation (no JS timezone conversions).
 */
export const validateOneTimeCampPeriod = ({ startDate, endDate }) => {
  if (!endDate) {
    throw new RangeError("Enter an end date for the One-time camp.");
  }
  if (!startDate) {
    throw new RangeError("Select a start date for the One-time camp.");
  }

  // Zero-day offset validates YYYY-MM-DD and actual Gregorian dates.
  addSubscriptionCalendarDays(startDate, 0);
  addSubscriptionCalendarDays(endDate, 0);

  if (endDate < startDate) {
    throw new RangeError("The camp end date cannot be before its start date.");
  }
  return { startDate, endDate };
};
