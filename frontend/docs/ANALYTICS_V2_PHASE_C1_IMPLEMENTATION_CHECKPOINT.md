# Analytics V2 — Phase C1 Implementation Checkpoint

**Branch:** `analytics-v2-phase-c-validation`  
**Checkpoint date:** 2026-10-30  
**Status:** In progress

## Implemented
The preview calculator now includes:
- `metricUtils.ts` — pure date, numeric, payment-flow, cohort and reconciliation helpers.
- `metricUtils.test.ts` — metric tests plus request-validation and scope-predicate tests.
- `requestUtils.ts` — pure request validation and reusable academy-first query-scope helpers.
- `index.ts` — read-only Edge Function preview entrypoint; no snapshot publication or database writes.
- `README.md` — behavior, validation boundaries and remaining work.

## Request and scope protections
- Rejects non-object bodies, malformed UUIDs, unsupported scope types and invalid/non-first-day calendar months.
- Rejects academy scope requests whose `scopeId` differs from `academyId`.
- Attendance query predicates are composed academy-first, then center or batch.
- Player finance predicates are composed academy-first, then center when applicable.
- Database-backed ownership validation for centers and batches remains in `validateScope`; pure unit tests do not prove cross-academy ownership.

## Validation evidence and limitations
- The current Deno test source contains **11 test cases**: 7 metric cases and 4 request/scope cases.
- Native Deno is unavailable in the current development environment. The newly added tests have **not** been executed here; no native Deno result is claimed.
- Earlier Node.js 22-compatible helper validation (17/17) predates the new request/scope tests and does not cover them.
- No isolated Supabase ownership tests, Edge Function integration tests, RLS tests, browser tests or deployment checks have been completed.
- Production Supabase has not been modified. No migrations, writes, repairs or deployments were performed.

## Next checkpoint
1. Execute all 11 tests with native Deno and run Deno type checking.
2. Add isolated database-backed cross-academy scope tests.
3. Resolve attendance source-coverage and zero-state quality propagation.
4. Continue Phase D historical-integrity and snapshot-publisher review.

Phase C remains **In progress**. Phase D remains **Not started**. Phase E integration remains **Not started**.
