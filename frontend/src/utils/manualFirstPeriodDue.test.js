import {
  canAdjustFirstPeriodDue,
  moneyFromPaise,
  prepareManualFirstPeriodDue,
  toMoneyPaise,
} from "./manualFirstPeriodDue";

const sub = Object.freeze({
  id: "subscription-1",
  status: "active",
  start_date: "2026-11-06",
  subscription_plans: Object.freeze({ billing_cycle: "monthly", amount: 1500 }),
});
const request = (changes = {}) => ({
  subscription: sub,
  dueType: "monthly",
  dueDate: "2026-11-06",
  enteredAmount: "1269.23",
  reason: "Joined after the first two scheduled sessions",
  ...changes,
});

test("RC1.2 manual first-period amount remains one-time and preserves plan price", () => {
  const result = prepareManualFirstPeriodDue(request());
  expect(result).toMatchObject({
    amount: 1269.23, fullPaise: 150000, feePaise: 126923,
  });
  expect(result.remarks).toContain("one-time due INR 1269.23");
  expect(result.remarks).toContain("Standard rate INR 1500.00");
  expect(result.remarks).toContain("Future recurring plan price unchanged");
  expect(sub.subscription_plans.amount).toBe(1500);
});

test("RC1.2 exact paise conversion never silently rounds", () => {
  expect(toMoneyPaise("1")).toBe(100);
  expect(toMoneyPaise("1.2")).toBe(120);
  expect(toMoneyPaise("1.23")).toBe(123);
  expect(toMoneyPaise("99999999.99")).toBe(9999999999);
  expect(moneyFromPaise(126923)).toBe("1269.23");
});

test.each(["", "-1", "12.999", "1e2", "1,000", "12abc", "999999999.99", "NaN"])(
  "RC1.2 rejects invalid currency input %p",
  (value) => expect(() => toMoneyPaise(value)).toThrow()
);

test("RC1.2 permits only active monthly subscriptions on their start date", () => {
  expect(canAdjustFirstPeriodDue(sub, "monthly", sub.start_date)).toBe(true);
  expect(canAdjustFirstPeriodDue(sub, "monthly", "2026-11-07")).toBe(false);
  expect(canAdjustFirstPeriodDue(sub, "registration", sub.start_date)).toBe(false);
  expect(canAdjustFirstPeriodDue({ ...sub, status: "inactive" }, "monthly", sub.start_date)).toBe(false);
  expect(canAdjustFirstPeriodDue({ ...sub, subscription_plans: { ...sub.subscription_plans, billing_cycle: "quarterly" } }, "monthly", sub.start_date)).toBe(false);
});

test("RC1.2 rejects attempts to change old or non-monthly dues", () => {
  expect(() => prepareManualFirstPeriodDue(request({ dueDate: "2026-11-07" }))).toThrow(/start date/);
  expect(() => prepareManualFirstPeriodDue(request({ dueType: "registration" }))).toThrow(/start date/);
  expect(() => prepareManualFirstPeriodDue(request({ subscription: { ...sub, status: "inactive" } }))).toThrow(/active monthly/);
});

test.each(["0", "1500", "1500.01"])(
  "RC1.2 rejects zero, full or above-plan amount %p",
  (enteredAmount) => expect(() => prepareManualFirstPeriodDue(request({ enteredAmount }))).toThrow(/lower than/)
);

test("RC1.2 requires a substantial explanation for a one-time adjustment", () => {
  expect(() => prepareManualFirstPeriodDue(request({ reason: "a" }))).toThrow(/reason/);
  expect(() => prepareManualFirstPeriodDue(request({ reason: "x".repeat(181) }))).toThrow(/reason/);
});

test("RC1.2 removes repeated whitespace from reason in the operational remarks", () => {
  const { remarks } = prepareManualFirstPeriodDue(request({ reason: "Joined   after\n several   sessions" }));
  expect(remarks).toContain("Reason: Joined after several sessions.");
  expect(remarks).not.toMatch(/\n/);
});

test("RC1.2 declines a price adjustment with an invalid catalog amount", () => {
  expect(() => prepareManualFirstPeriodDue(request({
    subscription: { ...sub, subscription_plans: { ...sub.subscription_plans, amount: "bad" } }
  }))).toThrow(/valid amount/);
});
