# Kheltriva — PS-L2.3B B3.4 Private SQL Archive Acquisition

**Checkpoint:** 11 November 2026, Asia/Kolkata
**Branch:** payment-module-finalization
**Active Supabase:** ulyealhkmlorsbdiknrh
**Security:** Connected Supabase SELECT only; no production writes, no password reset, no migration repair.

## Decision

**B3.4 private-archive importer implemented and synthetic CI tested. Actual full private archive still PENDING.** This phase adds a password-free extraction option using the owner's existing Google-authenticated Supabase SQL Editor. No original SQL is committed to GitHub. The owner must download the original records into a local protected folder before the real archive can be marked recovered.

B3.3 proved that the remote ledger contains **82 versions and 168 original SQL statement-array elements**. The new importer verifies both the saved migration-wide B2.4 fingerprints and every original B3.3 per-element SHA-256 **before writing an archive**. It rejects missing, duplicated, altered or misplaced sources. Existing B2.7 archive/attestation functions remain reused and unchanged.

## Implemented files

- supabase/recovery/historical-baseline/b3_4_import_dashboard_csv.py — offline import of 1–20 CSV files containing the single migration_json column; verifies 82 source versions, 168 element hashes, source project and safe ignored output path before archive creation.
- supabase/recovery/historical-baseline/test_b3_4_import_dashboard_csv.py — synthetic original-source CSV parser, 168-element hashes, tampering, duplicate/missing source rejection and path-safety tests.
- supabase/recovery/historical-baseline/b3_4_data_procedural_quarantine_review_20261111.json — 14 sanitized historical risk cases requiring manual review. All approved/replayed flags false.
- .github/workflows/subscriptions-ps-l2-3-b3-4-private-import.yml — no credentials, no real SQL, no production connection.

## Owner action: export using Google Supabase sign-in (not yet done)

Supabase's SQL Editor offers CSV result export (https://supabase.com/database). Visit:

https://supabase.com/dashboard/project/ulyealhkmlorsbdiknrh/sql/new

Run this SELECT-only query **five times**, substituting OFFSET with 0, 20, 40, 60 and 80:

    SELECT row_to_json(t)::text AS migration_json
    FROM (
      SELECT version, name, statements
      FROM supabase_migrations.schema_migrations
      ORDER BY version, name
      LIMIT 20 OFFSET 0
    ) AS t;

Export each result as CSV with header migration_json. Keep five distinct CSV files. Expected row totals: **20 + 20 + 20 + 20 + 2 = 82**. Do not use Excel to modify the CSV, paste SQL into ChatGPT, upload it to a shared cloud drive, or commit it to GitHub. Original migration SQL can contain customer-specific UUID selectors and historical security logic.

From the repository ROOT, in VS Code PowerShell:

    git pull origin payment-module-finalization
    $private = "supabase\recovery\historical-baseline\.recovery-private"
    New-Item -ItemType Directory -Force "$private\dashboard-csv" | Out-Null

In File Explorer, MOVE the five downloaded CSVs into the dashboard-csv folder. The whole .recovery-private directory is covered by a nested Git ignore file. Keep the files private and do not use a cloud-synced directory.

Then run:

    python supabase/recovery/historical-baseline/b3_4_import_dashboard_csv.py --root . --csv-directory "$private\dashboard-csv" --output "$private\baseline-b3-4-001"

Successful output must report 82 versions, 168 verified original statement elements, source_hashes_verified_before_archive=true, and ready_for_disposable_replay=false. The archive directory must NOT exist before the command; rerun with a new output name if necessary.

Optional independent full-source check using the resulting private archive:

    python supabase/recovery/historical-baseline/b3_3_original_source_audit.py --root . --archive "$private\baseline-b3-4-001" --output "$private\b3-4-independent-source-check.json"

This checks original SQL hashes again, still without executing it. After successful archive creation and review, remove the temporary unprotected CSV files in Downloads and retain the protected local source in encrypted storage. **Never commit or upload source SQL.**

## Original historical data/procedure review (14 cases)

The B3.4 register pins the **14 historical migrations** with direct data changes, procedural DO blocks or record-specific player-cleanup conflicts. These include 2 player-batch cleanup operations with conflicting UUID selectors, financial/receipt reconciliations, parent and duplicate cleanup, policy/storage operations, and enquiries changes.

All are pending; no source or security approval was granted. A procedure/trigger/mixed SQL migration must not be blindly omitted or executed. Full review must distinguish retained historical DDL/security semantics from historical record-specific operations in an isolated synthetic data environment.

## Validation and remaining gates

- Live ledger still contains 82 migration versions and 168 SQL array elements (connected Supabase, SELECT only).
- GitHub Actions B3.4 synthetic source-import tests **PASS**, including source integrity and quarantine register checks.
- Actual original SQL CSV downloads and local private archive **PENDING owner action**.
- Full 168-element verification from physically archived original SQL **NOT YET DONE**.
- Full Supabase Auth/RLS/financial replay **BLOCKED**.
- PS-L2.3 renewal/expiry/proration/automatic dues **NOT DEPLOYED**.
- No hosted database, migration, payment, password, or billing updates were made.

**Next gate:** After the five private CSV batches have passed import and per-element hash verification, privately inspect all 14 quarantined originals and the remaining SQL differences, then prepare an approved scratch-only Supabase replay. The current-state 11-helper fixture is still not original historical SQL.


## B3.4 follow-up — Windows checkout CRLF hash mismatch (11 November 2026)

**Observed:** First password-free private CSV import stopped: "B3.4 private SQL import refused: Tracked SQL changed from pinned source fingerprint: 20260920041653."

**Root cause in recovery code:** The pinned Git SQL source for 20260920041653_enforce_single_player_batch_mapping.sql contains LF and a final LF. The historical remote SQL Git-blob hash is exactly the Git file after removing that one final LF. Windows Git checkouts can materialize these same SQL lines as CRLF, and B3.1 previously compared the unnormalized working tree against the original LF hash. The user's local physical line endings are not independently observed; the root-cause hypothesis is corroborated by a verified original Git fingerprint and simulated Windows checkout tests.

**Repair:** B3.1 now normalizes only uniform CRLF-to-LF worktree line endings before recomputing the exact unchanged pinned historical content fingerprint. It rejects mixed newline encodings and actual SQL changes, including identifier or quoted-literal changes. No original migration, hosted Supabase history or data was modified.

**Important archive state:** The B3.4 importer finishes the private B2.7 archive before invoking the B3.1 source-history audit that emitted the error. Therefore original historical files and B2.7 reports were likely created on the owner's laptop. They must not be deleted or overwritten without verification.

B3.4 now has a --finalize-existing option, which independently rechecks a previously exported B2.7 archive, all 168 historical original statement SHA-256 values, and existing audit reports, then exclusively creates a sanitized b3-4-dashboard-attestation.json. This mode does not re-import or overwrite any historical SQL.

**Safe owner recovery (repository root, VS Code PowerShell):**

    git pull origin payment-module-finalization
    $private = "supabase\recovery\historical-baseline\.recovery-private"
    Test-Path "$private\baseline-b3-4-001\manifest.json"

If True:

    python supabase/recovery/historical-baseline/b3_4_import_dashboard_csv.py --root . --finalize-existing --output "$private\baseline-b3-4-001"

If False, do not delete or overwrite private data; inspect the archive folder filenames only.

**Validation:** [B3.1 CRLF/hash tests](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42954533764) PASS (12 tests); [B3.4 safe resume tests](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42954795483) PASS (15 tests).

**Unchanged blocker:** The owner's actual archive still needs in-place verification. Full disposable Supabase Auth/RLS/financial replay and subscription integration are not approved. This update is confined to offline recovery tooling; no production database, credentials, player records, billing or migration files were changed.


## Owner validation addendum — protected local archive attested (11 November 2026)

The owner subsequently pulled the tested Windows line-ending repair and ran the **existing-archive finalization** in VS Code PowerShell. Their displayed output was:

```json
{
  "migration_versions": 82,
  "original_statement_elements": 168,
  "source_hashes_verified_before_archive": true,
  "ready_for_disposable_replay": false
}
```

This confirms the **local B3.4 archive-integrity gate passed** according to the owner's terminal output. The finalization path validates the existing B2.7 private source archive and all 168 original element hashes and creates only sanitized attestation metadata. The private archive itself was **not uploaded to or independently inspected from GitHub**. Earlier sections describing export as PENDING document the state *before* this owner verification and are superseded by this addendum.

**Still unapproved:** the 14 historical data/procedural migrations, full parser/privilege and RLS equivalence, actual disposable Supabase replay, and PS-L2.3 subscription integration. Do not copy the private SQL archive into Git, run it against hosted Supabase or infer replay approval from source integrity.

