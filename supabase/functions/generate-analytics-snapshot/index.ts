// Kheltriva Analytics R1.6 — trusted preview calculator.
// No snapshot publication or database writes. Do not deploy before isolated validation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  calculateAttendanceMarks, calculateCohortCollection, monthBounds, reconcileDueLedger, splitPaymentFlows, sum,
} from "./metricUtils.ts";
import { applyAttendanceScope, applyPlayerScope, parsePreviewRequest, type DateRange, type Scope } from "./requestUtils.ts";
import { validateScopeOwnership } from "./scopeValidation.ts";
import { authorizeAnalyticsProfile, extractBearerToken } from "./authorizationUtils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) throw new Error("Missing required server configuration.");

// Privileged reads are allowed only after authenticating the caller and deriving their
// academy scope from public.users. This key must remain server-side.
const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SCHEMA_VERSION = 1;
const REPORTING_TIME_ZONE = "Asia/Kolkata";
type Quality = "verified" | "partial" | "unavailable";
type AttendanceRecord = Record<string, unknown> & { status: string | null; batch_schedule_id: string | null };
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
    let query = adminSupabase.from(table).select(select).range(from, from + pageSize - 1);
    query = configure(query);
    const { data, error } = await query;
    if (error) {
      // Log server-side only. Never return database internals to the caller.
      console.error("Analytics source query failed", { table, code: error.code });
      throw new Error("Analytics source data could not be loaded.");
    }
    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function validateScope(scope: Scope) {
  await validateScopeOwnership(scope, {
    async academyExists(academyId) {
      const { data, error } = await adminSupabase.from("academies").select("id").eq("id", academyId).maybeSingle();
      if (error) throw new Error("Academy scope validation failed.");
      return Boolean(data);
    },
    async findCenter(centerId) {
      const { data, error } = await adminSupabase.from("centers").select("id, academy_id").eq("id", centerId).maybeSingle();
      if (error) throw new Error("Center scope validation failed.");
      return data;
    },
    async findBatch(batchId) {
      const { data, error } = await adminSupabase.from("batches").select("id, academy_id, center_id").eq("id", batchId).maybeSingle();
      if (error) throw new Error("Batch scope validation failed.");
      return data;
    },
  });
}


async function fetchAttendanceMarks(scope: Scope, range: DateRange) {
  const rows = await fetchAll<AttendanceRecord>(
    "attendance",
    "id, attendance_date, status, is_deleted, batch_id, center_id, academy_id, batch_schedule_id",
    query => applyAttendanceScope(
      query.gte("attendance_date", range.startDate).lte("attendance_date", range.endDate).eq("is_deleted", false),
      scope,
    ),
  );
  return calculateAttendanceMarks(rows);
}

async function fetchAttendanceByBatch(scope: Scope, range: DateRange) {
  const [rows, centersResult] = await Promise.all([
    fetchAll<AttendanceRecord>(
      "attendance",
      "id, attendance_date, status, is_deleted, batch_id, center_id, academy_id, batch_schedule_id",
      query => applyAttendanceScope(
        query.gte("attendance_date", range.startDate).lte("attendance_date", range.endDate).eq("is_deleted", false),
        scope,
      ),
    ),
    adminSupabase.from("centers").select("id, center_name, academy_id").eq("academy_id", scope.academyId),
  ]);
  if (centersResult.error) throw new Error("Attendance center labels could not be loaded.");

  const centers = (centersResult.data ?? []).filter((center: any) =>
    scope.scopeType !== "center" || String(center.id) === String(scope.scopeId)
  );
  const centerIds = centers.map((center: any) => String(center.id));
  // Match the canonical active Academy Owner batch scope used by the
  // frontend Batches page, while restricting results to the owned centers.
  const batchesResult = centerIds.length
    ? await adminSupabase.from("batches")
      .select("id, batch_name, center_id, academy_id")
      .eq("academy_id", scope.academyId)
      .eq("is_active", true)
      .in("center_id", centerIds)
    : { data: [], error: null };
  if (batchesResult.error) throw new Error("Attendance batch labels could not be loaded.");

  const batches = (batchesResult.data ?? []).filter((batch: any) =>
    scope.scopeType !== "batch" || String(batch.id) === String(scope.scopeId)
  );
  const centerNames = new Map(centers.map((center: any) => [String(center.id), String(center.center_name || "Unnamed center")]));
  const grouped = new Map<string, { batchId: string; batchName: string; centerId: string; centerName: string; present: number; absent: number }>();

  // Seed every academy batch first so batches with no attendance in this period remain visible.
  for (const batch of batches) {
    const centerId = String(batch.center_id || "");
    if (!centerId || !centerNames.has(centerId)) continue;
    grouped.set(String(batch.id), {
      batchId: String(batch.id),
      batchName: String(batch.batch_name || "Unnamed batch"),
      centerId,
      centerName: centerNames.get(centerId)!,
      present: 0,
      absent: 0,
    });
  }

  for (const row of rows) {
    const id = String(row.batch_id || "");
    const item = grouped.get(id);
    if (!item) continue;
    const status = String(row.status || "").trim().toLowerCase();
    if (status === "present") item.present += 1;
    else if (status === "absent") item.absent += 1;
  }

  return [...grouped.values()].sort((a, b) =>
    a.centerName.localeCompare(b.centerName) || a.batchName.localeCompare(b.batchName)
  );
}

async function calculate(scope: Scope, snapshotMonth: string, attendanceRange: DateRange | null, attendanceComparisonRange: DateRange | null) {
  const bounds = monthBounds(snapshotMonth);
  await validateScope(scope);
  const periodStartDate = bounds.month;
  const periodEndDate = bounds.nextMonthStart;
  const selectedAttendanceRange = attendanceRange ?? { startDate: periodStartDate, endDate: (() => {
    const d = new Date(`${periodEndDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })() };

  const attendance = await fetchAttendanceMarks(scope, selectedAttendanceRange);
  const attendanceByBatch = await fetchAttendanceByBatch(scope, selectedAttendanceRange);
  const attendanceComparison = attendanceComparisonRange
    ? await fetchAttendanceMarks(scope, attendanceComparisonRange)
    : null;

  let paymentRows: Record<string, unknown>[] = [];
  let expenseRows: Record<string, unknown>[] = [];
  let dueRows: Record<string, unknown>[] = [];

  if (scope.scopeType !== "batch") {
    const playerRows = await fetchAll(
      "players", "id, academy_id, center_id",
      query => applyPlayerScope(query, scope),
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
    attendancePeriod: selectedAttendanceRange,
    scope,
    players: {
      openingActive: unavailable<number>("No player lifecycle history for month-start state."),
      newJoins: unavailable<number>("Historical center/batch attribution and lifecycle completeness are not verified."),
      recordedExits: unavailable<number>("No reliable player exit history."),
      closingActive: unavailable<number>("Current is_active cannot reconstruct month-end state."),
    },
    attendance: {
      presentMarks: metric(attendance.presentCount, attendance.markQuality, ...attendance.notes),
      absentMarks: metric(attendance.absentCount, attendance.markQuality, ...attendance.notes),
      attendanceRatePercent: metric(attendance.attendanceRatePercent, attendance.markQuality,
        "Present / (present + absent) among supported recorded marks only; this is not session attendance coverage.",
        ...attendance.notes),
      ignoredStatusCount: metric(attendance.ignoredStatusCount,
        attendance.diagnosticQuality, "Unknown or unsupported statuses are excluded from present/absent totals and the rate."),
      missingScheduleIdCount: metric(attendance.missingScheduleIdCount,
        attendance.diagnosticQuality, "Missing schedule IDs are reported; expected-session coverage is not calculated."),
      batchBreakdown: metric(attendanceByBatch, attendance.markQuality, "Counts are stored present/absent marks grouped by batch for the selected date range."),
      unsupportedStatusBreakdown: metric(attendance.unsupportedStatusBreakdown,
        attendance.diagnosticQuality, "Counts by stored status outside the supported present/absent values; these rows are excluded from attendance totals and rate."),
      comparison: attendanceComparison ? {
        period: attendanceComparisonRange,
        presentMarks: metric(attendanceComparison.presentCount, attendanceComparison.markQuality, ...attendanceComparison.notes),
        absentMarks: metric(attendanceComparison.absentCount, attendanceComparison.markQuality, ...attendanceComparison.notes),
        attendanceRatePercent: metric(attendanceComparison.attendanceRatePercent, attendanceComparison.markQuality,
          "Present / (present + absent) among supported recorded marks only; not expected-session coverage.",
          ...attendanceComparison.notes),
        ignoredStatusCount: metric(attendanceComparison.ignoredStatusCount, attendanceComparison.diagnosticQuality),
        unsupportedStatusBreakdown: metric(attendanceComparison.unsupportedStatusBreakdown, attendanceComparison.diagnosticQuality),
        missingScheduleIdCount: metric(attendanceComparison.missingScheduleIdCount, attendanceComparison.diagnosticQuality),
      } : null,
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
        "No attendance rows or no supported marks do not prove verified zero activity.",
        "Batch finance is unavailable without effective player-to-batch history.",
        "Historical outstanding requires month-end snapshots.",
        "Cohort billed amount is partial because original due amounts are not versioned.",
        "Current due-ledger reconciliation is diagnostic and never repairs source data.",
      ],
    },
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const authorization = req.headers.get("authorization");
  const accessToken = extractBearerToken(authorization);
  if (!authorization || !accessToken) return jsonResponse({ error: "Unauthorized." }, 401);

  // Verify the access token with Supabase Auth. Never trust user_metadata for authorization.
  const authClient = createClient(SUPABASE_URL!, ANON_KEY!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) return jsonResponse({ error: "Unauthorized." }, 401);

  // Resolve role and tenant from the application profile, not from request data or JWT user metadata.
  const { data: profile, error: profileError } = await adminSupabase
    .from("users")
    .select("id, role, academy_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Analytics profile lookup failed", { code: profileError.code });
    return jsonResponse({ error: "Unable to verify Analytics access." }, 500);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return jsonResponse({ error: "Request body must be valid JSON." }, 400); }
  const parsed = parsePreviewRequest(body);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400);

  const authorizationDecision = authorizeAnalyticsProfile(
    profile,
    authData.user.id,
    parsed.value.scope.academyId,
  );
  if (!authorizationDecision.authorized) {
    return jsonResponse({ error: authorizationDecision.reason }, 403);
  }

  try {
    const result = await calculate(
      parsed.value.scope,
      parsed.value.snapshotMonth,
      parsed.value.attendanceRange,
      parsed.value.attendanceComparisonRange,
    );
    return jsonResponse({ previewOnly: true, result }, 200);
  } catch (error) {
    console.error("Analytics preview calculation failed", error);
    const message = error instanceof Error && /month|scope|academy|center|batch|exist|owned/i.test(error.message)
      ? error.message : "Analytics preview could not be calculated. Check server logs.";
    const status = message === "Analytics preview could not be calculated. Check server logs." ? 500 : 400;
    return jsonResponse({ error: message }, status);
  }
});
