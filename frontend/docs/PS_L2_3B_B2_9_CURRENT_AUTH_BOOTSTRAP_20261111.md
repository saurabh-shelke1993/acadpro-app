# Kheltriva — PS-L2.3B Phase B2.9: Current-State Authorization Bootstrap

**Checkpoint:** 11 November 2026 (Asia/Kolkata)  
**Source branch:** `payment-module-finalization`  
**Live Supabase project (SELECT only):** `ulyealhkmlorsbdiknrh`  
**Scope:** Reconstruct **current** private authorization helpers and validate them in an isolated PostgreSQL 17 test service. **No hosted DDL, production data changes, credential reset, migration repair, or billing action.**

## Summary

**B2.9 implemented and automatically tested.** The 11 foundational helpers missing from complete original historical migration provenance were recovered as **current live definitions**, and their exact source text was archived in a **disposable-only test SQL fixture**. It is not presented as historical source and cannot substitute for a complete Supabase Auth/RLS/finance replay.

## Verified source

Directly from live `pg_proc`, read-only:
- 11/11 names and signatures, `pg_get_functiondef` source text, `pg_get_userbyid(proowner)`, `prosecdef`, `provolatile`, `proconfig` and function ACLs.
- SHA-256 of all 11 `pg_get_functiondef` bodies independently agrees with `supabase/recovery/historical-baseline/helper-provenance-readonly-20261109.json`; all function sources reverified before committing.
- Functions are `postgres` owned, `SECURITY DEFINER`, `STABLE`, with explicit function search paths. They reference known `public.users`, `public.batches`, `public.coaches`, `public.coach_batches`, `public.coach_batch_assignments`, and `auth.uid()`.
- Seven functions currently grant EXECUTE to `PUBLIC`; four restrict EXECUTE to authenticated/owner. Although `anon` has effective function EXECUTE on seven, `anon` has **no USAGE** on `private` schema. Current schema `private` is owned by `postgres`, grants usage to `authenticated`, and not `anon` or `service_role`.
- `is_academy_owner()` and `is_coach()` depend on `current_user_role()`, therefore the test-only creation sequence places `current_user_role()` first.
- No personal user records, real player identifiers, fee data, passwords or original historical data reconciliation literals were copied into the fixtures.

## Implementation artifacts

| Source | Purpose |
|---|---|
| `supabase/tests/subscriptions/ps_l2_3_b2_9_live_helper_snapshot.sql` | 11 **current-live** helper definitions recovered from `pg_get_functiondef`, explicit schema and function EXECUTE grant parity; strongly labeled **disposable-only, not historical** |
| `supabase/tests/subscriptions/ps_l2_3_b2_9_live_helper_snapshot_manifest.json` | Original-definition SHA-256, exact signatures, owner, volatility, SECURITY DEFINER, search path, observed effective role EXECUTE, historical provenance flags |
| `supabase/tests/subscriptions/ps_l2_3_b2_9_synthetic_preconditions.sql` | PostgreSQL 17 disposable test-only fake `auth.uid()`, `anon/authenticated/service_role`, minimal public tables and invented identities/academies/coaches |
| `supabase/tests/subscriptions/ps_l2_3_b2_9_synthetic_assertions.sql` | Tests 11 helper existence, ownership, volatility, schema/function grants, logged-in role checks and positive/negative coaching access |
| `supabase/tests/subscriptions/test_b2_9_snapshot_integrity.py` | Five source SHA-256 / guardrail/metadata integrity unit tests |
| `.github/workflows/subscriptions-ps-l2-3-b2-9-auth-bootstrap.yml` | Dedicated PostgreSQL 17 service (no Supabase credentials) executes synthetic setup, 11-helper snapshot and role assertions |

### Validation

- GitHub Actions: **[42878988432](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42878988432) — PASS**.
- Five Python integrity tests: **PASS**.
- Database integration on disposable `postgres:17`: **PASS** — all 11 reconstructed helper functions compiled and executed, with checks for `postgres` owner, `SECURITY DEFINER`, `STABLE`, schema USAGE and seven `PUBLIC` EXECUTE memberships.
- Positive tests: Super Admin, Academy Owner, Coach helper predicates. Negative tests: role separation, unauthorized cross-academy coach/batch/center access, inactive coach assignment, missing JWT user ID.
- **Limitations:** `auth.uid()` in this test is a deliberate synthetic function using a session GUC, not actual Supabase Auth or JWT verification. These are function-level checks, not complete RLS policy evaluations.

## Remaining differences / stop conditions

1. **No historical provenance** exists for initial `CREATE SCHEMA private` and original 11 function definitions in the retained ledger. The snapshot is the **current-state** source, not a reconstructed original creation event.
2. The existing `ps_l2_3_local_private_baseline.sql` / `.github/workflows/subscriptions-ps-l2-3-supabase-local.yml` were **not modified**. They contain earlier partial CI-only bootstrap stubs. Do not blindly stack these fixtures or falsely claim the full Supabase replay is fixed.
3. The original 82-record migration history is not fully replayable: six same-version SQL differences (including two player-specific UUID selector differences), 51 unmatched remote records, and local duplicate version `20260926133000` remain to be resolved; original historical cleanup operations require quarantine.
4. The protected complete historical SQL archive on the user's laptop is still pending. The user elected to continue with connected Supabase read-only investigation without a PostgreSQL password reset.
5. Real local Supabase Auth, RLS, 42-function, triggers, grants and financial schema parity are **NOT YET TESTED**, and the PS-L2.3 subscription candidate remains **unapplied**.

## Phase state

| Phase | Status |
|---|---|
| B2.9 current live 11-helper source capture | **Implemented; hashes verified 11/11** |
| B2.9 synthetic PostgreSQL 17 bootstrap and role tests | **Passed** |
| B2.9 full historical helper provenance | **Unresolved** |
| B3 complete disposable Supabase migration reconstruction | **Blocked; not attempted in this phase** |
| B4 subscription proposal, real RLS and payment integration | **Not executed** |
| Production migration or subscription billing | **Unchanged** |

**Next proposed checkpoint:** B3.0 local Supabase replay readiness — inspect the real bootstrap point and existing test workflow; reconcile overlapping CI stubs, the initial schema mismatch and data-specific history **before** attempting an isolated Supabase replay. No production or applied-history changes.

## Later Owner authorization (11 November 2026)

The Product Owner authorized **test-only, nonhistorical** reuse of the verified 11 helper snapshot. A separate synthetic PostgreSQL 17 RLS workflow passed, with **5 baseline source tests, 6 new guard tests and actual synthetic policy checks**: [CI run 42971178667](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42971178667). It does not certify real Supabase JWTs, full Storage/financial parity or original migration replay. A Windows local read-only preflight is prepared but not yet run.
