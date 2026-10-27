# Analytics V2 — Phase C1 Validation Record

**Date:** 27 October 2026  
**Status:** Initial inspection complete; metric-contract validation remains in progress.  
**Working branch:** `analytics-v2-phase-c-validation`  
**Base branch:** `payment-module-finalization`  
**Production database changes:** None. All Supabase queries for this record were read-only.

## Scope of this checkpoint

Recover and inspect the exact R1.6 metric-calculator draft before changing application code. Validate the existing deterministic helper tests, inspect the current database schema and record aggregate source-data findings. This checkpoint does not integrate the calculator into the React Analytics page and does not deploy an Edge Function.

## Draft artifacts recovered

The current validation-update archive contains:

- `index.ts`
- `metricUtils.ts`
- `metricUtils.test.ts`
- `README.md`

The earlier R1.6 draft archive contains an earlier version under `supabase/functions/generate-analytics-snapshot/`. The validation-update version adds due-to-ledger reconciliation diagnostics and unknown payment-entry-type counting. The updated archive remains a local/library artifact at this checkpoint; it has not been deployed.

## Executed local checks

| Check | Result | Boundary |
|---|---|---|
| R1.6 helper test file | 11/11 passed | Executed under Node.js 22 with a temporary Deno.test-compatible harness; this is not native Deno validation |
| TypeScript no-emit check for `metricUtils.ts` | Passed | Helper file only |
| Native Deno test run | Not run | Deno is not installed in the available execution environment |
| Edge Function integration | Not run | No function was deployed or invoked |
| Browser/UI QA | Not run | Phase E/F |
| Snapshot publisher/RLS/concurrency | Not run | Requires an isolated database and belongs to later validation gates |

## Read-only live-schema audit

Project inspected: `acadpro-db` (`ulyealhkmlorsbdiknrh`). No writes, migrations, repairs or deployments were performed.

Current aggregate row counts returned by the read-only audit:

| Table | Rows |
|---|---:|
| `academies` | 5 |
| `players` | 49 |
| `attendance` | 138 |
| `payments` | 42 |
| `payment_dues` | 26 |
| `expenses` | 2 |

Additional observations:

- `payments`: 41 `payment` entries total ₹17,350.00; one `adjustment` entry totals -₹50.00. The audit found no null `payment_date`, `player_id` or `due_id` values, no unclassified entry types, and no negative `payment`-type amounts.
- `attendance`: 118 of 138 rows have no `batch_schedule_id`. Expected-session coverage must remain unavailable until schedule/eligibility semantics and data completeness are established.
- Current due-to-ledger aggregate comparison found 11 dues whose recorded `paid_amount` differs from the sum of linked ledger entries, 10 dues with positive recorded paid amounts but no linked ledger row, and one due where linked ledger total exceeds recorded paid amount. These are diagnostic counts, not permission to repair records. Categories may overlap.

## Findings requiring follow-up before accepting R1.6

1. **Malformed cohort amounts:** `calculateCohortCollection` currently uses `Number(value ?? 0)`. A malformed non-empty numeric string can propagate `NaN` rather than producing an explicit invalid-data result. Add deterministic tests and fix the helper.
2. **Reconciliation quality:** The calculator currently marks reconciliation quality using malformed-amount and mismatch counts. Ensure unknown payment-entry types also prevent a fully verified reconciliation result when they are relevant to a due.
3. **Attendance zero state:** The current implementation returns a null attendance rate for a zero denominator, but its quality state and zero present/absent counts must not imply complete source coverage when no records exist.
4. **Scope isolation:** Validate that center/batch attendance queries cannot include inconsistent rows carrying another `academy_id`. Continue validating the scope ID against its academy before querying.
5. **Historical finance:** Keep historical outstanding unavailable; current `payment_dues.remaining_amount` is not a month-end snapshot.
6. **Cohort billing:** The cohort rate remains partial because `payment_dues.total_amount` is not versioned as an immutable original billed amount.
7. **Runtime validation:** Run the supported native Deno test suite and Edge Function type/runtime checks before treating the calculator as validated.

## Safety boundary

Do not apply `kheltriva_analytics_isolated_test_migration.sql` to production. The snapshot schema/publisher remains a draft for a disposable Supabase development branch. Do not deploy or schedule the preview function. Do not correct live payment or due records as part of Analytics validation.

## Next checkpoint

Implement the smallest isolated R1.6 helper fixes and regression tests on this branch. Then run native Deno validation in the intended environment. Scope isolation and snapshot/historical integrity remain Phase D; React integration remains Phase E; final release validation remains Phase F.
