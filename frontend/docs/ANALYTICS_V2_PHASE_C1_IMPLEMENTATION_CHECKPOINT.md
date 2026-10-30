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

## Validation evidence and limitations
- The current Deno test source contains **21 test cases**: 12 metric/attendance cases, 4 request/query-scope cases and 5 ownership-validation cases.
- Native Deno is unavailable in the current development environment. The newly added tests have **not** been executed here; no native Deno result is claimed.
- Earlier Node.js 22-compatible helper validation (17/17) predates the new request/scope tests and does not cover them.
- No isolated Supabase ownership tests, Edge Function integration tests, RLS tests, browser tests or deployment checks have been completed.
- Production Supabase has not been modified. No migrations, writes, repairs or deployments were performed.

## Next checkpoint
1. Execute all 11 tests with native Deno and run Deno type checking.
2. Execute the SQL fixture and Edge Function integration checks in a disposable Supabase database when one is available.
3. Review the new attendance zero-state and source-quality behavior, then continue Phase D historical-integrity and snapshot-publisher review.
4. Continue Phase D historical-integrity and snapshot-publisher review.

Phase C remains **In progress**. Phase D remains **Not started**. Phase E integration remains **Not started**.
