# Kheltriva — PS-L2.3 Actual Local Supabase Migration-Replay Gate

**Date:** 6 November 2026 (Asia/Kolkata)  
**Branch:** `payment-module-finalization`  
**Last local-validation source:** `6b2fc829e215fb5f7b3a9fb6522e7f35c407f78f`  
**Status:** **BLOCKED — historical Supabase migration chain is not self-contained.** The earlier **synthetic PostgreSQL 17 candidate SQL validation PASSED**; do not confuse it with a full local Supabase/staging integration PASS. No hosted migrations, credentials, data writes, RPCs, billing or scheduler activation.

## 1. Scope and actual work

The user requested continuation of PS-L2.3 toward isolated Supabase Auth/RLS/payment interoperability. A new CI-only workflow `.github/workflows/subscriptions-ps-l2-3-supabase-local.yml` installs **pinned Supabase CLI v3.0.0** and attempts `supabase db start` against the repository's current migration directory and a **disposable, unlinked** local database. Its objective is to apply the existing `supabase/proposals/subscriptions/ps_l2_3_foundation.sql` to a real Supabase-initialized DB, then run `supabase/tests/subscriptions/ps_l2_3_supabase_parity.test.sql` against the actual migrated finance and auth dependencies.

- **New** `supabase/tests/subscriptions/ps_l2_3_supabase_parity.test.sql`: initial schema/grants/RLS/legacy-HOLD assertions; only runs if migration replay and proposal apply succeed.
- **New** `supabase/tests/subscriptions/ps_l2_3_local_private_baseline.sql`: a **CI-only** limited reconstruction of known live private helper signatures and body definitions using read-only metadata. It is copied into `supabase/migrations/` **only inside ephemeral GitHub checkout** and is **not committed under the active migration folder**. It is not authoritative evidence of the original historical baseline.
- No modifications to existing `supabase/migrations/` tracked production files, `frontend/src/`, payment data, Supabase RLS, project roles or current production deployment.
- The other Supabase hosted project visible in account metadata is **inactive**; we did **not** use or mutate it as an assumed test project.

## 2. Three CI attempts and verified failure sequence

| CI run (GitHub Actions) | Last reached step | Verified blocker | Classification |
|---|---|---|---|
| [42203770759](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42203770759) | Local `supabase db start` | Existing `20260925063432_allow_multiple_active_coaches_per_batch.sql` uses `private.current_parent_id()` before `private` schema exists in a clean migration replay | **Existing missing baseline** |
| [42204432173](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42204432173) | CI-only helper bootstrap | Base `20260823093317_remote_schema.sql` predates `parents.user_id`, which the current live `private.current_parent_id()` helper references. Early body verification fails; local-only `check_function_bodies` deferral introduced | **Historical ordering/schema drift** |
| [42204705752](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42204705752) | Existing financial foundation `20260926123000_payment_financial_foundation_apply.sql` | `private.is_payment_player_in_current_academy(uuid)` is referenced by its payment-correction SELECT policy but is missing from the tracked replay baseline | **Additional missing authorization dependency** |

Both `private.current_parent_id()` and `private.is_payment_player_in_current_academy(uuid)` were **verified to exist** on the hosted active Supabase database using **read-only system catalog SELECT**. The GitHub replay never got as far as executing the proposed PS-L2.3 SQL; therefore **no actual Supabase Auth/RLS/financial-trigger interoperability result is available yet**.

**We stopped after these failures rather than adding more one-by-one stubs.** The initial repository schema snapshot/migrations appear incomplete for fresh local recreation. It is not appropriate to treat a manually patched bootstrap as a verified replica of live access controls. Do not "solve" this by executing missing helper/migration fixes directly on production.

## 3. State kept safe

- Previous [synthetic PostgreSQL 17 candidate CI 42195789707](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42195789707) at `5afae2a` remains **PASS**: proposed unique period/due keys, GiST cross-agreement exclusion, synthetic scopes and legacy HOLD validated.
- New local Supabase workflow is **FAILING/BLOCKED** before proposed schema installation. This is not a PS-L2.3 candidate SQL regression; it is a **migration-history reconstruction prerequisite**.
- All PS-L2.3 SQL remains under `supabase/proposals/`, **not** `supabase/migrations/`. Nothing new deployed. No Parent/Coach/SA permissions or finance triggers changed.
- Latest prior live read-only data snapshot was 22 subscription agreements, 26 dues and 42 payment records, with 0 PS-L2.3 live tables and 0 period-due columns. No write statement was issued to a hosted Supabase project during this work.
- Annual/billing model rules and per-camp free/included/separately-chargeable owner-approved policy remain intact and unaffected.

## 4. Controlled next task — PS-L2.3B migration-baseline recovery

**Preconditions:** Review live `pg_proc`, `pg_policies`, constraints, schema helper grants and existing migration history **SELECT-only**; inventory all missing `private` helper definitions and identify their point of first use in tracked migrations, not merely the three observed failures. Compare live Auth, role helper and payment-trigger semantics with committed source, redacting credentials and user financial details.

**Implementation plan (staging only):**
1. Build a **complete and auditable baseline** (source-controlled fixture/scripts) for a fresh disposable local Supabase instance. Preserve correct dependency order after initial schema and versioned future changes, without silently overwriting existing production functions.
2. Re-run `supabase db start` until the **entire** original migration sequence replays from scratch without fallback stubs or undocumented prerequisites. Verify migration list/schema equality to a reference read-only snapshot. Historical migration corrections require a separately reviewed approach; never rewrite applied production migration history.
3. Then install the **unapplied** PS-L2.3 schema proposal in local Supabase and execute real role-scoped negative tests (SA, Owner A/B, Coach, Parent, anon), financial-state trigger and existing receipt/correction/Parent UPI regression.
4. Test concurrent cross-agreement tuition attempts, idempotent retries and due-insert rollback once secure write RPCs exist in a separately authorized implementation phase. Stage the foreign-key / grant hardening migration separately.
5. Review the candidate and regression results with the Product Owner. **Any live DDL still requires separate explicit approval**; no live schema change is authorized by this PS-L2.3B work.

**Stop condition:** Do not declare PS-L2.3 staging parity or production migration readiness until a self-contained baseline replay and actual role/finance checks are **green**. The current failing GitHub Actions workflow is an explicit unresolved gate.

## 5. Phase status

| Item | State |
|---|---|
| PS-L2.3 proposed foundation SQL | Implemented as repo candidate, **unapplied** |
| Synthetic Postgres schema / role fixture | **PASS** |
| Actual Supabase migrations replay from clean state | **BLOCKED** (missing historic authorization definitions) |
| PS-L2.3 schema against actual local Supabase | **NOT EXECUTED** |
| Actual Supabase Auth/RLS/payment trigger acceptance | **NOT TESTED** |
| Hosted Supabase schema and financial state | **UNCHANGED** |
| PS-L2.3B baseline recovery / full parity | **NEXT**, separately scoped |
| Manual Owner UI acceptance | Not applicable to current schema-only source change |

**Recommendation:** Treat the migration-baseline recovery as a prerequisite security/CI workstream, not as permission to activate billing or change production schema.
