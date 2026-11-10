# Kheltriva — PS-L2.3B B3.1 Historical Migration Assembly Preparation

**Checkpoint:** 11 November 2026 (Asia/Kolkata)  
**Branch:** `payment-module-finalization`  
**Hosted Supabase:** `ulyealhkmlorsbdiknrh` — **SELECT-only migration count confirmation**  
**Implementation boundary:** Metadata-only manifest and offline Python CI. **No historical SQL export, SQL execution, migration repair, hosted DDL, financial writes or subscription renewal.**

## Executive outcome

**B3.1 review-only assembly: IMPLEMENTED AND AUTOMATED TESTS PASSED.**

**Full Supabase migration replay: BLOCKED; NOT EXECUTED.**

B3.1 assembles a **non-executable** one-to-one manifest for all 82 recorded remote migration versions and verifies the source links to existing Git SQL files against the previously pinned content fingerprints. It separately flags data/procedural SQL for review, the test-only B2.9 helper-bootstrap window, historical `parents.user_id` chronology, duplicate/irregular migration timestamps and incomplete source provenance.

A passing B3.1 CI run only means the **source assembly safety checks** passed.

## Source basis and counts

| Evidence | Verified |
|---|---:|
| Live ledger `supabase_migrations.schema_migrations` | 82 versions |
| SQL statement-array entries retained in live ledger | 168 |
| Git `supabase/migrations/*.sql` | 40 files |
| Strictly fingerprint-linked remote rows | 25 |
| Remote rows with no strict Git-content link | 57 |
| Same-version SQL-content divergences | 6 |
| Remote rows with no Git SQL-content match at all | 51 |
| Unmatched Git migration files | 15 |
| Remote migrations marked for specific direct-data/procedural review | **14** |
| Duplicate Git migration version | `20260926133000` (two distinct files) |
| Nonstandard 12-digit Git filename | `202610210001_private_player_photo_storage.sql` |

The 14 quarantined versions are the **union** of direct top-level mutations, procedural `DO` blocks, mutating CTE screening and the two record-specific player-cleanup conflicts. **The other 68 are not approved for execution either**: every one of the 82 records requires full original SQL source review.

## Authenticity and sequence contract

Every review-manifest entry includes:
- Original remote migration version, name, ordinal, SQL statement count and Git-compatible remote SQL fingerprint
- Strict local Git-content links, verified by rehashing existing tracked file bytes; where applicable, one individually bounded leading/trailing LF transformation is checked
- Source classification (`exact-bytes`, `terminal-lf-only`, `leading-lf-only`, `same-version-content-divergence`, or `no-content-match`)
- Direct DML / procedural block / record-specific SQL risk flags and quarantine status
- Explicit `requires_original_sql_source_review=true`, `historical_migration_replay_approved=false`, `approved_sql_file=null`

The source and order are cross-validated against the B2.4 parity inventory, B2.5 review queue and B2.6 SQL-risk inventory. An approval flag, altered migration, reordered history, missing source or changed Git SQL hash is rejected by the generator. **No recovered SQL bodies are included.**

### B2.9 current-helper bootstrap timing (proposed only)

Provisional, not replay-approved:
1. Original remote base `20260823093317` must first be source-reviewed. Its SQL differs from the Git baseline.
2. The current-state 11-helper fixture `ps_l2_3_b2_9_live_helper_snapshot.sql` is considered **only for test reconstruction** after the verified base tables exist and before the first recorded private helper use `20260903173804`. This is not the original historical creation event, and **no fixture is inserted automatically**.
3. `private.current_parent_id()` must use the **historical** body appropriate to its point in time: original creation occurs at `20260908062059`; the `parents.user_id` schema change occurs later at `20260912142706`. Do not substitute its modern body early or turn off `check_function_bodies` to force invalid order.
4. Historical record-specific player reconciliation `20260920041516` and `20260920041606` remains quarantined because literal record selectors differ between live SQL and the same-version Git files.
5. Historical payment, parent-linkage, enquiry-backfill, storage and procedural operations require separate review and synthetic-fixture decisions. Never silently skip mixed schema/data migrations.

## Artifacts and tests

- `supabase/recovery/historical-baseline/b3_1_assembly_manifest.py`: builds metadata-only, ordered 82-record candidate; verifies strict Git blob content and fail-closed gates; refuses to output under `supabase/migrations/`.
- `supabase/recovery/historical-baseline/test_b3_1_assembly_manifest.py`: **9 automated tests**, including historical ordering, 25 source link checks, changed-file tampering detection, child/parent function order, record-specific quarantine, false-history approvals and failed approvals.
- `.github/workflows/subscriptions-ps-l2-3-b3-1-assembly.yml`: independently checks the assembly and publishes a review-only manifest artifact with **14-day retention**.
- **GitHub Actions [42882011251](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42882011251): PASS — 9 tests; 82-record manifest generated; no SQL executed.** Artifact: `kheltriva-b3-1-assembly-review-only`.
- The initial B3.1 run failed because one test expected different wording for an intentional source-provenance rejection. The assertion was corrected; subsequent runs passed. No production issue or migration changed.

From repository root (this is safe: it writes **JSON metadata**, not migration SQL):

```powershell
python supabase/recovery/historical-baseline/b3_1_assembly_manifest.py --root . --output "$env:TEMP\kheltriva_b3_1_review_only.json"
```

The output states `ready_for_disposable_sql_generation=false`, `ready_for_disposable_full_replay=false`, and `ready_for_production=false`. Do not interpret the process exit code 0 as replay approval.

## Remaining gates and next checkpoint

| Gate | B3.1 status |
|---|---|
| One-to-one historical order and source fingerprint link checks | **Implemented/tested** |
| High-risk data and procedural review classification | **Implemented/tested (14 specifically flagged)** |
| 11 current helper candidate placement | **Proposed only; not source-approved** |
| Actual quarantined complete SQL source archive | **Pending** |
| Six divergent SQL sources + 51 remote unmatched sources | **Unresolved** |
| Historical data-operation split and security/privilege approval | **Pending** |
| Disposable-only runnable migration tree | **Not created** |
| Complete local Supabase Auth/RLS/finance replay | **Not executed** |
| PS-L2.3 actual subscription lifecycle integration | **Not executed** |
| Hosted database, passwords, payments, subscriptions | **Unchanged** |

**Recommended B3.2:** Targeted historical-source reconciliation and safe **disposable-only SQL assembly design**, beginning with the divergent base schema, helper creation order, 14 data/procedural quarantine cases and local version collisions. This must retain original source fingerprints and must never synthesize production customer-data cleanup or execute against hosted Supabase.

**Approval boundary:** A complete original SQL archive, reviewed helper grants, source parity and a successfully replayable isolated Supabase database are prerequisites for advancing to B4 and any production deployment.
