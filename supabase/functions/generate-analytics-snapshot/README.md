# Kheltriva Analytics R1.6 — Preview Calculator

## Status
The pure metric helpers, request/scope helpers, deterministic unit tests and preview-only Edge Function entrypoint are committed for review. The function performs read-only calculations and does not publish snapshots. No database writes or snapshot publication are performed.

## Files
- `metricUtils.ts`: Asia/Kolkata calendar-month bounds, half-open filtering, numeric aggregation, payment/adjustment flow splitting, due-ledger reconciliation and cohort collection.
- `requestUtils.ts`: pure parsed-request validation plus reusable academy-first attendance and player query-scope predicates.
- `metricUtils.test.ts`: 21 Deno tests covering metric calculations, request validation and query predicate ordering.
- `authorizationUtils.ts` / `authorizationUtils.test.ts`: pure Academy Owner identity, role and tenant-scope guard plus 8 deterministic tests.

## Scope and security boundaries
- Parsed JSON is validated for object shape, UUIDs, allowed scope type and a real first-of-month calendar date.
- An academy-level request must use the same UUID for `academyId` and `scopeId`.
- Attendance queries always add `academy_id` before optional `center_id` or `batch_id` predicates.
- Player finance queries always add `academy_id`, plus `center_id` for center scope.
- These pure tests verify request parsing and query predicate construction only. They do **not** prove that referenced centers/batches belong to an academy; that is checked by database-backed `validateScope` in the Edge Function and still needs isolated integration tests.

## Data-quality behavior
- Malformed or whitespace-only numeric values are rejected by `sum`.
- A cohort containing malformed amounts or unclassified linked payment-entry types returns null monetary metrics with `quality: "unavailable"`.
- Attendance counts, rates and diagnostic counts are unavailable (null) when no rows exist; empty source data is never presented as numeric zero.
- When rows exist but none has a supported present/absent status, attendance totals and rate are null/unavailable; unsupported statuses and missing schedule IDs remain visible as partial-quality diagnostics.
- When supported marks exist, counts and the recorded-mark rate are partial because expected-session coverage is not established. Unsupported statuses and missing schedule IDs are surfaced separately and excluded from the rate.
- An all-absent set of supported marks correctly yields a 0% recorded-mark rate; this is not a claim of expected-session coverage.
- Due-ledger reconciliation excludes unclassified rows from recognized ledger totals and marks affected dues incomplete. It is a current-state diagnostic, not historical month-end reconciliation.
- Gross payments and signed adjustments remain separate; net is their sum.
- Reporting periods are half-open: start inclusive, end exclusive, using Asia/Kolkata (+05:30).

## Scope ownership validation
- `scopeValidation.ts` isolates academy/center/batch ownership decisions behind a lookup adapter. The Edge Function supplies real Supabase lookups; deterministic unit tests use fixture records.
- Unit tests cover valid scopes, cross-academy center and batch rejection, cross-academy batch-center mismatch, and missing/mismatched academy scope.
- `scope_isolation.integration.test.sql` is a disposable-database-only transaction fixture. It creates two test academies, centers and batches, checks the ownership predicates against Postgres rows, then rolls back. GitHub Actions now runs it against an ephemeral PostgreSQL 17 service with a minimal table contract. This does not validate Supabase RLS or full production-schema compatibility; it must never be executed against production.

## Historical attendance denominator limitation
- `batch_schedules` has no effective dates/version history, and the batch editor updates schedule rows in place or deactivates removed rows.
- `player_batch_schedules` has enrollment date columns, but current live rows have no populated `enrolled_until` values; legacy `player_batches` has no end date.
- A live read-only audit found 109 of 129 non-deleted attendance rows without `batch_schedule_id`.
- Expected-session coverage is therefore not computable from current data. The reported rate is only among recorded supported marks and remains partial. A real denominator also requires actual session occurrence/cancellation semantics.

## Native validation result
- Branch-scoped workflow: `.github/workflows/analytics-deno-validation.yml`.
- Deno test result: **21 passed, 0 failed**; `deno check` for `index.ts`: **passed**.
- Run details: https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/40984835967.

## Validation status
- The Deno suite contains **29 test cases**: 21 metric/request/ownership cases plus 6 authorization guard cases.
- Native Deno validation via GitHub Actions (Deno 2.9.8): **29 passed, 0 failed**. The preview Edge Function also passes `deno check`.
- The previously recorded 17/17 Node-compatible helper run applies to the earlier metric-helper validation set; it does not include the new request/scope tests.
- Static Edge Function type-check passed. No claim is made for live Edge Function integration, cross-academy database ownership, RLS, browser, deployment or production validation.
- Production Supabase has not been modified.

## Next work
1. Verify the new ephemeral PostgreSQL CI job passes alongside Deno tests and Edge Function type-check.
2. Implement and validate authenticated Academy Owner authorization before React integration. Never expose the service-role key in the browser.
3. Keep expected-session attendance coverage unavailable until historical schedule versions, player-session eligibility periods and actual session occurrence/cancellation are represented.
4. Review snapshot historical-integrity and publisher design before any deployment.

Do not deploy or publish snapshots until Phase C and Phase D acceptance criteria are met and explicitly approved.


## Authenticated frontend integration boundary

The preview endpoint now accepts a signed-in user's Supabase access token:
- The Edge Function gateway JWT check is explicitly enabled in `supabase/config.toml` (`verify_jwt = true`).
- The handler independently calls Supabase Auth `getUser(accessToken)` to verify the caller identity.
- It resolves `id`, `role` and `academy_id` from the trusted `public.users` profile using the server-side service-role client. It does not use editable `user_metadata` or client-supplied role/academy claims.
- Current V2 preview authorization is intentionally restricted to `academy_owner`. Super Admin, Coach and Parent requests are denied by this endpoint; existing Analytics routes remain unchanged.
- The requested academy scope must exactly match the academy assigned to the authenticated profile. Center and batch scopes are then checked against live academy ownership by `validateScopeOwnership`.
- All source queries continue to use the server-side service-role client, so tenant isolation is enforced explicitly by the authenticated profile check, the academy equality check, ownership validation and academy-first query predicates. Do not add a source query without an academy-constrained path.
- The service-role key remains server-side only. The browser sends its user session JWT through `supabase.functions.invoke`; it must never send the service-role key.
- CORS preflight is handled for browser invocation.

The pure authorization guard is covered by `authorizationUtils.test.ts`. These tests verify role, identity and academy-scope decisions; they do not replace live Auth/JWT, RLS or deployed Edge Function integration tests.

The function has **not** been deployed. Phase E may integrate the Academy Owner UI only after CI passes and the user explicitly approves any deployment.


## Phase D1 CI result

Workflow run #18 completed successfully:
- 29 Deno tests passed.
- Edge Function `deno check` passed.
- Disposable PostgreSQL 17 scope-isolation fixture passed.

See [Phase D1 authorization review](../../frontend/docs/ANALYTICS_V2_PHASE_D1_AUTHORIZATION.md) for the authenticated Academy Owner boundary and remaining deployment/integration gates.

## R2.1 — Attendance date-range data contract

- Attendance uses the actual stored `attendance_date` and stored status values from non-deleted `public.attendance` rows.
- Only exact `present` and `absent` values contribute to the supported mark totals and recorded-mark rate.
- Every other status, including null/blank status, is excluded from those totals and counted in `ignoredStatusCount`. The response also includes `unsupportedStatusBreakdown`, grouped by normalized stored status (with missing values shown as `(missing status)`).
- Missing `batch_schedule_id` is reported independently. It does not cause a valid present/absent mark to be discarded.
- Manual attendance comparison accepts `attendanceStartDate` + `attendanceEndDate` and optional `comparisonStartDate` + `comparisonEndDate`, each inclusive and validated as real calendar dates. Each range is limited to five years.
- Academy, center and batch predicates remain academy-first. The manual date range cannot widen the caller's authorized tenant scope.
- When no manual attendance range is supplied, the API retains the existing selected-month attendance behavior. Finance continues to use `snapshotMonth` and is unchanged by attendance date filters.
- Comparison ranges are independent and may have different lengths. The response reports both periods; it does not normalize per-day rates or imply expected-session coverage.
- Empty ranges and ranges containing no supported marks remain unavailable rather than verified zero. Mark quality remains partial because expected-session coverage cannot be reconstructed.
- This is a read-only preview contract. It does not add schema, write attendance data, publish snapshots or deploy the Edge Function.
