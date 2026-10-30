# Analytics V2 — R2.1 Attendance Data Contract

**Date:** 30 October 2026  
**Branch:** `payment-module-finalization`  
**Status:** Implemented in code; automated validation pending.  
**Database changes:** None.  
**Deployment:** None.

## Accepted rules

1. Use actual stored, non-deleted attendance records and their `attendance_date`.
2. Exact `present` and `absent` statuses contribute to supported mark totals and the recorded-mark rate.
3. All other statuses (including null or blank values) are excluded from supported totals and rates. The response reports both the total ignored count and a normalized status breakdown.
4. Missing `batch_schedule_id` is a separate diagnostic. A valid present/absent mark is still counted even when its schedule reference is missing.
5. No rows or no supported marks produce unavailable values, not verified numeric zero.
6. Recorded-mark rate is `present / (present + absent)`. It is not expected-session attendance coverage.
7. Primary and comparison date ranges are independently selected, inclusive calendar-date ranges. Each range must be valid and cannot exceed five years.
8. The attendance query always constrains `academy_id` first, then applies the requested center/batch scope. Date filters cannot widen tenant scope.
9. Finance continues to use the existing monthly `snapshotMonth` and is not affected by attendance range filters.
10. Different range lengths are accepted and explicitly shown; rates are not normalized by range length.

## API contract

Optional request fields:
- `attendanceStartDate`
- `attendanceEndDate`
- `comparisonStartDate`
- `comparisonEndDate`

If the primary attendance range is omitted, the existing monthly attendance period is used. A comparison result is returned only when both comparison dates are supplied. Supplying only one date in either pair is rejected.

Response additions:
- `attendancePeriod`
- `attendance.unsupportedStatusBreakdown`
- `attendance.comparison` with period, present/absent marks, recorded-mark rate and diagnostics.

## Implementation files

- `supabase/functions/generate-analytics-snapshot/requestUtils.ts`
- `supabase/functions/generate-analytics-snapshot/metricUtils.ts`
- `supabase/functions/generate-analytics-snapshot/index.ts`
- `supabase/functions/generate-analytics-snapshot/metricUtils.test.ts`
- `frontend/src/services/analyticsV2Service.js`
- `frontend/src/pages/AcademyOwnerAnalyticsV2.js`
- `frontend/src/pages/AcademyOwnerAnalyticsV2.css`

## Validation added

- Valid independent primary/comparison date ranges.
- Rejection of partial, impossible and reversed ranges.
- Rejection of ranges longer than five years.
- Unsupported status breakdown and exclusion from supported mark totals.

Automated Deno tests, Edge Function type-check and React production build have not yet been confirmed for this commit. The GitHub Actions workflow now includes `payment-module-finalization` in its push triggers.

## Safety boundary

All changes are application code and documentation only. No live database writes, schema migrations, RLS policy changes, Edge Function deployment, snapshot publication or paid Supabase branch creation occurred.
