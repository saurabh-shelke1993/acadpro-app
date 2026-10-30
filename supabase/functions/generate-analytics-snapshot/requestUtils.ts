import { monthBounds } from "./metricUtils.ts";

export type ScopeType = "academy" | "center" | "batch";
export type Scope = { academyId: string; scopeType: ScopeType; scopeId: string };
export type DateRange = { startDate: string; endDate: string };
export type PreviewRequest = {
  scope: Scope;
  snapshotMonth: string;
  attendanceRange: DateRange | null;
  attendanceComparisonRange: DateRange | null;
};
export type PreviewRequestResult =
  | { ok: true; value: PreviewRequest }
  | { ok: false; error: string };

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseDateRange(start: unknown, end: unknown, label: string): DateRange | null {
  if (start === undefined && end === undefined) return null;
  if (!isCalendarDate(start) || !isCalendarDate(end)) {
    throw new Error(`${label} must include valid start and end dates in YYYY-MM-DD format.`);
  }
  if (start > end) throw new Error(`${label} start date must be on or before its end date.`);
  const rangeDays = (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86400000;
  if (rangeDays > 5 * 366) throw new Error(`${label} cannot exceed five years.`);
  return { startDate: start, endDate: end };
}

/** Pure validation for an already-parsed JSON value. Database ownership is validated separately. */
export function parsePreviewRequest(body: unknown): PreviewRequestResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const value = body as Record<string, unknown>;
  const { academyId, scopeType, scopeId, snapshotMonth } = value;
  if (!isUuid(academyId) || !isUuid(scopeId)) {
    return { ok: false, error: "academyId and scopeId must be valid UUIDs." };
  }
  if (scopeType !== "academy" && scopeType !== "center" && scopeType !== "batch") {
    return { ok: false, error: "scopeType must be academy, center or batch." };
  }
  if (typeof snapshotMonth !== "string") {
    return { ok: false, error: "snapshotMonth must use YYYY-MM-01 format." };
  }
  try {
    monthBounds(snapshotMonth);
    const attendanceRange = parseDateRange(value.attendanceStartDate, value.attendanceEndDate, "Attendance date range");
    const attendanceComparisonRange = parseDateRange(
      value.comparisonStartDate, value.comparisonEndDate, "Comparison date range",
    );
    const scope: Scope = { academyId, scopeType, scopeId };
    if (scopeType === "academy" && scopeId !== academyId) {
      return { ok: false, error: "Academy scope ID must match academy ID." };
    }
    return { ok: true, value: { scope, snapshotMonth, attendanceRange, attendanceComparisonRange } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid Analytics request." };
  }
}

/** Apply tenant predicate first, then the requested narrower attendance dimension. */
export function applyAttendanceScope<T>(query: T, scope: Scope): T {
  const q = query as any;
  let scoped = q.eq("academy_id", scope.academyId);
  if (scope.scopeType === "center") scoped = scoped.eq("center_id", scope.scopeId);
  if (scope.scopeType === "batch") scoped = scoped.eq("batch_id", scope.scopeId);
  return scoped as T;
}

/** Player finance is academy-scoped, with optional current center attribution. */
export function applyPlayerScope<T>(query: T, scope: Scope): T {
  const q = query as any;
  let scoped = q.eq("academy_id", scope.academyId);
  if (scope.scopeType === "center") scoped = scoped.eq("center_id", scope.scopeId);
  return scoped as T;
}
