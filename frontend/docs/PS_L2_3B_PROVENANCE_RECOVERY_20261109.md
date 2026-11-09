# Kheltriva — PS-L2.3B historical migration recovery (B2.2–B2.3)

**Date:** 2026-11-09 (Asia/Kolkata)  
**Branch:** `payment-module-finalization`  
**Active Supabase project:** `ulyealhkmlorsbdiknrh`  
**Mode:** source tooling + metadata-only live SELECT. **No hosted DDL or business writes.**

## Objective

Restore an independently replayable **disposable Supabase** baseline before local validation of the unapplied `supabase/proposals/subscriptions/ps_l2_3_foundation.sql`. Do not activate renewal, create payment dues, or alter existing migrated production state.

## Evidence and implementation

- Remote `supabase_migrations.schema_migrations` has **82** entries; all 82 retain SQL statement arrays (168 elements total). Local branch has **40** migration files, **23** exact version-ID matches, **59** remote-only version IDs, **17** local-only files and a duplicate local version `20260926133000`.
- Version matching **is not SQL-content equivalence**. Metadata-only evidence is in `supabase/recovery/historical-baseline/inventory-readonly-20261109.json`; source hashes are of PostgreSQL `array_to_json(statements)::text`, not Python's compact JSON format.
- Current `private` contains **42** live functions. **31** have a matching unquoted `CREATE FUNCTION private.name` textual pattern somewhere in retained migration statements; **11** do not. Matching is heuristic, so the 11 remain `origin not established`, **not proven absent from all historical SQL**. See `helper-provenance-readonly-20261109.json`.
- **11 unresolved names:** `batch_academy_id`, `can_access_batch`, `can_access_center`, `can_access_coach`, `can_access_coach_batch`, `current_academy_id`, `current_user_role`, `is_academy_owner`, `is_coach`, `is_coach_assigned_to_batch`, `is_super_admin`.
- Dependency audit of live definitions shows `current_user_role`, `current_academy_id`, `is_super_admin` read `public.users` / `auth.uid()`; Coach-scope helpers access `public.coaches`, `public.coach_batches`, `public.coach_batch_assignments`, `public.batches`. Owner/Coach role wrappers depend on `private.current_user_role`. This is a **preliminary textual dependency inventory**, not an executable topological order.
- **42** private functions' signatures, security-definer flags, search paths, effective `anon`/`authenticated` EXECUTE checks and definition hashes were captured. Seven report `anon EXECUTE` but anonymous role lacks `USAGE` on schema `private`; effective access needs role-context tests.
- Live RLS: 114 policies reference `private` helpers. There are 12 public non-internal triggers including the payment-dues financial-state trigger; full parity includes their behavior.
- Key remote original definitions have been located: `current_parent_id()` first in `20260908062059`, later redefined `20260912142706`; `is_payment_player_in_current_academy(uuid)` in `20260908075043`.
- **Existing CI failures** [42203770759](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42203770759), [42204432173](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42204432173), [42204705752](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42204705752) are still unresolved. Synthetic PostgreSQL candidate [42195789707](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42195789707) passed, but **actual local Supabase parity has not run to completion**.

## B2.2 implementation

Created quarantined `supabase/recovery/historical-baseline/`:
- `export_migrations.py`: SELECT-only `psql` reader, local JSON statement-by-statement output with SHA-256 verification, timestamp collision inventory and strict non-overwrite guard. Requires explicitly configured `PGHOST`, `PGUSER`, `PGDATABASE` and credential; attempts read-only transaction mode. **It does not create migrations or execute SQL from the ledger**.
- `test_export_migrations.py`: four integrity tests (lossless statement arrays, collision recognition, altered-hash rejection, refusal to overwrite existing archive, duplicate-version refusal).
- `.gitignore`: excludes private SQL output and Python cache from the recovery workspace.
- `inventory-readonly-20261109.json` and `helper-provenance-readonly-20261109.json`: source-traceable **metadata only**, no raw historical SQL.
- `.github/workflows/subscriptions-ps-l2-3-recovery-tests.yml`: focused Python integrity CI.

**CI**: [42609954991](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42609954991) **PASS** at source SHA `ed2eb18481d6927948eaabcbc10f0909e5f8f68a`; it tests Python tooling only. Local draft test run also passed 4/4. No full historical SQL export or local database replay is claimed.

## Next gate — B2.3/B2.4

1. Run the exporter with an authorized **read-only** database role from a controlled environment. Keep the full output under ignored `.recovery-private/`; do not commit its unreviewed contents or share database credentials.
2. Review all raw source SQL for user-specific values, historic destructive data operations and authentication or privilege changes. Verify source bytes/hashes and compare all 23 matching version IDs by statement content.
3. For 59 remote-only versions, classify as missing source versus semantically equivalent retimestamped history; compare the 17 local-only files, including both `20260926133000` files. Preserve origin/version identity; do not rewrite remote ledger.
4. Find provenance or defensible current-definition snapshots for 11 unresolved foundational helpers. Review creation/dependency order after original `remote_schema`, `parents.user_id` extension and payment policies. Never deploy CI-only stub helpers as historical truth.
5. Once approved, construct a **separate disposable-only** migration tree. Full migrations must replay without undocumented prerequisites; confirm final schema, grants, RLS, trigger semantics, and role-negative tests before applying PS-L2.3 proposal locally.
6. **Production DDL, migration repair, subscriptions renewal/RPC writes and historical payment corrections require separate explicit Owner approval.**

## Phase state

| Step | State |
|---|---|
| B1 provenance metadata audit | Complete at version and initial helper levels |
| B2.1 recovery architecture | Design prepared |
| B2.2 exporter + metadata inventory | Implemented / CI tested |
| B2.2 raw SQL export and full content review | Pending |
| B2.3 11-helper origin and dependency resolution | Preliminary inventory; pending evidence |
| B2.4 replay ordering reconciliation | Pending |
| B3 local Supabase migration replay | Blocked |
| B4 PS-L2.3 local Auth/RLS/finance integration | Not executed |
| Live schema, payments and billing | Unchanged |

Manual UI acceptance is not applicable to this source-only phase; acceptance of migration provenance is still pending. Do not classify the subscription lifecycle as deployed.
