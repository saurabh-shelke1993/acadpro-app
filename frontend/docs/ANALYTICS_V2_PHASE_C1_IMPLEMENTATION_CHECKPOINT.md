# Analytics V2 — Phase C1 Implementation Checkpoint

**Branch:** `analytics-v2-phase-c-validation`  
**Checkpoint date:** 2026-10-30  
**Status:** In progress

## Implemented
The preview calculator now includes:
- `metricUtils.ts` — pure date, numeric, payment-flow, cohort, reconciliation and attendance-quality helpers.
- `metricUtils.test.ts` — metric tests plus request-validation and scope-predicate tests.
- `requestUtils.ts` — pure request validation and reusable academy-first query-scope helpers.
- `scopeValidation.ts` — testable academy/center/batch ownership validation used by the Edge Function.
- `scope_isolation.integration.test.sql` — rollback-only disposable-database fixture for two-academy ownership checks.
- `index.ts` — read-only Edge Function preview entrypoint; no snapshot publication or database writes.
- `README.md` — behavior, validation boundaries and remaining work.

## Request and scope protections
- Rejects non-object bodies, malformed UUIDs, unsupported scope types and invalid/non-first-day calendar months.
- Rejects academy scope requests whose `scopeId` differs from `academyId`.
- Attendance query predicates are composed academy-first, then center or batch.
- Player finance predicates are composed academy-first, then center when applicable.
- Database-backed ownership validation for centers and batches remains in `validateScope`; pure unit tests do not prove cross-academy ownership.

## Scope-isolation coverage
- Pure ownership tests cover valid academy/center/batch scopes, cross-academy center, cross-academy batch, cross-academy batch-center mismatch, and missing/mismatched academy.
- The SQL fixture seeds two academies, two centers and three batches inside a transaction and rolls back. It is designed for a disposable database only.
- The SQL fixture has **not** been run because no isolated Supabase branch/database is available. The live production database was not used for fixtures.

- Attendance quality returns null/unavailable for empty sources and sources with no supported marks; recorded counts/rates remain partial until expected-session coverage can be measured. Unsupported statuses and missing schedule IDs are surfaced separately.

## Attendance denominator feasibility
- Read-only schema review confirms `batch_schedules` has no effective dates/version history; the existing batch editor updates schedule rows in place and deactivates removed rows.
- `player_batch_schedules` includes `enrolled_from`/`enrolled_until`, but all 16 current rows are active and none has an `enrolled_until` value. Legacy `player_batches` has `assigned_date` only.
- Current live aggregates: 29 batch schedule rows (26 active), 16 player-schedule enrollment rows, 48 legacy player-batch assignments, 129 non-deleted attendance rows; 109 of those attendance rows have no `batch_schedule_id`.
- Therefore expected-session attendance coverage is not safely computable. Keep the recorded-mark rate partial; do not infer historic schedule or enrollment state. A future denominator also needs actual session occurrence/cancellation semantics.

## Validation evidence and limitations
- The current Deno test source contains **21 test cases**: 12 metric/attendance cases, 4 request/query-scope cases and 5 ownership-validation cases.
- Native Deno validation now runs through branch-scoped GitHub Actions (Deno 2.9.8): **21 passed, 0 failed**. The preview Edge Function also passes `deno check`.
- Earlier Node.js 22-compatible helper validation (17/17) predates the new request/scope tests and does not cover them.
- No isolated Supabase ownership tests, live Edge Function integration tests, RLS tests, browser tests or deployment checks have been completed. Static Edge Function type-check passed.
- Production Supabase has not been modified. No migrations, writes, repairs or deployments were performed.

## Native validation result
- GitHub Actions workflow: `.github/workflows/analytics-deno-validation.yml`.
- Deno 2.9.8 test run: **21 passed, 0 failed**.
- `deno check supabase/functions/generate-analytics-snapshot/index.ts`: **passed**.
- Workflow run: https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/40984835967.
- The run uncovered and corrected a malformed newline in the test file, duplicate legacy Edge Function source, an undefined attendance query helper and two TypeScript typing issues.

## Next checkpoint
1. Continue with isolated database-backed ownership validation when a disposable Supabase environment is available.
2. Execute the SQL fixture and live Edge Function integration checks in a disposable Supabase database when one is available.
3. Keep expected-session attendance coverage unavailable: current schedules are mutable and not effective-dated; current player-schedule enrollments have no populated end dates; 109 of 129 non-deleted attendance rows lack a schedule reference.
4. Define a separately reviewed historical model for schedule versions, player-session eligibility and actual session occurrence/cancellation before attempting an expected-session denominator.

Phase C remains **In progress**. Phase D remains **Not started**. Phase E integration remains **Not started**.
