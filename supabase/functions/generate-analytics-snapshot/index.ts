// Kheltriva Analytics R1.6 — trusted preview calculator.
// No snapshot publication or database writes. Do not deploy before isolated validation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  calculateCohortCollection, monthBounds, reconcileDueLedger, splitPaymentFlows, sum,
} from "./metricUtils.ts";
import { applyAttendanceScope, applyPlayerScope, parsePreviewRequest, type Scope } from "./requestUtils.ts";
import { validateScopeOwnership } from "./scopeValidation.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Missing required server configuration.");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SCHEMA_VERSION = 1;
const REPORTING_TIME_ZONE = "Asia/Kolkata";
type Quality = "verified" | "partial" | "unavailable";
type Metric<T> = { value: T | null; quality: Quality; notes: string[] };
const metric = <T>(value: T | null, quality: Quality, ...notes: string[]): Metric<T> => ({ value, quality, notes });
const unavailable = <T>(reason: string): Metric<T> => metric<T>(null, "unavailable", reason);

 Kheltriva Analytics R1.6 — trusted preview calculator.
// No snapshot publication or database writes. Do not deploy before isolated validation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  calculateCohortCollection, monthBounds, reconcileDueLedger, splitPaymentFlows, sum,
} from "./metricUtils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Missing required server configuration.");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SCHEMA_VERSION = 1;
const REPORTING_TIME_ZONE = "Asia/Kolkata";
type ScopeType = "academy" | "center" | "batch";
type Quality = "verified" | "partial" | "unavailable";
type Scope = { academyId: string; scopeType: ScopeType; scopeId: string };
type Metric<T> = { value: T | null; quality: Quality; notes: string[] };
const metric = <T>(value: T | null, quality: Quality, ...notes: string[]): Metric<T> => ({ value, quality, notes });
const unavailable = <T>(reason: string): Metric<T> => metric<T>(null, "unavailable", reason);

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function fetchAll<T extends Record<string, unknown>>(
  table: string, select: string, configure: (query: any) => any,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    query = configure(query);
    const { data, error } = await query;
    if (error) {
      // Log server-side only. Never return database internals to the caller.
      console.error("Analytics source query failed", { table, code: error.code });
      throw new Error("Analytics source data could not be loaded.");
    }
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function validateScope(scope: Scope) {
  await validateScopeOwnership(scope, {
    async academyExists(academyId) {
      const { data, error } = await supabase.from("academies").select("id").eq("id", academyId).maybeSingle();
      if (error) throw new Error("Academy scope validation failed.");
      return Boolean(data);
    },
    async findCenter(centerId) {
      const { data, error } = await supabase.from("centers").select("id, academy_id").eq("id", centerId).maybeSingle();
      if (error) throw new Error("Center scope validation failed.");
      return data;
    },
    async findBatch(batchId) {
      const { data, error } = await supabase.from("batches").select("id, academy_id, center_id").eq("id", batchId).maybeSingle();
      if (error) throw new Error("Batch scope validation failed.");
      return data;
    },
  });
}


async function calculate(scope: Scope, snapshotMonth: string) {
  const bounds = monthBounds(snapshotMonth);
  await validateScope(scope);
  const periodStartDate = bounds.month;
  const periodEndDate = bounds.nextMonthStart;

  const attendanceRows = await fetchAll(
    "attendance",
    "id, attendance_date, status, is_deleted, batch_id, center_id, academy_id, batch_schedule_id",
    query => attendanceQuery(
      query.gte("attendance_date", periodStartDate).lt("attendance_date", periodEndDate).eq("is_deleted", false),
      scope,
    ),
  );

  const validAttendance = attendanceRows.filter(row => row.status === "present" || row.status === "absent");
  const present = validAttendance.filter(row => row.status === "present").length;
  const absent = validAttendance.filter(row => row.status === "absent").length;
  const unknownStatusCount = attendanceRows.length - validAttendance.length;
  const missingScheduleIdCount = attendanceRows.filter(row => !row.batch_schedule_id).length;
  // A zero denominator is not evidence of a verified zero without source coverage.
  const attendanceQuality: Quality = attendanceRows.length === 0 ? "unavailable" : "partial";
  const attendanceRate = present + absent > 0 ? Math.round((present / (present + absent)) * 10000) / 100 : null;
  const attendanceCoverageNote = attendanceRows.length === 0
    ? "No attendance rows were found; source completeness is not established, so zero is not asserted."
    : "Counts recorded, non-deleted marks only; this is not expected-session coverage.";

  let paymentRows: Record<string, unknown>[] = [];
  let expenseRows: Record<string, unknown>[] = [];
  let dueRows: Record<string, unknown>[] = [];

  if (scope.scopeType !== "batch") {
    const playerRows = await fetchAll(
      "players", "id, academy_id, center_id",
      query => {
        let q = query.eq("academy_id", scope.academyId);
        if (scope.scopeType === "center") q = q.eq("center_id", scope.scopeId);
        return q;
      },
    );
    const playerIds = playerRows.map(row => String(row.id)).filter(Boolean);
    if (playerIds.length) {
      paymentRows = await fetchAll(
        "payments",
        "id, player_id, due_id, payment_date, amount_paid, payment_entry_type, related_payment_id",
        query => query.in("player_id", playerIds),
      );
      dueRows = await fetchAll(
        "payment_dues",
        "id, player_id, total_amount, paid_amount, remaining_amount, due_status, created_at, due_date",
        query => query.in("player_id", playerIds),
      );
    }
    if (scope.scopeType === "academy") {
      expenseRows = await fetchAll(
        "expenses", "id, academy_id, expense_date, amount_paid",
        query => query.eq("academy_id", scope.academyId)
          .gte("expense_date", periodStartDate).lt("expense_date", periodEndDate),
      );
    }
  }

  const flows = splitPaymentFlows(paymentRows as any, bounds.startInstant, bounds.endInstant);
  const recordedExpenses = sum(expenseRows, "amount_paid");
  const reconciliation = reconcileDueLedger(dueRows as any, paymentRows as any);
  const cohort = calculateCohortCollection(dueRows as any, paymentRows as any, bounds.startInstant, bounds.endInstant);
  const unclassifiedPaymentRows = paymentRows.filter(row =>
    row.payment_entry_type !== "payment" && row.payment_entry_type !== "adjustment"
  ).length;
  const financeScopeQuality: Quality = "partial";
  const reconciliationQuality: Quality =
    reconciliation.invalidAmountCount > 0 || reconciliation.mismatchCount > 0 ||
    reconciliation.unclassifiedPaymentEntryCount > 0 || reconciliation.unclassifiedDueCount > 0
      ? "partial" : "verified";
  const financeIsBatch = scope.scopeType === "batch";

  return {
    schemaVersion: SCHEMA_VERSION,
    reportingTimeZone: REPORTING_TIME_ZONE,
    period: { start: periodStartDate, endExclusive: periodEndDate },
    scope,
    players: {
      openingActive: unavailable<number>("No player lifecycle history for month-start state."),
      newJoins: unavailable<number>("Historical center/batch attribution and lifecycle completeness are not verified."),
      recordedExits: unavailable<number>("No reliable player exit history."),
      closingActive: unavailable<number>("Current is_active cannot reconstruct month-end state."),
    },
    attendance: {
      presentMarks: metric(present, attendanceQuality, attendanceCoverageNote),
      absentMarks: metric(absent, attendanceQuality, attendanceCoverageNote),
      attendanceRatePercent: metric(attendanceRate, attendanceQuality,
        present + absent === 0 ? "No valid present/absent marks; rate is unavailable." : "Present / (present + absent); excludes other statuses."),
      ignoredStatusCount: metric(unknownStatusCount, "partial", "Unknown or unsupported statuses are excluded from the rate."),
      missingScheduleIdCount: metric(missingScheduleIdCount, "partial", "Missing schedule IDs are reported; expected-session coverage is not calculated."),
      sessionCount: unavailable<number>("A reliable session identity/eligibility model has not been verified."),
    },
    coaches: {
      activeCoachCount: unavailable<number>("Historical coach lifecycle state is unavailable."),
      assignedCoachCount: unavailable<number>("Historical assignment coverage is incomplete."),
      batchCoverage: unavailable<number>("Historical eligible batch/session denominator is not established."),
    },
    enquiries: {
      received: unavailable<number>("Enquiry query is not included in this calculator pass."),
      trialsScheduled: unavailable<number>("Trial scheduling semantics need verification."),
      trialsCompleted: unavailable<number>("Status alone is not evidence of trial attendance."),
      conversions: unavailable<number>("Conversion cohort observation window is not finalized."),
      cohortConversionRatePercent: unavailable<number>("Conversion cohort observation window is not finalized."),
    },
    finance: {
      grossRecordedCollections: financeIsBatch ? unavailable<number>("Batch finance cannot be historically attributed from current player-batch mappings.") :
        metric(flows.grossRecordedCollections, financeScopeQuality, "Payment entries attributed by payment_date; payment_entry_type=payment only."),
      signedAdjustments: financeIsBatch ? unavailable<number>("Batch finance cannot be historically attributed.") :
        metric(flows.signedAdjustments, "partial", "Signed adjustment entries attributed by their own payment_date."),
      netRecordedCollections: financeIsBatch ? unavailable<number>("Batch finance cannot be historically attributed.") :
        metric(flows.netRecordedCollections, "partial", "Gross payment entries plus signed adjustments; not independently verified cash received."),
      recordedExpenses: scope.scopeType === "academy" ? metric(recordedExpenses, "partial", "Academy expenses attributed by expense_date.") :
        unavailable<number>("Expenses are academy-scoped only; center/batch allocation is unavailable."),
      netRecordedCashMovement: scope.scopeType === "academy" ?
        metric(flows.netRecordedCollections - recordedExpenses, "partial", "Net recorded collections less recorded expenses; not profit or cash balance.") :
        unavailable<number>("Expense allocation is unavailable for this scope."),
      billingCohortCreatedThisMonth: financeIsBatch || cohort.quality === "unavailable" ?
        unavailable<number>("Cohort billing is unavailable because attribution or source quality is insufficient.") :
        metric(cohort.billedAmount, "partial", "Current due total_amount for dues created this month; original billed amounts are not versioned."),
      cohortCollectionRatePercent: financeIsBatch || cohort.quality === "unavailable" || cohort.collectionRatePercent === null ?
        unavailable<number>("Cohort collection rate is unavailable because attribution, source quality or denominator is insufficient.") :
        metric(cohort.collectionRatePercent, "partial", "Linked payment/adjustment entries through month-end divided by current due amount; historical original amount is not versioned."),
      historicalOutstanding: unavailable<number>("Requires a published month-end balance snapshot."),
      currentLedgerOutstanding: financeIsBatch ? unavailable<number>("Batch finance cannot be historically attributed.") :
        metric(sum(dueRows, "remaining_amount"), "partial", "Current remaining_amount only; not historical month-end outstanding."),
      currentDueLedgerReconciliation: financeIsBatch ? unavailable<typeof reconciliation>("Batch finance cannot be historically attributed.") :
        metric(reconciliation, reconciliationQuality, "Current-state due paid_amount compared with linked payment/adjustment ledger; diagnostic only."),
      unclassifiedPaymentEntryCount: financeIsBatch ? unavailable<number>("Batch finance cannot be historically attributed.") :
        metric(unclassifiedPaymentRows, unclassifiedPaymentRows > 0 ? "partial" : "verified", "Unknown entry types are excluded from recognized flow totals."),
    },
    quality: {
      overall: "partial" as Quality,
      notes: [
        "Preview only; no snapshot is published.",
        "No attendance rows do not prove verified zero activity.",
        "Batch finance is unavailable without effective player-to-batch history.",
        "Historical outstanding requires month-end snapshots.",
        "Cohort billed amount is partial because original due amounts are not versioned.",
        "Current due-ledger reconciliation is diagnostic and never repairs source data.",
      ],
    },
  };
}

Deno.serve(async req => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
  if (req.headers.get("authorization") !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const parsed = parsePreviewRequest(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const { scope, snapshotMonth } = parsed.value;
  try {
    const result = await calculate(scope, snapshotMonth);
    return Response.json({ previewOnly: true, result }, { status: 200 });
  } catch (error) {
    console.error("Analytics preview calculation failed", error);
    const message = error instanceof Error && /month|scope|academy|center|batch|exist|owned/i.test(error.message)
      ? error.message : "Analytics preview could not be calculated. Check server logs.";
    const status = message === "Analytics preview could not be calculated. Check server logs." ? 500 : 400;
    return Response.json({ error: message }, { status });
  }
});
