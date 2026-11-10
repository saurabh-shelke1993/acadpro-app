# Kheltriva — PS-L2.3B B2.7 Private SQL Archive Readiness

**Date:** 10 November 2026 (Asia/Kolkata)  
**Branch:** `payment-module-finalization`  
**Hosted DB:** `ulyealhkmlorsbdiknrh`  
**Scope:** Local private export workflow, offline integrity attestation and tests. **No hosted writes.**

## Purpose

The previous phases B2.1–B2.6 retrieved and classified all 82 original remote migration histories but could not persist a protected, reconstructable copy of the SQL in the user's local workstation from the connected read-only Supabase tool. The B2.7 work introduces a reliable one-command workflow to close that operational gap **without** committing sensitive SQL or touching `supabase/migrations`.

Supabase CLI v3 also documents `supabase migration fetch --remote`, which can retrieve files from the history table. Because that command creates local migration files, it must only be run inside an isolated scratch workspace; its output must be compared to pinned fingerprints before being used as evidence.

## Source implemented

1. `supabase/recovery/historical-baseline/attest_private_archive.py`: validates all migration versions/order, original statement counts, UTF-8 source byte sizes and Git blob SHA-1 content fingerprints against committed `parity-fingerprints-readonly-20261109.json`. No SQL content is emitted in the attestation. The output remains `ready_for_disposable_replay=false` and `ready_for_production=false`.
2. `run_verified_private_archive.py`: validates **all 82 source hashes before writing any SQL**, uses read-only `psql` to retrieve archived statement arrays, writes to `.recovery-private/` with restrictive permissions where supported, independently validates SHA-256 hashes, generates exact-content parity and SQL-risk reports offline, and never executes a migration.
3. `export_migrations.py` strengthened: archive file paths and duplicate versions now verified, traversal outside the evidence root rejected, output creation attempts permission mode `077`.
4. Focused unit tests: complete/incomplete/wrong-order/altered-source/wrong-name/wrong-DB-hash/path-traversal/duplicate-version/overwrite and blocked replay assertions.
5. `README.md` contains the **one local execution command**, safe credential handling and offline re-verification command.

## Validation

- [GitHub Actions 42751093715](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42751093715) **PASS — 43 focused Python tests**, plus syntax compilation and B2.5/6 metadata gate assertions.
- Remote migration source at the last pinned evidence checkpoint: **82 records** and **168 stored SQL statement elements**; 25 strict source-content links to Git, 57 unresolved, 11 unproven foundation helpers.
- No real hosted private SQL export was performed to a user's local private filesystem by ChatGPT. CI uses synthetic fixture content, not live credentials.

## Exact operational blocker

A durable private SQL archive must be produced **once** from the user's trusted computer or other secured environment with permission to SELECT `supabase_migrations.schema_migrations` and a local `psql` binary. The connected Supabase tool can inspect SQL but cannot place a protected archive onto the owner's workstation. The script fails if hosted migration history has drifted since the read-only fingerprint checkpoint.

**Expected output, when run locally:** `.../.recovery-private/baseline-001/manifest.json`, `quarantine_sql/` with the 82 full original statement-array JSON files, `archive-attestation.json`, `content-parity.json`, and `sql-statement-risk-review.json`. This output is ignored by Git; do not upload unreviewed SQL or credentials to GitHub.

The raw archive remains **NOT GENERATED / NOT REVIEWED** in this development session. Therefore the B3 disposable Supabase replay is still **BLOCKED**. A fingerprint match proves source integrity, not completeness of the original authorization historical baseline; 11 helper origins and historic record-specific cleanup still require manual decisions.

## Status and next action

| Checkpoint | Status |
|---|---|
| B2.7 private archival tooling | IMPLEMENTED |
| B2.7 synthetic/CI tests | PASS (43) |
| B2.7 all-82 source identity pinning | IMPLEMENTED; synthetic tests PASS |
| B2.7 actual local private SQL archive | PENDING ONE OWNER-SIDE EXECUTION |
| Historical SQL sensitive review and 11 helper baseline origins | PENDING |
| B3 disposable Supabase migration replay | BLOCKED |
| B4 PS-L2.3 Auth/RLS/finance integration | NOT TESTED |
| Hosted database/payment/subscription changes | NONE |

Once the owner runs the command documented in `supabase/recovery/historical-baseline/README.md` and confirms the sanitized attestation summary, resume with B3 source review and temporary-only local Supabase reconstruction. Do not mark renewal or automatic dues as deployed.
