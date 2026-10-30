# Kheltriva Analytics R1.6 — Metric Helpers

## Status
The pure metric helper module, deterministic tests and preview-only Edge Function entrypoint are committed for review. The function performs read-only calculations and does not publish snapshots. No database writes or snapshot publication are performed by these helpers.

## Files
- `metricUtils.ts`: Asia/Kolkata calendar-month bounds, half-open date/time filtering, numeric aggregation, payment/adjustment flow splitting, current due-ledger reconciliation and cohort collection.
- `metricUtils.test.ts`: Deno tests for month rollover, leap year, IST midnight boundaries, numeric validation, payment-versus-adjustment attribution, cohort cutoff and unknown payment-entry types.

## Data-quality behavior
- Malformed or whitespace-only numeric values are rejected by `sum`.
- A cohort containing malformed amounts or unclassified linked payment-entry types returns null monetary metrics with `quality: "unavailable"`; it does not emit NaN or silently convert bad data to zero.
- Due-ledger reconciliation excludes unclassified rows from recognized ledger totals and marks affected dues as incomplete. The diagnostic is current-state only, not historical month-end reconciliation.
- Gross payments and signed adjustments remain separate; net is their sum.
- Reporting periods are half-open: start inclusive, end exclusive, using Asia/Kolkata (+05:30).

## Validation performed
The helper tests were run in the current development environment using Node.js 22's experimental TypeScript type stripping and a small Deno.test-compatible test harness because Deno is not installed in the environment. Result: 17/17 tests passed. A TypeScript no-emit check of `metricUtils.ts` also passed.

This is not a native Deno run, a deployed Edge Function integration test, an RLS test, a browser test or production validation. The current test file contains seven Deno test cases; prior helper-level test counts should not be interpreted as seven or more current Deno cases.

## Next work
1. Integrate the reviewed helper module into the trusted Edge Function entrypoint.
2. Test academy, center and batch scope isolation and cross-academy identifier rejection.
3. Resolve quality propagation for attendance zero-state and incomplete source coverage.
4. Complete isolated Edge Function tests before any deployment consideration.

Do not deploy this draft or publish snapshots until Phase C and Phase D acceptance criteria are met and explicitly approved.
