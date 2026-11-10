# Kheltriva — PS-L2.3B B2.5 historical SQL review and disposable replay candidate gate

**Checkpoint date:** 10 November 2026 (Asia/Kolkata)  
**Branch:** `payment-module-finalization`  
**Active Supabase project:** `ulyealhkmlorsbdiknrh`  
**Allowed operations:** read-only `supabase_migrations` queries, metadata-only Git commits and isolated Python tests.  
**Not allowed:** production DDL, `migration repair`, data backfills, historic migration rewriting, payment/renewal writes or promotion of proposal SQL.

## Scope and result

**B2.5 review evidence + fail-closed candidate validation: IMPLEMENTED / CI TESTED.**
**B2.5 historical source sign-off + runnable disposable replay candidate: NOT APPROVED / BLOCKED.**

Read-only historical lineage is still 82 ledger migration records versus 40 tracked `supabase/migrations/*.sql` files:
- 17 SQL content byte-exact matches.
- 6 single terminal-LF and 2 single leading-LF fingerprint matches.
- **25 strict Git content links; 8 refer to differently timestamped Git files.**
- **6 same-version content divergences**.
- **51 remote versions without any strict Git SQL-content link; 15 Git migration files without a remote content link**.
- The Git source has a collision between two distinct files starting `20260926133000`.
- **11 foundational private helper creation origins are still unproven**. The original ledger contains no explicit `CREATE SCHEMA private` or original `private.current_user_role()/is_super_admin()` function creation.

These facts make a production-equivalent clean migration replay **not yet reproducible** from the current committed SQL directory.

## Six same-version divergences: targeted review findings

| Remote version | Content review result | Gate |
|---|---|---|
| `20260823093317` | First SQL-token difference occurs near the beginning; SQL token counts differ. Strict SQL content does not match; schema/object equivalence has not been verified. | Baseline diff and object-by-object review |
| `20260920041302` | Token stream compared by a **heuristic** lexical scanner is equal, while raw bytes differ. | Manual SQL review; tokenizer is not a SQL parser |
| `20260920041356` | Heuristic token stream equal; bytes differ. | Manual trigger/function body review |
| `20260920041457` | Heuristic token stream equal; bytes differ; comment/whitespace normalization suggests similarity, **not parity**. | Manual trigger/function body review |
| `20260920041516` | Differences include quoted literal SQL values and are not confined to one token. | **STOP — player record-specific reconciliation** |
| `20260920041606` | Exactly one quoted literal token differs in a small historical cleanup statement. | **STOP — player record-specific reconciliation** |

**No actual player identifiers or historical cleanup literals were committed to this report.** No changed literal has been judged safe or equivalent. Hard-coded player reconciliation steps must not be blindly copied or rerun, even in synthetic fixtures.

## Read-only SQL screening

Added `supabase/recovery/historical-baseline/review-queue-readonly-20261110.json` with **82 pending, unapproved migration-review entries** and **11 unproven helper entries**. Only names, hashes/matched filenames, flags, status and lengths are included: no SQL statements, identity/financial rows or credentials.

A conservative lexical scan of all 82 historical SQL bodies flags:
- 54 migrations with potential data-changing SQL tokens (**may be inside function definitions or comments, not proof that the migration directly updates rows**).
- 40 with GRANT/REVOKE tokens.
- 25 with SECURITY DEFINER.
- 3 with potentially destructive keywords.
- 4 with a quoted UUID-pattern literal.

These are prioritization flags for controlled source review, not an authorization to execute.

## Fail-closed candidate builder

`supabase/recovery/historical-baseline/build_review_candidate.py` takes the two metadata evidence files and constructs an **ordered, non-executable** 82-record review plan. The builder:
- Validates exact sequence/version identity, source match status, pending approvals and consistency across both manifests.
- Refuses any conflicting versions, manually changed approved states, missing foundational-helper gate, or changed global gate flag.
- Creates no SQL body, migration file, hosted connection, DDL or replay command.
- Reports `ready_for_disposable_replay=false` and `ready_for_production=false` by construction.

The local disposable ordering is the original 82-version **historical remote sequence**, subject to review of all protected and unmatched operations. No migration renames, synthetic seed data operations or helper bootstraps are executable outputs of this phase.

**CI validation:** [PS-L2.3B recovery evidence run 42744787611](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42744787611) **PASS — 21 tests**, Python syntax validation and a real 82-row metadata candidate generation check. The run asserts that no replay is permitted.

## Remaining mandatory gates before a runnable B3 candidate

1. Complete **private raw SQL export** of all historical `statements` arrays with a dedicated read-only connection via the existing exporter. Maintain ignored storage, verify SHA-256 and review for personal literals, credentials, historical cleanup and privilege operations. **No full raw export has yet been performed or reviewed.**
2. Review and disposition the six differing-version-content pairs, especially the two quoted literal changes. Each accepted replay source must carry original version, content hash, reviewer and SQL-body evidence.
3. Resolve the first-use provenance for 11 helper definitions, including live signatures, owners, security modes, search paths and grants. If using current-state snapshots, label them **test harness reconstruction**, not historical applied migrations. Respect that `parents.user_id` is added only at `20260912142706`.
4. Create a **separate disposable-only** migration assembly from approved evidence; resolve the eight timestamp drift links and duplicate `20260926133000` filenames without changing remote applied migration history. Exclude or explicitly adapt historical data reconciliation operations for synthetic fixtures.
5. Replay against a disposable, unlinked Supabase instance and compare schema, Auth/RLS, 42 private functions, privileges, triggers and real finance behavior. Only after clean B3 may PS-L2.3 proposal be applied **locally** and integration-tested in B4.

**STOP condition:** No runtime migration replay or claim of staging parity while any of these gates is unresolved. Production DDL requires separate Owner authorization, even after successful B3/B4 tests.

## Updated development status

| Component | Status |
|---|---|
| B2.5 metadata-level historical risk review | Implemented and inspected |
| B2.5 82-migration review queue | Committed; all PENDING |
| B2.5 fail-closed candidate validator | CI PASS, 21 tests |
| B2.5 raw SQL private source review | PENDING |
| B2.5 executable disposable migration tree | NOT CREATED |
| B3 real local Supabase replay | BLOCKED |
| B4 PS-L2.3 Auth/RLS/payment integration | NOT EXECUTED |
| Hosted Supabase database, subscriptions, dues and receipts | UNCHANGED |

This is a prerequisite for subscription lifecycle implementation (proration, renewal, expiry, new dues). No automatic billing has been activated; prior historical agreements remain HOLD pending explicit reconciliation and approval.
