export function monthBounds(month: string) {
  if (!/^\d{4}-\d{2}-01$/.test(month)) throw new Error("snapshotMonth must be the first day of a calendar month (YYYY-MM-01).");
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new Error("Invalid snapshotMonth.");
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { month, nextMonthStart, startInstant: `${month}T00:00:00+05:30`, endInstant: `${nextMonthStart}T00:00:00+05:30` };
}

export function dateInRange(value: string | null | undefined, start: string, end: string) {
  return Boolean(value) && value! >= start && value! < end;
}

export function instantInRange(value: string | null | undefined, startInstant: string, endInstant: string) {
  if (!value) return false;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && instant >= Date.parse(startInstant) && instant < Date.parse(endInstant);
}

export function sum(rows: Record<string, unknown>[], field: string) {
  return rows.reduce((total, row) => {
    const raw = row[field];
    if (raw === null || raw === undefined || raw === "") return total;
    if (typeof raw === "string" && raw.trim() === "") throw new Error(`Invalid numeric value in ${field}.`);
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`Invalid numeric value in ${field}.`);
    return total + value;
  }, 0);
}

export type PaymentRow = {
  id: string; due_id: string | null; amount_paid: number | string | null;
  payment_entry_type: string | null; payment_date: string | null;
};
export type DueBalanceRow = { id: string; paid_amount: number | string | null; total_amount?: number | string | null; due_status?: string | null };

export function reconcileDueLedger(dues: DueBalanceRow[], payments: PaymentRow[]) {
  const byDue = new Map<string, PaymentRow[]>();
  let unclassifiedPaymentEntryCount = 0;
  for (const row of payments) {
    if (row.payment_entry_type !== "payment" && row.payment_entry_type !== "adjustment") unclassifiedPaymentEntryCount++;
    if (row.due_id) byDue.set(row.due_id, [...(byDue.get(row.due_id) ?? []), row]);
  }
  let mismatchCount = 0, paidWithoutLedgerCount = 0, ledgerExceedsPaidCount = 0, invalidAmountCount = 0, unclassifiedDueCount = 0, checkedDueCount = 0;
  const details: Array<{ dueId: string; recordedPaid: number | null; ledgerNet: number | null; issue: string | null }> = [];
  for (const due of dues) {
    const raw = due.paid_amount;
    const paid = raw === null || raw === undefined || raw === "" || (typeof raw === "string" && raw.trim() === "") ? NaN : Number(raw);
    const linked = byDue.get(due.id) ?? [];
    const hasUnknown = linked.some(row => row.payment_entry_type !== "payment" && row.payment_entry_type !== "adjustment");
    const recognized = linked.filter(row => row.payment_entry_type === "payment" || row.payment_entry_type === "adjustment");
    const valid = recognized.every(row => row.amount_paid !== null && row.amount_paid !== undefined && row.amount_paid !== "" && !(typeof row.amount_paid === "string" && row.amount_paid.trim() === "") && Number.isFinite(Number(row.amount_paid)));
    const ledger = valid ? recognized.reduce((n, row) => n + Number(row.amount_paid), 0) : NaN;
    let issue: string | null = null;
    if (hasUnknown) { unclassifiedDueCount++; issue = "unclassified_payment_entry_type"; }
    else if (!Number.isFinite(paid) || !valid) { invalidAmountCount++; issue = "invalid_amount"; }
    else {
      checkedDueCount++;
      const p = Math.round(paid * 100), l = Math.round(ledger * 100);
      if (p !== l) { mismatchCount++; issue = "paid_amount_mismatch"; }
      if (p > 0 && recognized.length === 0) { paidWithoutLedgerCount++; issue = "paid_without_ledger"; }
      if (l > p) { ledgerExceedsPaidCount++; issue = "ledger_exceeds_paid_amount"; }
    }
    details.push({ dueId: due.id, recordedPaid: Number.isFinite(paid) ? paid : null, ledgerNet: Number.isFinite(ledger) && !hasUnknown ? ledger : null, issue });
  }
  return { checkedDueCount, mismatchCount, paidWithoutLedgerCount, ledgerExceedsPaidCount, invalidAmountCount, unclassifiedPaymentEntryCount, unclassifiedDueCount, details };
}

export function splitPaymentFlows(rows: PaymentRow[], startInstant: string, endInstant: string) {
  const inPeriod = rows.filter(row => instantInRange(row.payment_date, startInstant, endInstant));
  const payments = inPeriod.filter(row => row.payment_entry_type === "payment");
  const adjustments = inPeriod.filter(row => row.payment_entry_type === "adjustment");
  const grossRecordedCollections = sum(payments as unknown as Record<string, unknown>[], "amount_paid");
  const signedAdjustments = sum(adjustments as unknown as Record<string, unknown>[], "amount_paid");
  return { payments, adjustments, grossRecordedCollections, signedAdjustments, netRecordedCollections: grossRecordedCollections + signedAdjustments };
}

export function calculateCohortCollection(
  dues: Array<{ id: string; total_amount: number | string | null; created_at: string | null }>,
  payments: PaymentRow[], startInstant: string, endInstant: string,
) {
  const cohortDues = dues.filter(due => instantInRange(due.created_at, startInstant, endInstant));
  const dueIds = new Set(cohortDues.map(due => due.id));
  const transactions = payments.filter(row => dueIds.has(row.due_id ?? "") && instantInRange(row.payment_date, "1970-01-01T00:00:00Z", endInstant));
  const unclassifiedPaymentEntryCount = transactions.filter(row => row.payment_entry_type !== "payment" && row.payment_entry_type !== "adjustment").length;
  const amounts = [...cohortDues.map(due => due.total_amount), ...transactions.filter(row => row.payment_entry_type === "payment" || row.payment_entry_type === "adjustment").map(row => row.amount_paid)];
  const invalidAmountCount = amounts.filter(value => value === null || value === undefined || value === "" || (typeof value === "string" && value.trim() === "") || !Number.isFinite(Number(value))).length;
  if (invalidAmountCount || unclassifiedPaymentEntryCount) return { billedAmount: null, netAllocatedAmount: null, collectionRatePercent: null, cohortDueIds: [...dueIds], quality: "unavailable" as const, invalidAmountCount, unclassifiedPaymentEntryCount };
  const billedAmount = cohortDues.reduce((n, due) => n + Number(due.total_amount), 0);
  const paid = transactions.filter(row => row.payment_entry_type === "payment").reduce((n, row) => n + Number(row.amount_paid), 0);
  const adjustments = transactions.filter(row => row.payment_entry_type === "adjustment").reduce((n, row) => n + Number(row.amount_paid), 0);
  return { billedAmount, netAllocatedAmount: paid + adjustments, collectionRatePercent: billedAmount > 0 ? Math.round(((paid + adjustments) / billedAmount) * 10000) / 100 : null, cohortDueIds: [...dueIds], quality: "partial" as const, invalidAmountCount: 0, unclassifiedPaymentEntryCount: 0 };
}

export type AttendanceSourceRow = {
  status: string | null;
  batch_schedule_id: string | null;
};
export type AttendanceMarkQuality = "partial" | "unavailable";

/**
 * Calculates recorded attendance marks without implying expected-session coverage.
 * Empty or wholly unclassifiable sources never become numeric zero attendance.
 */
export function calculateAttendanceMarks(rows: AttendanceSourceRow[]) {
  const valid = rows.filter(row => row.status === "present" || row.status === "absent");
  const presentCount = valid.filter(row => row.status === "present").length;
  const absentCount = valid.filter(row => row.status === "absent").length;
  const ignoredStatusCount = rows.length - valid.length;
  const missingScheduleIdCount = rows.filter(row => !row.batch_schedule_id).length;
  const hasUsableMarks = valid.length > 0;
  const markQuality: AttendanceMarkQuality = hasUsableMarks ? "partial" : "unavailable";
  const diagnosticQuality: AttendanceMarkQuality = rows.length > 0 ? "partial" : "unavailable";
  const notes = rows.length === 0
    ? ["No attendance rows were found; source completeness is not established, so zero activity is not asserted."]
    : !hasUsableMarks
      ? ["Rows exist, but none has a supported present/absent status; attendance totals and rate are unavailable."]
      : [
        "Counts represent recorded, non-deleted present/absent marks only; expected-session coverage is not established.",
        ...(ignoredStatusCount > 0 ? ["Unsupported statuses were excluded from present/absent totals and the rate."] : []),
        ...(missingScheduleIdCount > 0 ? ["Some attendance rows lack a batch schedule ID; session coverage cannot be verified."] : []),
      ];
  return {
    presentCount: hasUsableMarks ? presentCount : null,
    absentCount: hasUsableMarks ? absentCount : null,
    attendanceRatePercent: hasUsableMarks
      ? Math.round((presentCount / valid.length) * 10000) / 100
      : null,
    ignoredStatusCount: rows.length > 0 ? ignoredStatusCount : null,
    missingScheduleIdCount: rows.length > 0 ? missingScheduleIdCount : null,
    markQuality,
    diagnosticQuality,
    notes,
  };
}
