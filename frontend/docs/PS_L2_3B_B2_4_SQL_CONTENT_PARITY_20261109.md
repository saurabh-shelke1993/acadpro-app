# Kheltriva — PS-L2.3B B2.4 Historical SQL Content Parity and Recovery Candidate

**Reviewed:** 9 November 2026 (Asia/Kolkata)  
**Git branch:** `payment-module-finalization`  
**Live Supabase project:** `ulyealhkmlorsbdiknrh`  
**Scope:** Remote migration ledger **SELECT only**; GitHub tree/file reads; **metadata-only evidence** and offline validation code committed. No hosted DDL, data changes, migration repair or local Supabase replay.

## 1. Content comparison methodology

Rather than comparing filenames, we calculated the Git blob SHA-1 of each remote migration's stored SQL statement-array contents using PostgreSQL read-only queries. Hashes were compared with GitHub's actual `supabase/migrations/*.sql` blob IDs.

Only these narrowly controlled matches were accepted:
- **Exact bytes:** remote concatenated statement text matches a tracked Git SQL blob byte-for-byte.
- **Terminal-LF-only:** appending exactly one `LF` byte to remote SQL yields an exact Git blob match.
- **Leading-LF-only:** removing exactly one leading `LF` byte yields an exact Git blob match.

Other differences are **not** accepted as equivalent. In particular, normalization of arbitrary whitespace, comments or SQL literals is prohibited when declaring parity, because those transformations can alter executable behavior.

Metadata and hashes, not raw SQL or personal data, are committed at `supabase/recovery/historical-baseline/parity-fingerprints-readonly-20261109.json` (v2). SQL body content remains uncommitted.

## 2. Results — verified from the actual live ledger

| Check | Result |
|---|---:|
| Live remote migration records | **82** |
| Tracked Git migration files | **40** |
| Byte-exact content links | **17** |
| One terminal-LF-only content links | **6** |
| One leading-LF-only content links | **2** |
| **Total strictly fingerprint-linked** remote records | **25** |
| Linked remote records whose Git file uses a different version ID | **8** |
| Same-version Git files whose SQL **does not** meet strict match criteria | **6** |
| Remote records with **no content-linked Git SQL** | **51** |
| Git SQL files with **no remote content match** | **15** |
| Duplicate local migration version | **`20260926133000` (two distinct files)** |

**Interpretation:** 57 remote rows are not strictly content-linked (6 same-version discrepancies + 51 without any match). Do **not** equate those 57 with missing SQL files: some may be formatting variants or revised source, while many have no tracked counterpart.

### Eight verified retimestamped SQL links

| Recorded remote version | Git filename version | Origin |
|---|---|---|
| 20260920043638 | 20260920050000 | Player-batch constraint timing |
| 20260920045507 | 20260920051000 | Player-batch RPC-safe V2 |
| 20260926081320 | 20260926130000 | Legacy receipt backfill |
| 20260926094904 | 20260926133000 | Payment-due update fix |
| 20260926095749 | 20260926134500 | Overpayment message |
| 20260926095814 | 20260926135500 | Overpayment formatting |
| 20260926111113 | 20260926133000 | Restrict payment operations |
| 20261011130546 | 20261011140000 | Public-table lockdown |

The two Git files with version `20260926133000` correspond to *different* remote migrations. A disposable replay candidate must uniquely identify both objects without altering hosted applied-version records. Any local-only renaming or version assignment must be documented and approved separately.

### Six same-version divergences (stop conditions)

1. `20260823093317_remote_schema` — original foundational baseline not byte-equivalent.
2. `20260920041302_player_batch_invariant_transactional_writes` — player/parent transactional RPC.
3. `20260920041356_enforce_player_batch_invariant` — trigger/function invariant.
4. `20260920041457_scope_player_batch_invariant_to_active_players` — trigger/function invariant.
5. `20260920041516_reconcile_active_player_batch_mappings` — historical data reconciliation.
6. `20260920041606_reconcile_pratik_missing_current_batch` — **historical record-specific cleanup**.

**Important:** One trigger SQL pair looks equal after unsafe heuristic comment/whitespace stripping; this is **not accepted as equivalence**. The last two reconciliation migrations may contain data-dependent operations and must not be indiscriminately replayed against live records or synthetic data. Even where bytes are close, business meaning and schema state have not been established.

## 3. Remaining foundational blocker

No retained historical migration explicitly creates `private` or defines the original `private.current_user_role()` or `private.is_super_admin()` helpers. The live database has **42 private functions**, including **11** with no explicit function-creation provenance found in the stored SQL. Previous CI-only helper stubs are **not** original historical evidence.

Live catalog observations and the retained SQL should inform a **separately labeled current-state reconstruction fixture** for a disposable database. Do not overwrite authentic historical migrations, relax RLS, or grant broader privileges as a shortcut.

## 4. B2.4 recovery candidate, not production migration

Recommended *review-only* source order:

1. Preserve an immutable copy of the pinned 82-record ledger's complete ordered SQL statement arrays **in ignored/private evidence storage**, using `export_migrations.py` and SHA-256 verification. Do not commit raw unreviewed historical SQL. This step has **not been completed**.
2. Independently compare the full archive with 40 tracked migrations using `compare_migration_content.py`. Resolve the six same-version divergences by reviewed SQL diff, rather than trusting any one source by default.
3. Classify the remaining 51 remote statements as schema/RLS/function, data-fix/backfill, grant/revoke, or other. Review SQL for embedded identifiers, secrets and destructive statements; no replay of historical cleanup against real records.
4. Prepare a local-only, explicit, audited `private` security-helper bootstrap. Validate current signatures, `search_path`, function owners and EXECUTE privileges. Preserve the original parent Auth linkage chronology (notably `20260912142706`).
5. Assemble a disposable-only migration list with a one-to-one provenance table for every archived source. Resolve the two local `20260926133000` names and all retimestamp mappings **in the local fixture only**. Do not alter the hosted migration ledger.
6. On an unlinked disposable Supabase environment, replay from an empty DB and check object counts, function and policy semantics, RLS, grants, financial triggers, Auth, storage and tenant-isolation tests. Only after all these pass may the PS-L2.3 proposal be applied **locally** for subscription-integration tests.

**No candidate migration tree has been approved or run.** The existing failing `.github/workflows/subscriptions-ps-l2-3-supabase-local.yml` remains blocked pending these provenance gates. Future B3 local tests must be separate from migration source recovery.

## 5. Verification and status

- Implemented offline `compare_migration_content.py`, with tests for exact bytes, retimestamped equality, one trailing LF, one leading LF, same-version divergence, collision/no-match and tampered archive rejection.
- [Recovery CI run 42615314401](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42615314401) **PASS: 15 tests**, plus syntax compilation of exporter, dependency analyzer and comparator.
- Actual full raw SQL archive: **not yet extracted**, because it requires a controlled read-only database-export environment and sensitive-data review.
- Full content reconciliation: **partially verified; 25 content-linked, 57 unresolved**.
- Disposable Supabase replay: **not run**.
- Hosted data, migrations, Auth, payment triggers and subscription billing: **unchanged**.

**Status:** B2.4 fingerprint matching and automated parity checks **implemented/tested**. B2.4 full historical SQL recovery candidate **pending human source review**. Treat as a security prerequisite, not a finished database repair.

**Next:** B2.5 targeted raw-SQL provenance review and disposable replay candidate sign-off, with a stop condition on the six same-version divergences and eleven unproven helper origins.
