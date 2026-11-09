# Kheltriva — PS-L2.3B B2.3/B2.4 dependency findings (9 Nov 2026)

**Working branch:** `payment-module-finalization`  
**Active database:** `ulyealhkmlorsbdiknrh`  
**Audit boundary:** SELECT-only live catalog/migration queries + offline source tooling. No live DDL, migration repair or finance writes.

## Definitive B2.3 findings

The live `supabase_migrations.schema_migrations` ledger has 82 version records with 168 retained SQL statement entries. A case-insensitive scan of **all** retained statement text found:
- **Zero explicit `CREATE SCHEMA private`** statements.
- **Zero `CREATE FUNCTION private.current_user_role()` and `private.is_super_admin()` definitions**, whether schema-qualified or unqualified with these names in the tested patterns.
- `ALTER TABLE public.parents ... ADD ... user_id` originates at version `20260912142706` (`link_parents_to_auth_users`).
- The original `private.current_parent_id()` appears in `20260908062059`, and is redefined at `20260912142706`.
- `private.is_payment_player_in_current_academy(uuid)` originates in `20260908075043`.
- A separate heuristic catalog scan found **11 live foundational private helpers** without explicit schema-qualified creation statements in the recorded SQL (names in prior helper metadata inventory). The existence of these 11 in the deployed live schema is confirmed, but creation provenance has **not** been established.

**Conclusion:** the remote historical ledger is not self-contained for a fresh replay either. The **source of the original foundational `private` helper layer remains unproven**. A private helper snapshot may be authored for an isolated test harness only if it is labeled **current-state reconstruction**, not historical fact, and its grants, owner, `security_definer`, and `search_path` are explicitly compared against live metadata.

## Migration identity conflicts

- Git has 40 local migration files with 39 distinct version IDs; remote ledger has 82 entries.
- Exact version-ID intersection: 23. Remote-only version IDs: 59. Local-only files: 17 (16 unique versions).
- Local collision: two separate SQL files start with `20260926133000`, concerning `fix_generated_payment_due_updates` and `restrict_payment_operations_to_admin_roles`. Retimestamping or rewriting remote history is **not approved**.
- Plausible source lineages requiring **SQL-by-SQL proof**: player bulk import (`20260919`), player batch constraint/RPC fixes (`20260920`), payment financial foundation and follow-up security/fixes (`20260926`), attendance role changes (`20261011`), player photo (`20261021`), center codes (`20261031`). Dates and names alone are not equivalent evidence.
- Missing source categories additionally include coach profiles/photos, academy branding, batch schedules, earlier RLS policies and enrollment constraints. Do not treat these as no-ops or silently skip them.

## Dependency order (review candidate, not a validated runnable plan)

1. Supabase local platform/Auth initialization (by pinned CLI), then initial `20260823093317_remote_schema` (public tables only).
2. **Quarantined current-state base helper fixture** required by first post-baseline RLS migrations: `private` schema, fundamental role/auth helpers, academy-scoping and coach-batch access helpers. Its exact historical origin is unknown; verify current privilege and referenced-table metadata before generating SQL.
3. Import verified remote-only September RLS migrations in original `version` order, with original `current_parent_id` definition before later redefinition and `parents.user_id` addition at the correct point.
4. Reconcile `20260919–20261031` remote-only migration order against mismatching local timestamps; treat data cleanup/backfills and privileges as separate safety-sensitive operations, not anonymous fixtures.
5. Final live-versus-disposable checks: function signature, ownership, volatility, security mode, search paths, grants, policies, constraints, triggers, RLS, `auth`/storage dependencies and financial-state behavior.
6. Only after clean replay and separate approval, apply the **unapplied** PS-L2.3 proposal to the disposable local instance for role-negative and finance tests. **Never** deploy it to the hosted project as part of this phase.

## New tooling

`supabase/recovery/historical-baseline/analyze_replay_dependencies.py` operates only on a previously exported, SHA-256-verified quarantined statement archive. It emits a metadata-only heuristic report of private helper definitions/references, ordering gaps, `parents.user_id` and risky DML. It **does not execute SQL**. All findings default `replay_approved=false`. Companion unit tests cover missing schema/helpers, valid ordering, DML flagging and tampered hashes. Regex scans are heuristics; they are not a replacement for a SQL parser or actual replay.

The quarantined exporter from B2.2 has **not yet been run against the live ledger as a complete output archive**, because a controlled read-only database credential/environment and raw-SQL review are still necessary. We must not fabricate that artifact from catalog metadata.

## Gates and status

| Gate | State |
|---|---|
| B2.3 missing foundational authorization provenance | **Unresolved; absence of recorded definitions confirmed for major helpers** |
| B2.3 offline dependency validator | **Implemented; CI must be verified at exact commit** |
| B2.4 all-version SQL content parity | **Pending full quarantined export** |
| B2.4 self-contained disposable replay | **Not yet attempted with recovered baseline** |
| B3/B4 real local Supabase / subscription tests | **Blocked** |
| Existing subscription/payment database | **Unchanged** |

Never run `supabase migration repair`, `db push`, backfills, or recovered SQL in hosted Supabase during PS-L2.3B.
