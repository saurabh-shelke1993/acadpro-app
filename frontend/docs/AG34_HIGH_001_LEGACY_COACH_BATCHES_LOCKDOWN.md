# AG34-HIGH-001 — Legacy `coach_batches` direct-access lockdown

**11 November 2026. Status: staged SQL + isolated native JWT regression; NOT deployed.**

## Scope and decision

The live `public.coach_batches` table is **empty (0 rows)** in the active `acadpro-db` project `ulyealhkmlorsbdiknrh`. This is a legacy Coach/Batch link; current `CoachBatchMapping.js` and `dataScope.js` use the separate `public.coach_batch_assignments` relation, which is explicitly role-scoped. The current Role Matrix allows Academy Owners/Super Admins to manage assignments through the active workflow, Coaches to see own assigned records, and Parents no direct assignment-table access.

AG3.4B previously demonstrated **unauthorized Parent and Coach INSERT and DELETE** under the source-matched legacy table policy predicates in *disposable* real-JWT tests. The current live policy hashes have not changed as of this fresh read-only check, and live direct `anon`/`authenticated` grants remain present. There is **no claimed incident involving actual customer rows**.

**Chosen mitigation:** close the *unused legacy table* to all direct browser/REST clients. Do not change the active mapping table, existing private helper function signatures, player/attendance/finance tables, or Auth. This is deliberately narrower than maintaining a separate legacy Owner/Coach CRUD contract; Owner/SA management continues through `coach_batch_assignments`.

## Deployed-object dependency check (read-only)

- `public.coach_batches`: 0 rows, RLS enabled, four permissive `authenticated` policies. Effective `authenticated` CRUD and `anon` SELECT granted. No non-internal custom trigger.
- It has `id` primary key and Coach/Batch foreign keys, but **no cross-academy invariant** tying the Coach to the Batch.
- Private `SECURITY DEFINER` helper functions `can_access_batch(uuid)`, `can_access_center(uuid)`, and `can_access_coach_batch(uuid)` still read this table. Do **not** drop them or their referenced table; preserving them avoids unpredictable SQL object breakage. Their legacy mapping reads currently return no matches because the live legacy table is empty.
- The repository's current mapping UI and data scope reference `coach_batch_assignments`, not `coach_batches`; perform Owner/Coach browser regression before any production rollout.
- Historical live schema ledger: 82 applied versions versus 40 local SQL files, with 23 version-prefix matches. Do not reapply or edit historic ledger entries.

## Proposed SQL (not a migration, not applied)

`supabase/security_remediation_proposals/ag34_h1_legacy_coach_batches_lockdown.sql`

1. **Preflight (transactional, fail-closed):** verifies the table exists, RLS is enabled, live row count is zero, four exact policy names/roles/commands/predicate MD5 fingerprints match AG3.4B, and current client grants are as expected. Any drift raises an exception and rolls back.
2. **Least-privilege GRANT lockdown:** `REVOKE ALL PRIVILEGES ON public.coach_batches FROM PUBLIC, anon, authenticated`. Does **not** touch `coach_batch_assignments` or the three helpers.
3. **Second line of defense:** add `coach_batches_legacy_closed` as a `RESTRICTIVE FOR ALL TO authenticated` RLS policy with `USING (false) WITH CHECK (false)`. Existing four policies remain intact for source provenance. This policy denies authenticated access if another migration accidentally re-grants the table.
4. **Postflight:** verifies zero rows, five policies, restrictive predicate and zero effective anon/authenticated direct privileges, then refreshes PostgREST schema cache.
5. No data updates, destructive cleanup, table drops, Auth changes, or canonical migration insertion.

**Important:** This SQL must never be invoked automatically against the hosted database or silently added to the 82-version history. A future approved release should generate the canonical migration using `supabase migration new`, reconcile its version with the live ledger and execute only after a reviewed snapshot, rollback plan and explicit Owner production authorization. Do not rely on a PR merge as deployment consent.

## Native CI validation

The new `.github/workflows/security-ag34-h1-legacy-coach-lockdown.yml` uses the **existing unlinked AG3.4B Supabase CLI 3.0.0** Auth/PostgREST/Postgres test fixture with **nine real signed GoTrue accounts** (eight app users: Owner A/B, Coach A/B, Parent A1/A2/B, Super Admin, and one unmapped user). The previously validated source-attested legacy policy snapshot reproduces unauthorized writes in scratch **before** lockdown.

In scratch only, the runner removes exactly three invented legacy mappings, exercises the proposed SQL, then expects:
- Both Owners, both Coaches, all three Parents and Super Admin have **no direct legacy SELECT/INSERT/UPDATE/DELETE**, even with forged access assumptions avoided. Anonymous has no direct SELECT.
- All effective table grants are removed; restrictive policy is present; original policies remain.
- A deliberate scratch-only `GRANT SELECT, INSERT, UPDATE, DELETE` plus an invented privileged row cannot bypass restrictive RLS: no signed app user can see, insert, mutate or delete the row.
- The invented row and grants are removed afterwards; original count is restored to zero.
- Active `coach_batch_assignments` (3 synthetic records), Owner/Coach batch reads and Super Admin cross-academy reads remain unchanged.
- No live secret, hosted project link, applied migration, production data, default branch, Vercel or paid service is used.

**Validation cannot prove production operational equivalence** without browser regression; historical reconstruction remains blocked. Treat any failed native CI as a hard stop.

## Remaining release gate

| Check | Status |
| --- | --- |
| Live source/row/grant inventory | **INSPECTED** |
| Scratch real-JWT lockdown including accidental regrant | **CI PENDING** until successful run |
| Proposed SQL committed to feature branch | **IMPLEMENTED / NOT DEPLOYED** |
| Canonical migration and rollback rehearsed against a faithful snapshot | **PENDING** |
| Manual Owner Coach Batch Mapping and Coach/Parent portal regression | **PENDING** |
| Explicit product-owner hosted DB authorization | **PENDING** |
| Live SQL postflight and Security Advisor rerun | **PENDING** |
| Other AG3.4E blockers (RPC/Storage/front-end/B3/B4) | **UNRELATED / REMAIN NO-GO** |

## Manual acceptance after a separately approved rollout

- Owner can create, activate/deactivate and remove **modern** `coach_batch_assignments`; associated weekday schedules remain intact.
- Coach sees only own active batches; Parent Portal surfaces only assigned Coach information through approved service/RPC without direct legacy table access.
- Signed Coach/Parent/Owner/Super Admin REST requests against legacy `coach_batches` receive denial; `anon` cannot read it.
- No changes to player/batch enrollment, attendance, finance or receipt behavior.
- A post-deployment read-only check verifies the five policies, no legacy client grants, zero legacy rows and absence of unrelated security changes.

**Rollback design:** Prefer a versioned forward remediation rather than reverting to the known-permissive policy/grant state. If operational impact is observed, isolate the dependency first; emergency rollback restoring the vulnerable grants should require an explicit security decision, compensating controls and a detailed incident plan.
