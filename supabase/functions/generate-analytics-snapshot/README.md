# Kheltriva Analytics R1.6 — Preview Calculator

## Status
The pure metric helpers, request/scope helpers, deterministic unit tests and preview-only Edge Function entrypoint are committed for review. The function performs read-only calculations and does not publish snapshots. No database writes or snapshot publication are performed.

## Files
- `metricUtils.ts`: Asia/Kolkata calendar-month bounds, half-open filtering, numeric aggregation, payment/adjustment flow splitting, due-ledger reconciliation and cohort collection.
- `requestUtils.ts`: pure parsed-request validation plus reusable academy-first attendance and player query-scope predicates.
- `metricUtils.test.ts`: Deno tests covering metric calculations, request validation and query predicate ordering.

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
- `scope_isolation.integration.test.sql` is a disposable-database-only transaction fixture. It creates two test academies, centers and batches, checks the ownership predicates against Postgres rows, then rolls back. It has not been run and must never be executed against production.

## Validation status
- The current Deno test source contains **21 test cases** (12 metric/attendance cases, 4 request/query-scope cases and 5 ownership-validation cases).
- Native Deno is not installed in the current development environment. No native `deno test` run is claimed for this checkpoint.
- The previously recorded 17/17 Node-compatible helper run applies to the earlier metric-helper validation set; it does not include the new request/scope tests.
- No claim is made for Edge Function integration, cross-academy database ownership, RLS, browser, deployment or production validation.
- Production Supabase has not been modified.

## Next work
1. Run all 16 Deno tests and TypeScript checks in a Deno-enabled environment.
2. Execute the SQL fixture and Edge Function integration checks only in a disposable Supabase database.
3. Resolve metric quality propagation for attendance zero-state and incomplete source coverage.
4. Review snapshot historical-integrity and publisher design before any deployment.

Do not deploy or publish snapshots until Phase C and Phase D acceptance criteria are met and explicitly approved.
