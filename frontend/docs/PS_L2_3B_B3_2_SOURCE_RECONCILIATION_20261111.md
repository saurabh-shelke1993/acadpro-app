# Kheltriva — PS-L2.3B B3.2 Source Reconciliation and Disposable-Only Assembly Design

**Date:** 11 November 2026 (Asia/Kolkata)  
**Branch:** `payment-module-finalization`  
**Supabase project:** `ulyealhkmlorsbdiknrh`  
**Execution boundary:** Source read-only inspection, offline metadata plans and CI tests. **No SQL executed, no production migrations repaired, no historical player/payment corrections run.**

## Outcome

**B3.2 review-only source reconciliation and disposable migration assembly design: IMPLEMENTED / CI TESTED.**

**Runnable, complete Supabase historical replay: BLOCKED, NOT CREATED, NOT TESTED.**

The module `supabase/recovery/historical-baseline/b3_2_reconciliation_design.py` builds an **82-entry ordered metadata decision plan** from pinned B2.4/B2.5/B2.6 and B3.1 evidence. It validates strict existing Git SQL-content links (using the earlier B3.1 checker), confirms all six differences remain unapproved, and enforces 14 data/procedural quarantine decisions. There is no executable SQL output or automatic migration renaming.

An accompanying six-case redacted review inventory is `supabase/recovery/historical-baseline/b3_2_six_divergences_review_20261111.json`. All source review and approval flags remain PENDING/false.

> **Follow-up source correction (B3.3, 11 November 2026):** The initial `20260823093317` remote history stores 87 *separate semicolon-free array elements*, whereas the Git file contains 87 delimited statements. The earlier whole-concatenation token mismatch does **not** persist when the original statement boundaries are preserved: a read-only ordinal-level lexical review matched **87/87** positions. Strict byte-level fingerprints remain different and actual DDL/RLS/constraint/privilege replay parity remains **unproven**. See `PS_L2_3B_B3_3_ORIGINAL_STATEMENT_REVIEW_20261111.md`. The other five source divergences retain their prior dispositions.

## A. Actual source comparison — six same-version divergences

A fresh Supabase **SELECT-only** retrieval of six affected history rows was compared in memory with the corresponding Git files. No original SQL body or changed UUID selector was committed.

| Version | Reconciliation evidence | Assembly decision |
|---|---|---|
| `20260823093317` base schema | Stored remotely as **87 SQL statement-array elements**. Both source texts contain **17 detectable CREATE object declarations** and matching object-name sets in a heuristic scan, but SQL token sequences differ. | **STOP:** object-by-object comparison of columns, defaults, indexes, triggers, grants, privileges, RLS and dependencies; equal object names do **not** imply schema parity |
| `20260920041302` transactional player-batch RPC | Git and remote show matching SQL token sequences under earlier lexical triage; original bytes differ | **PENDING:** compare exact function bodies, `SECURITY DEFINER`, `search_path`, error/transaction behavior and replay dependencies |
| `20260920041356` player-batch invariant enforcement | Lexically aligned but byte-divergent | **PENDING:** validate trigger/function semantics, definition and attachment |
| `20260920041457` active-player invariant scope | Lexically aligned but byte-divergent | **PENDING:** validate function/trigger conditions with synthetic active/inactive fixtures |
| `20260920041516` player-batch reconciliation | **Two** changed UUID-shaped quoted SQL literals between remote source and Git | **STOP / QUARANTINE:** record-specific data correction; do not substitute Git UUIDs or run against live players |
| `20260920041606` historical single-player correction | **One** changed UUID-shaped quoted SQL literal | **STOP / QUARANTINE:** record-specific correction; synthetic adaptation requires independent sign-off |

The simple `CREATE` declaration scan is **not a PostgreSQL parser**. It does not establish semantic equivalence of the base schema or any function, trigger, privilege or data-changing statement. All six remain unapproved.

## B. B3.2 one-to-one source-resolution plan

| Source class | Remote records | Required next decision |
|---|---:|---|
| Strictly linked to tracked Git SQL by exact hash / one bounded LF variant | **25** | Preserve original content fingerprint, review security and historical position; linkage alone does not authorize execution |
| Same-version Git file exists, SQL content differs | **6** | Compare exact retained remote SQL and local SQL, approve or reject at statement level |
| No strict Git-content-linked source | **51** | Recover the authentic remote original SQL from the retained migration ledger into a private archive, review and pin its exact statement boundaries |
| **Total** | **82** | Every record remains **PENDING**, including the 25 with content links |

**14** remote versions receive a mandatory data/procedural quarantine decision, based on direct top-level mutations, procedural `DO` blocks or record-specific cleanup conflicts. This is a targeted review set, **not** a claim that the other 68 SQL scripts cannot alter data; any routine, trigger or dynamic SQL can have side effects.

Eight migration records with strict content links use different timestamps in Git. The B3.2 plan lists these links **without inventing replacement version numbers**. It also flags the duplicate local `20260926133000` and 12-digit `202610210001_private_player_photo_storage.sql` filename. No tracked migration was rewritten or renamed.

## C. Disposable workspace design (not yet executed)

Proposed gates and sequence:

1. Provision an **unlinked, disposable** local Supabase workspace, with explicitly verified Auth/Storage runtime configuration and no production connection. *Not yet created.*
2. Use reviewed **authentic remote** `20260823093317` base SQL, not the divergent Git file by assumption. Complete its statement-level source audit first.
3. Review `private` schema creation/grants and the B2.9 11-helper **current-state snapshot** as a test-only reconstruction after the initial schema and before first recorded helper use at `20260903173804`. Do not claim original historical provenance.
4. Use original historical `private.current_parent_id()` at `20260908062059`; `parents.user_id` arrives at `20260912142706`. Do **not** inject today's parent function before its columns exist or disable `check_function_bodies` to bypass errors.
5. Build a **reviewed one-to-one statement-level sequence** from authentic sources. If a migration contains both essential DDL and old customer-specific data changes, review split strategy explicitly rather than silently skipping the complete migration.
6. Map duplicate/retimestamped/12-digit local names **only in temporary scratch metadata**, maintaining an immutable correspondence to authentic remote versions. Never repair the hosted migration history.
7. Reproduce and compare functions, grants, `SECURITY DEFINER` search paths, RLS policies, triggers, constraints, Auth/Storage behavior and payment invariants, then attempt the PS-L2.3 proposal **only after** the disposable baseline passes.

No currently checked-in B3.2 file contains an executable migration-assembly command or permission to apply SQL.

## D. Implementation and CI

New files:
- `supabase/recovery/historical-baseline/b3_2_six_divergences_review_20261111.json`
- `supabase/recovery/historical-baseline/b3_2_reconciliation_design.py`
- `supabase/recovery/historical-baseline/test_b3_2_reconciliation_design.py`
- `.github/workflows/subscriptions-ps-l2-3-b3-2-reconciliation.yml`

**GitHub Actions [42883854807](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42883854807): PASS, 10 automated Python tests.**

Tests verify exact source-class counts, the six pending divergences, the base schema uncertainty, the 14 quarantined cases, parent-helper chronology, protected helper bootstrap timing, duplicate/timestamp handling, protection against changed Git SQL, cross-project provenance tampering and false approval. A successful workflow generates the **metadata-only, 82-entry** artifact `kheltriva-b3-2-reconciliation-review-only` with 14-day retention.

The initial run failed because a correctly rejected tampered SQL file produced a more specific newline-rejection message than the test expected. The assertion was corrected, then the full workflow passed. No database execution or application changes occurred.

Run from the repository root if an independent copy of the metadata design is needed:

```powershell
python supabase/recovery/historical-baseline/b3_2_reconciliation_design.py --root . --output "$env:TEMP\kheltriva_b3_2_review_only.json"
```

**Output remains:** `ready_to_build_executable_migrations=false`, `ready_for_full_supabase_replay=false`, `ready_for_production=false`.

## E. Status and next practical gate

| Area | Status |
|---|---|
| B3.1 historical order / metadata plan | Implemented, CI passed |
| B3.2 six-difference classification and redacted evidence | Implemented, source observations recorded |
| B3.2 82-entry source-resolution and disposable-only design | Implemented, CI passed |
| Protected complete original SQL archive | **Pending** |
| Historical initial schema and 57 unlinked sources approved | **Pending** |
| Old customer/finance correction quarantine sign-off | **Pending** |
| Executable disposable migration tree | **Not created** |
| B3 actual full Supabase replay | **Not run** |
| B4 real subscriptions/RLS/finance integration | **Not run** |
| Hosted DB / credentials / payments / renewals | **Unchanged** |

**Recommended next:** B3.3 — secure original SQL retrieval and statement-level reconciliation, prioritizing the original base snapshot and the 14 data/procedural cases. This cannot be declared finished using fingerprints alone. Keep the full SQL archive out of Git and preserve original applied history.

**Security principle:** A CI PASS for source planning is not evidence that the subscription lifecycle problem has been resolved, or that automated expiry, renewal, proration and next-period dues are deployed.
