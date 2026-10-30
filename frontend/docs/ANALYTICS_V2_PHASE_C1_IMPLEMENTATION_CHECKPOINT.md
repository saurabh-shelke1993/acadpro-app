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
- The SQL fixture is now wired to a disposable PostgreSQL 17 service in GitHub Actions. It runs against a fresh CI-only database with a minimal schema contract, not the live Supabase schema; this validates SQL execution and the ownership predicates but does not prove Supabase RLS or production-schema compatibility. Production is never used.

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

## Zero-cost database fixture validation

- The branch workflow now includes a separate GitHub Actions job backed by an ephemeral PostgreSQL 17 service container.
- Each workflow run creates a fresh CI-only database and the minimum academy/center/batch table contract needed by the rollback-only SQL fixture.
- The fixture is executed with `psql -v ON_ERROR_STOP=1`; the transaction rolls back its inserted rows.
- This is a zero-additional-hosted-Supabase-cost test. It validates SQL syntax, fixture inserts and ownership predicate assertions against PostgreSQL rows.
- It does **not** prove compatibility with the full live Supabase schema, Supabase RLS behavior, Edge Function deployment/authentication, or production data.
- No Supabase development branch or production database is used.

## Next checkpoint
1. Confirm the new PostgreSQL CI job passes alongside the existing 21 Deno tests and Edge Function type-check.
2. Review the Edge Function authorization boundary and define a safe server-side caller before React integration; never expose the service-role key in the browser.
3. Keep expected-session attendance coverage unavailable: current schedules are mutable and not effective-dated; current player-schedule enrollments have no populated end dates; 109 of 129 non-deleted attendance rows lack a schedule reference.
4. Proceed to Academy Owner Analytics UI integration once metric and authorization acceptance criteria are documented.

Phase C remains **In progress** pending the new CI result and final contract review. Phase D remains **Not started**. Phase E integration remains **Not started**.


## Phase D pre-integration authorization review

A source review of `supabase/functions/generate-analytics-snapshot/index.ts` confirms:
- The function creates its Supabase client with `SUPABASE_SERVICE_ROLE_KEY` held in Edge Function environment variables.
- The request handler accepts only an exact `Authorization: Bearer <service-role-key>` match.
- It does not authenticate an end-user JWT, resolve an authenticated user, or independently verify the caller's application role.
- This is a trusted-server-only preview endpoint in its current form. It must not be called directly from React, and the service-role key must never be placed in frontend environment variables or browser requests.
- No deployment has occurred.

**Integration blocker:** before Phase E, design and review a secure server-to-server invocation model or an authenticated-user model that verifies the caller's role and tenant scope. Confirm the Supabase Edge Function gateway JWT configuration as part of that review. Do not weaken the current gate or expose the service-role key as a shortcut.
