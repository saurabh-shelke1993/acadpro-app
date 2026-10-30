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
- Due-ledger reconciliation excludes unclassified rows from recognized ledger totals and marks affected dues incomplete. It is a current-state diagnostic, not historical month-end reconciliation.
- Gross payments and signed adjustments remain separate; net is their sum.
- Reporting periods are half-open: start inclusive, end exclusive, using Asia/Kolkata (+05:30).

## Validation status
- The current Deno test source contains **11 test cases** (7 metric cases and 4 request/scope cases).
- Native Deno is not installed in the current development environment. No native `deno test` run is claimed for this checkpoint.
- The previously recorded 17/17 Node-compatible helper run applies to the earlier metric-helper validation set; it does not include the new request/scope tests.
- No claim is made for Edge Function integration, cross-academy database ownership, RLS, browser, deployment or production validation.
- Production Supabase has not been modified.

## Next work
1. Run native Deno tests and TypeScript checks in a Deno-enabled environment.
2. Add isolated Supabase integration tests for center/batch ownership rejection and academy/center/batch query isolation.
3. Resolve metric quality propagation for attendance zero-state and incomplete source coverage.
4. Review snapshot historical-integrity and publisher design before any deployment.

Do not deploy or publish snapshots until Phase C and Phase D acceptance criteria are met and explicitly approved.
