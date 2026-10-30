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


## Phase C — Historical attendance denominator feasibility review (30 October 2026)

This was a read-only review of the live schema, current aggregate records, batch schedule editor behavior and attendance workflow. No database or application data was changed.

### Schema evidence

- `batch_schedules` stores `day_of_week`, `start_time`, `end_time`, `is_active`, `created_at` and `updated_at`. It has no effective-from/effective-to dates or schedule-version history.
- `Batches.js` updates an existing schedule row in place when a session is edited. Sessions removed from the editor are deactivated. This does not preserve the prior weekday/time definition for historical dates.
- `player_batch_schedules` has `enrolled_from` and nullable `enrolled_until`, which is a useful effective-dated enrollment shape. However, the current live audit found 16 rows, all active, with zero populated `enrolled_until` values. It cannot establish historical exit dates for current records.
- Legacy `player_batches` contains `assigned_date` but no end date or status/effective-period history. It is not sufficient by itself to reconstruct historical batch membership.
- `players.joining_date` is not a substitute for a batch/session enrollment period.
- The schedule table has an `is_active` flag, but no schedule validity dates. Current active state must not be projected backward over earlier reporting periods.

### Live aggregate observations

| Check | Read-only result |
|---|---:|
| Batch schedule rows | 29 |
| Currently active batch schedules | 26 |
| Currently inactive batch schedules | 3 |
| Player-to-schedule enrollment rows | 16 |
| Enrollment rows with `enrolled_until` | 0 |
| Inactive enrollment rows | 0 |
| Legacy player-batch assignments | 48 |
| Non-deleted attendance rows | 129 |
| Non-deleted attendance rows without `batch_schedule_id` | 109 |
| Non-deleted attendance linked to inactive schedule | 0 |
| Non-deleted attendance with orphaned schedule reference | 0 |

The 109 missing schedule references mean that attendance records cannot be safely attributed to a particular recurring session. The 20 rows that do have schedule IDs are not enough to establish complete expected-session coverage.

### Decision

**Do not implement or publish an expected-session attendance denominator from the current tables.** The existing attendance metric remains a recorded-mark metric only:
- supported present/absent marks may be counted;
- the percentage is explicitly the rate among recorded supported marks, not attendance coverage against expected sessions;
- quality remains partial while expected-session coverage is unproven;
- missing schedule references and unsupported statuses remain diagnostics;
- no rows or no supported statuses remain unavailable rather than zero.

A valid future denominator requires durable history for both sides of eligibility:
1. versioned/effective-dated batch schedules (including when a schedule is replaced or stopped); and
2. effective-dated player-to-session enrollment with reliable start and end dates.

It also needs a definition of whether an expected recurring session counts when it was cancelled, the center was closed, or training was not held. The current schema does not record actual session occurrence/cancellation, so a timetable alone would still represent planned sessions, not necessarily sessions held.

### Safe next design step

Keep Phase C attendance coverage explicitly unavailable. Treat any schema redesign for schedule history, enrollment history and actual session occurrence as a separately reviewed data-model change; do not retrofit a denominator by guessing historical values. No migration is proposed or applied in this checkpoint.
