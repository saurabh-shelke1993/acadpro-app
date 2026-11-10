# Kheltriva — PS-L2.3B B2.8 Live Authorization Dependency Audit

**Date:** 10 November 2026 (Asia/Kolkata)  
**Branch inspected:** `payment-module-finalization` at `9ba2f69b10ee3b5e8ebd99b31aec23a281470ce7`  
**Active Supabase project:** `ulyealhkmlorsbdiknrh`  
**Operation:** SELECT-only connected Supabase catalog and historical migration ledger investigation; read-only GitHub source comparison. **No database/credential/app code changes.**

## Why this checkpoint

B2.7 provides private source archive tooling, but the owner chose to continue through connected Supabase instead of resetting an unknown PostgreSQL password. This phase verifies whether the 11 unproven foundational `private` functions can be recovered from the **current live catalog** to support an explicitly labeled **disposable-only current-state reconstruction**. It does not assert historical provenance or authorize replay.

## Verified live evidence

- `supabase_migrations.schema_migrations`: **82** rows, **168** retained statement-array elements; earliest `20260823093317`, latest `20261101082001`.
- **All 11** historical-origin-unproven `private` helpers exist, and `pg_get_functiondef` can return their complete **current definitions**.
- All 11 current definitions' SHA-256 hashes **match** the prior repository inventory `supabase/recovery/historical-baseline/helper-provenance-readonly-20261109.json`: no observed definition drift between that inventory and this inspection.
- The 11 functions are **owned by `postgres`**, **SECURITY DEFINER**, **STABLE**, with explicit function `search_path` settings. `current_academy_id` and `is_super_admin` use `public, pg_catalog`; the others use `public, private`. Current permissions must be checked per function and reproduced **only for disposable testing**.
- Schema `private` is owned by `postgres`. `anon` lacks `USAGE` on `private`; `authenticated` has `USAGE`. `authenticated` lacks `CREATE` on `public`. Effective function `EXECUTE` rights differ by helper. Never infer executable access from EXECUTE alone without checking schema USAGE.
- Current live database has **42 `private` functions**. **114 RLS policies reference the private namespace**. Read-only scans found **no recorded `CREATE SCHEMA private`**, `CREATE FUNCTION private.current_user_role()`, or `CREATE FUNCTION private.is_super_admin()` in the retained migration history (including searched unqualified/quoted spellings). The original foundation remains unproven.
- Every **underlying table** required by the 11 helper bodies (including `public.users`, `public.batches`, `public.coaches`, `public.coach_batches`, and `public.coach_batch_assignments`) has a `CREATE TABLE` occurrence in the **initial recorded `20260823093317` schema snapshot**. That is useful for placing a **potential** test-only helper fixture *after* the initial schema, but successful compilation/runtime behavior has not been tested.
- No scanned helper body contains the keyword `EXECUTE` (dynamic SQL) or `set_config`. This is a lexical screening observation, not a formal code/security proof.

## Dependency/criticality map

| Current foundational helper | Live RLS policies directly referencing | Other live public/private functions that call it | Current function dependency among 11 |
|---|---:|---:|---|
| `batch_academy_id` | 3 | 0 | none |
| `can_access_batch` | 0 | 0 | none |
| `can_access_center` | 0 | 0 | none |
| `can_access_coach` | 0 | 0 | none |
| `can_access_coach_batch` | 0 | 0 | none |
| `current_academy_id` | 73 | 13 | none |
| `current_user_role` | 22 | 21 | none |
| `is_academy_owner` | 67 | 2 | `current_user_role` |
| `is_coach` | 1 | 0 | `current_user_role` |
| `is_coach_assigned_to_batch` | 8 | 3 | none |
| `is_super_admin` | 60 | 5 | none |

RLS counts overlap because a policy may reference more than one helper; **do not add them together**. Zero matches mean no **direct** calls were found in current RLS policy expressions or other `public`/`private` function definitions, **not** that a helper is unused by applications or obsolete.

Earliest recorded SQL call references to these helpers:
- `20260903173804`: `batch_academy_id`, `current_academy_id`, `is_academy_owner`, `is_super_admin`.
- `20260907180752`: `current_user_role`, `is_coach_assigned_to_batch`.
- `20261012035934`: `is_coach`.
- No explicit calls to the four `can_access_*` helpers were found in the retained migration SQL.

## Re-check of six same-version SQL source conflicts

Read-only retrieval from the live migration ledger plus exact GitHub file reads produced the following **heuristic SQL token** assessment (tokens do not establish parser-level or semantic equivalence):

| Applied migration version | Finding | Replay disposition |
|---|---|---|
| `20260823093317` | Remote and Git token counts/sequences differ | STOP: foundational schema must receive object-level review |
| `20260920041302` | Token streams match after removing comments/whitespace | Pending semantic/parser and provenance review |
| `20260920041356` | Token streams match after removing comments/whitespace | Pending semantic/parser and provenance review |
| `20260920041457` | Token streams match after removing comments/whitespace | Pending semantic/parser and provenance review |
| `20260920041516` | Two changed **UUID-shaped quoted SQL literals** | STOP: historical player-batch reconciliation; no production replay |
| `20260920041606` | One changed **UUID-shaped quoted SQL literal** | STOP: historical player-batch cleanup; no production replay |

The changed UUID values were not printed, stored or committed. A matching lexical token stream does **not** authorize executing a migration.

## Proposed safe next implementation gate (NOT YET IMPLEMENTED)

1. Prepare a **test-only current-state reconstruction** from `pg_get_functiondef` for all 11 helpers and their exact owner/security flags, `search_path`, volatility and privileges. Do not insert the fixture into canonical `supabase/migrations` or mark it as authentic historical SQL. Treat original provenance as unresolved.
2. Proposed dependency order for *testing*: initial recorded base schema → `private` schema and reviewed grants → independent foundational helpers (`current_user_role` before its wrappers) → role wrappers `is_academy_owner` and `is_coach` → historical migration sequence. Any functions using later schema objects require reordering or explicit verification; no replay success is implied.
3. Do **not** reconstruct financial or record-specific cleanup history by inventing literals. Use the original applied SQL as evidence and quarantine player/payment backfills.
4. Only after source and privilege review, attempt a **disposable unlinked local Supabase replay** with role-negative tests and schema parity checks. B3 remains **BLOCKED** today.

## State

| Workstream | Status |
|---|---|
| B2.8 current live 11-helper metadata/dependency audit | **Read-only inspection complete** |
| Current definition hash stability vs previous inventory | **11/11 match** |
| Foundational historical creation provenance | **Unresolved** |
| Local-only reconstruction fixture implementation | **Planned, not implemented** |
| Full protected raw SQL archive on owner's workstation | **Pending** |
| B3 clean disposable Supabase replay | **Blocked / not tested** |
| PS-L2.3 subscription lifecycle migration and billing | **Unapplied / unchanged** |

All information above came from read-only connected Supabase catalog queries and GitHub evidence. No credentials were needed, reset or changed, and no database writes were performed.
