# Kheltriva — PS-L2.3B B3.5 Private Historical SQL Security Review

**Date:** 11 November 2026 (Asia/Kolkata)
**Branch:** payment-module-finalization
**Supabase project:** ulyealhkmlorsbdiknrh
**Security:** read-only catalog inspection and offline test-only code. No hosted SQL writes.

## Phase decision

- **B3.5A IMPLEMENTED/CI TESTED:** offline original-source review tooling and sanitized current-state catalog snapshot.
- **B3.5B PENDING local execution:** owner runs tool against the independently verified 82-migration, 168-element private B3.4 SQL archive.
- **B3.5C PENDING manual security approval:** human source/role/RLS/finance/data-splitting review for all 14 quarantined historical migrations. No migration approved.

B3.5A tests only the source reviewer, not the production migration history or actual security semantics. The user's protected B3.4 archive remains only on their Windows laptop.

## Implemented files

- supabase/recovery/historical-baseline/b3_5_quarantine_source_review.py: reads raw original SQL only from the Git-ignored B3.4 archive, verifies all 82 migration sources and all 168 original-element hashes through the B3.3 verifier BEFORE analysis, and compares the 14 selected high-risk migrations with pinned B2.6/B3.4 risk inventories. Produces structural-only, literal-free JSON, with every approval false and never writes into canonical migrations.
- supabase/recovery/historical-baseline/test_b3_5_quarantine_source_review.py: 12 synthetic tests validating risk classification, masked SQL quoting and procedural bodies, source/approval drift, tenant negative gate checklist, blocked paths and replay denial.
- .github/workflows/subscriptions-ps-l2-3-b3-5-quarantine.yml: synthetic Python CI without real SQL archives, Supabase secrets, database connections or SQL execution.
- supabase/recovery/historical-baseline/b3_5_current_catalog_readonly_20261111.json: connected Supabase SELECT-only snapshot of six live RLS-protected tables and current private function counts.

**GitHub Actions:** https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42957811902 — PASS, 12 synthetic tests.

## Read-only current database security metadata, NOT historical replay proof

| Current public table | RLS enabled | Policies | Non-internal triggers |
|---|---|---:|---:|
| attendance | yes | 4 | 1 |
| batches | yes | 5 | 0 |
| parents | yes | 5 | 0 |
| payment_dues | yes | 6 | 1 |
| player_batches | yes | 5 | 1 |
| players | yes | 5 | 1 |

The current private schema contains 42 functions, of which 35 have SECURITY DEFINER. No security-definer private function lacks a proconfig setting. A total of 114 current RLS policies reference private-schema functions. Having proconfig set does not itself prove a safe search_path or correct tenant scope. These catalog facts must not substitute for source-level, role-negative and financial invariants tests.

## Quarantine by business risk

The 14 cases are source-derived from the pinned B2.6/B3.4 evidence, not newly approved:

- Parent Auth linkage/backfill: 20260912142706
- Parent-attendance/schedule/UPI procedural: 20260912180959, 20261010011839, 20261012013143
- Record-specific player-batch cleanup (conflicting historical UUID literals): 20260920041516, 20260920041606
- Parent/player duplicate cleanup: 20260920053210
- Finance and receipts/overpayment: 20260926081053, 20260926081320, 20260926113534
- Storage/academy logo/coach or player photos: 20260930071849, 20261008075914, 20261021052601
- Enquiries security and backfill: 20261012035934

All 14 remain under manual review. A mixed DDL/data migration cannot be silently skipped, because it may include essential functions, RLS policies, triggers, grants or constraints. An opaque DO block or function body cannot be deemed safe from keyword scans.

## B3.5B — Local owner command (not yet run)

From repository root in VS Code PowerShell:

    git pull origin payment-module-finalization
    $private = "supabase\recovery\historical-baseline\.recovery-private"
    python supabase/recovery/historical-baseline/b3_5_quarantine_source_review.py --root . --archive "$private\baseline-b3-4-001" --output "$private\b3-5-quarantine-review.json"

Expected summary:

    {
      "verified_original_versions": 82,
      "verified_original_elements": 168,
      "quarantined_cases_structurally_scanned": 14,
      "manual_source_review_complete": false,
      "ready_for_disposable_replay": false
    }

The report remains inside the Git-ignored .recovery-private folder. It contains structural labels, source SHA-256 identities and review flags, but not original SQL, UUID literals or payment records. Do not paste the original SQL, the five CSV files or the full private report into ChatGPT or GitHub. Share only the summary output. If an output file already exists, the tool refuses to replace it.

## Manual sign-off required before B3

1. Review all 14 actual historical SQL scripts privately. Identify original schema/privilege effects versus past customer-specific data corrections, without exposing values.
2. For each script approve/reject disposition of essential DDL, mixed DDL/data, and synthetic-only correction handling. Never replay real historical UUID selectors or financial updates on production.
3. Test the existing ROLE_MATRIX constraints: Super Admin platform, Owner own academy, Coach assigned batch/players, Parent linked family, with tenant-negative policies.
4. Verify original creation order and SQL body of private helpers, including historical current_parent_id and parents.user_id chronology. Current-state B2.9 fixture is not historical source.
5. In an unlinked disposable Supabase only, validate RLS, storage, SECURITY DEFINER owner/search_path/grants, functions/triggers and financial invariants before PS-L2.3 integration.

**Status:** B3.5A implemented/tested. Actual local archive scan, human SQL review, complete B3 disposable Supabase replay and B4 subscription lifecycle integration remain pending or blocked. Production unchanged.
