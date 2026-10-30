import { monthBounds } from "./metricUtils.ts";

export type ScopeType = "academy" | "center" | "batch";
export type Scope = { academyId: string; scopeType: ScopeType; scopeId: string };
export type PreviewRequest = { scope: Scope; snapshotMonth: string };
export type PreviewRequestResult =
  | { ok: true; value: PreviewRequest }
  | { ok: false; error: string };

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Pure validation for an already-parsed JSON value. Database ownership is validated separately. */
export function parsePreviewRequest(body: unknown): PreviewRequestResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
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
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid snapshotMonth." };
  }
  const scope: Scope = { academyId, scopeType, scopeId };
  if (scopeType === "academy" && scopeId !== academyId) {
    return { ok: false, error: "Academy scope ID must match academy ID." };
  }
  return { ok: true, value: { scope, snapshotMonth } };
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
