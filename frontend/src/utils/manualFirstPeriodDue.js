/**
 * RC1.2 beta-only helper for an Owner-entered first-period tuition due.
 *
 * This is NOT a billing calculator or a trusted authorization boundary.
 * RLS is authoritative; no future price, period, or renewal is written here.
 */
const MAX_AMOUNT_PAISE = 9999999999; // public.payment_dues.total_amount numeric(10,2)

export const toMoneyPaise = (value) => {
  const raw = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new RangeError("Enter a valid amount with no more than two decimal places.");
  }
  const [rupees, fraction = ""] = raw.split(".");
  const amount = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > MAX_AMOUNT_PAISE) {
    throw new RangeError("Amount is outside the supported range.");
  }
  return amount;
};

export const moneyFromPaise = (paise) => (paise / 100).toFixed(2);

export const canAdjustFirstPeriodDue = (subscription, dueType, dueDate) => (
  subscription?.status === "active" &&
  subscription?.subscription_plans?.billing_cycle === "monthly" &&
  dueType === "monthly" &&
  Boolean(subscription?.start_date && dueDate) &&
  subscription.start_date === dueDate
);

export const prepareManualFirstPeriodDue = ({ subscription, dueType, dueDate, enteredAmount, reason }) => {
  if (!canAdjustFirstPeriodDue(subscription, dueType, dueDate)) {
    throw new Error("A first-period fee can only be entered for an active monthly subscription on its start date.");
  }

  const fullPaise = toMoneyPaise(subscription.subscription_plans.amount);
  const feePaise = toMoneyPaise(enteredAmount);
  if (fullPaise <= 0 || feePaise <= 0 || feePaise >= fullPaise) {
    throw new RangeError("Enter an adjusted fee greater than zero and lower than the standard monthly rate.");
  }

  const explanation = String(reason ?? "").replace(/\s+/g, " ").trim();
  if (explanation.length < 8 || explanation.length > 180) {
    throw new RangeError("Provide an adjustment reason between 8 and 180 characters.");
  }

  // Free-text remarks are visible operational evidence, NOT an immutable approval log.
  const remarks = [
    "Owner-entered first-period monthly tuition adjustment.",
    `Standard rate INR ${moneyFromPaise(fullPaise)}; one-time due INR ${moneyFromPaise(feePaise)}.`,
    `Subscription start ${dueDate}.`,
    `Reason: ${explanation}.`,
    "Future recurring plan price unchanged."
  ].join(" ");

  return { amount: feePaise / 100, fullPaise, feePaise, remarks };
};
