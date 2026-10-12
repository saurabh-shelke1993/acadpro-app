import {
  calculateExpenseOverview,
  getExpenseOverviewPeriod,
} from "./expenseFinancialOverview";

describe("expense financial overview periods", () => {
  test("returns the current month boundaries", () => {
    expect(getExpenseOverviewPeriod("monthly", new Date(2026, 9, 12))).toMatchObject({
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      label: "October 2026",
      monthCount: 1,
    });
  });

  test("returns the current quarter boundaries", () => {
    expect(getExpenseOverviewPeriod("quarterly", new Date(2026, 9, 12))).toMatchObject({
      startDate: "2026-10-01",
      endDate: "2026-12-31",
      label: "Q4 2026",
      monthCount: 3,
    });
  });

  test("compares monthly expected recurring costs against actual paid expenses", () => {
    const result = calculateExpenseOverview({
      referenceDate: new Date(2026, 9, 12),
      periodType: "monthly",
      reminders: [
        { id: "rent", frequency: "monthly", expected_amount: 12000, next_due_date: "2026-10-01", is_active: true },
        { id: "coach", frequency: "monthly", expected_amount: 8000, next_due_date: "2026-10-05", is_active: true },
        { id: "quarterly", frequency: "quarterly", expected_amount: 15000, next_due_date: "2026-11-01", is_active: true },
        { id: "inactive", frequency: "monthly", expected_amount: 5000, next_due_date: "2026-10-01", is_active: false },
      ],
      expenses: [
        { id: "e1", reminder_id: "rent", expense_date: "2026-10-02", amount_paid: 11800 },
        { id: "e2", reminder_id: null, expense_date: "2026-10-09", amount_paid: 1200 },
        { id: "e3", reminder_id: null, expense_date: "2026-09-30", amount_paid: 9999 },
      ],
    });

    expect(result.expectedAmount).toBe(20000);
    expect(result.paidAmount).toBe(13000);
    expect(result.varianceAmount).toBe(7000);
    expect(result.expenseCount).toBe(2);
  });

  test("quarterly view counts three monthly cycles and a quarterly reminder due by quarter end", () => {
    const result = calculateExpenseOverview({
      referenceDate: new Date(2026, 9, 12),
      periodType: "quarterly",
      reminders: [
        { id: "monthly", frequency: "monthly", expected_amount: 1000, next_due_date: "2026-10-10", is_active: true },
        { id: "quarterly-due", frequency: "quarterly", expected_amount: 6000, next_due_date: "2026-12-15", is_active: true },
        { id: "next-quarter", frequency: "quarterly", expected_amount: 4000, next_due_date: "2027-01-01", is_active: true },
      ],
      expenses: [
        { id: "e1", reminder_id: "monthly", expense_date: "2026-11-10", amount_paid: 900 },
        { id: "e2", reminder_id: "quarterly-due", expense_date: "2026-12-20", amount_paid: 6500 },
      ],
    });

    expect(result.expectedAmount).toBe(9000);
    expect(result.paidAmount).toBe(7400);
    expect(result.varianceAmount).toBe(1600);
  });

  test("includes a quarterly reminder recorded within the period even when next due date moved forward", () => {
    const result = calculateExpenseOverview({
      referenceDate: new Date(2026, 9, 12),
      periodType: "monthly",
      reminders: [
        { id: "quarterly", frequency: "quarterly", expected_amount: 7000, next_due_date: "2027-01-01", is_active: true },
      ],
      expenses: [
        { id: "e1", reminder_id: "quarterly", expense_date: "2026-10-05", amount_paid: 7200 },
      ],
    });
    expect(result.expectedAmount).toBe(7000);
    expect(result.paidAmount).toBe(7200);
    expect(result.varianceAmount).toBe(-200);
  });

  test("uses collected payment ledger entries as income and excludes adjustment events", () => {
    const result = calculateExpenseOverview({
      referenceDate: new Date(2026, 9, 12),
      periodType: "monthly",
      expenses: [
        { id: "e1", reminder_id: null, expense_date: "2026-10-03", amount_paid: 3000 },
      ],
      reminders: [],
      payments: [
        { id: "p1", payment_entry_type: "payment", amount_paid: 15000 },
        { id: "p2", payment_entry_type: "payment", amount_paid: 2500 },
        { id: "a1", payment_entry_type: "adjustment", amount_paid: -1000 },
      ],
    });

    expect(result.incomeCollected).toBe(17500);
    expect(result.paidAmount).toBe(3000);
    expect(result.netCashMovement).toBe(14500);
  });

});