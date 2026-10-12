const toDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getExpenseOverviewPeriod = (periodType = "monthly", referenceDate = new Date()) => {
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();
  let start;
  let end;
  let label;
  let nextPeriodStart;

  if (periodType === "quarterly") {
    const quarter = Math.floor(monthIndex / 3) + 1;
    const startMonth = (quarter - 1) * 3;
    start = new Date(year, startMonth, 1);
    end = new Date(year, startMonth + 3, 0);
    nextPeriodStart = new Date(year, startMonth + 3, 1);
    label = `Q${quarter} ${year}`;
  } else {
    start = new Date(year, monthIndex, 1);
    end = new Date(year, monthIndex + 1, 0);
    nextPeriodStart = new Date(year, monthIndex + 1, 1);
    label = referenceDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }

  return {
    periodType: periodType === "quarterly" ? "quarterly" : "monthly",
    startDate: toDateString(start),
    endDate: toDateString(end),
    startDateTime: start.toISOString(),
    endDateTimeExclusive: nextPeriodStart.toISOString(),
    label,
    monthCount: periodType === "quarterly" ? 3 : 1,
  };
};

export const calculateExpenseOverview = ({
  expenses = [],
  reminders = [],
  payments = [],
  periodType = "monthly",
  referenceDate = new Date(),
}) => {
  const period = getExpenseOverviewPeriod(periodType, referenceDate);
  const periodExpenses = expenses.filter((expense) => (
    expense.expense_date >= period.startDate && expense.expense_date <= period.endDate
  ));
  const activeReminders = reminders.filter((reminder) => reminder.is_active);
  const periodReminderIds = new Set(
    periodExpenses.map((expense) => expense.reminder_id).filter(Boolean)
  );

  const monthlyExpected = activeReminders
    .filter((reminder) => reminder.frequency === "monthly")
    .reduce((sum, reminder) => sum + Number(reminder.expected_amount || 0), 0)
    * period.monthCount;

  const quarterlyExpected = activeReminders
    .filter((reminder) => reminder.frequency === "quarterly")
    .filter((reminder) => (
      reminder.next_due_date <= period.endDate || periodReminderIds.has(reminder.id)
    ))
    .reduce((sum, reminder) => sum + Number(reminder.expected_amount || 0), 0);

  const expectedAmount = monthlyExpected + quarterlyExpected;
  const paidAmount = periodExpenses.reduce((sum, expense) => sum + Number(expense.amount_paid || 0), 0);
  const incomeCollected = payments
    .filter((payment) => payment.payment_entry_type === "payment")
    .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
  const netCashMovement = incomeCollected - paidAmount;
  const today = toDateString(referenceDate);
  const overdueReminderCount = activeReminders.filter((reminder) => reminder.next_due_date < today).length;

  return {
    ...period,
    expectedAmount,
    paidAmount,
    incomeCollected,
    netCashMovement,
    varianceAmount: expectedAmount - paidAmount,
    activeReminderCount: activeReminders.length,
    overdueReminderCount,
    expenseCount: periodExpenses.length,
    periodExpenses,
  };
};
