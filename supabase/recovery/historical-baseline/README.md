# PS-L2.3B — Quarantined historical migration evidence

This is an **inspection-only** recovery tool. It reads `supabase_migrations.schema_migrations` and exports individual historical SQL statement arrays without executing them. It never updates `supabase/migrations/`, the hosted database, or billing records.

## Preconditions

- Confirm branch `payment-module-finalization` and active project `ulyealhkmlorsbdiknrh`.
- Connect as a database role restricted to **SELECT** on migration metadata wherever possible.
- PostgreSQL `psql` on PATH and Python 3.10+.
- Work from repository root. Output may include historical identifiers, secrets, or data repair statements.

## Export (read only)

```bash
export PGHOST='...host...' PGUSER='...read_only_user...' PGDATABASE='postgres'
# Set PGPASSWORD securely in your shell; do not enter it on the command line
python supabase/recovery/historical-baseline/export_migrations.py --migrations supabase/migrations --output supabase/recovery/historical-baseline/.recovery-private/baseline-001
python supabase/recovery/historical-baseline/export_migrations.py --output supabase/recovery/historical-baseline/.recovery-private/baseline-001 --verify-only
unset PGPASSWORD
python -m unittest discover -s supabase/recovery/historical-baseline -p 'test_*.py' -v
```

Never commit raw output. Inspect for PII, data backfills, destructive SQL, secrets, security-definer functions, and authorization grants before any sanitized archival or local replay. The manifest compares **version IDs only**, not SQL equivalence. The `sha256` covers a compact UTF-8 JSON array of statement strings, retaining order and statement boundaries. No exported file is an executable migration.

Observed 2026-11-09 checkpoint: 82 remote records, 40 repository SQL files, 23 matching version IDs, 59 remote-only versions, 17 local-only files, and two files sharing version `20260926133000`. These are not content-equivalence counts.

Future replay must be performed solely against a disposable unlinked database, after reviewed migration ordering, user-data quarantine, helper origin identification, and explicit phase approval. Never modify hosted migration history.

## B2.3 dependency audit (offline only)

After a **private** export has passed manual sensitive-SQL review, execute:

```bash
python supabase/recovery/historical-baseline/analyze_replay_dependencies.py \
  --archive supabase/recovery/historical-baseline/.recovery-private/baseline-001 \
  --output supabase/recovery/historical-baseline/.recovery-private/dependency-audit-001.json
```

This outputs **metadata only**; SQL is never executed. All items remain `replay_approved=false`. The scanner is a heuristic: a flagged missing dependency or DML operation requires manual SQL inspection. It cannot prove object or tenant security correctness.

See `frontend/docs/PS_L2_3B_B2_3_B2_4_DEPENDENCY_REVIEW_20261109.md` for verified live historical gaps.

## B2.4 historical SQL content parity (offline)

After extracting **and integrity-checking** all 82 original statement arrays in a private, ignored directory, compare the Git tree's local SQL files without executing any SQL:

```bash
python supabase/recovery/historical-baseline/compare_migration_content.py \
  --archive supabase/recovery/historical-baseline/.recovery-private/baseline-001 \
  --migrations supabase/migrations \
  --output supabase/recovery/historical-baseline/.recovery-private/parity-001.json
```

Only three narrowly bounded content matches are accepted: **byte-identical**, **exactly one appended LF**, or **exactly one removed leading LF**. The tool reports same-version content divergences and no-content-matches as unresolved, and flags local timestamp collisions. It compares **all local files to all remote rows**, not just same-version pairs. It verifies SHA-256 of the quarantined statement arrays first. It never executes SQL, changes Git files, or authorizes replay.

Read-only live fingerprints and the pinned Git blob hashes are recorded in `parity-fingerprints-readonly-20261109.json` (schema v2). The current snapshot proves **17 byte-exact + 6 terminal-LF-only + 2 leading-LF-only = 25 content links**. Of these, 8 use retimestamped local files. **Six same-version SQL divergences and 51 remote records with no Git content match remain.** Fifteen tracked local files have no content-matched remote record. These are provenance gaps, not a reason to rewrite deployed migration history.

The live fingerprint inventory was collected by SELECT-only catalog queries, without exporting raw historical SQL into Git. Raw archive extraction and all semantic/deterministic replay checks remain pending. This is an **evidence-only** checkpoint. See `frontend/docs/PS_L2_3B_B2_4_SQL_CONTENT_PARITY_20261109.md` for recovery candidate ordering and review stops.

## B2.5 fail-closed review candidate (metadata only)

This step uses the committed **metadata-only**, read-only evidence files. It does **not** execute SQL, does **not** export raw SQL, does **not** create a runnable migration folder, and does **not** approve replay.

```bash
python supabase/recovery/historical-baseline/build_review_candidate.py \
  --parity supabase/recovery/historical-baseline/parity-fingerprints-readonly-20261109.json \
  --review supabase/recovery/historical-baseline/review-queue-readonly-20261110.json \
  --output supabase/recovery/historical-baseline/.recovery-private/b2-5-review-candidate.json
```

Expected result: 82 historical records, `ready_for_disposable_replay=false`, `ready_for_production=false`, all entries `PENDING`. Any manually changed approved state or missing security gate causes validation failure. The output is a **blocked review plan**, not a migration.

See `frontend/docs/PS_L2_3B_B2_5_REVIEW_GATE_20261110.md` for the six same-version SQL discrepancies and mandatory evidence to collect before B3.

## B2.6 direct SQL statement-risk review

After a complete private export and `--verify-only` pass, run:

```bash
python supabase/recovery/historical-baseline/inspect_historical_statements.py \
  --archive supabase/recovery/historical-baseline/.recovery-private/baseline-001 \
  --output supabase/recovery/historical-baseline/.recovery-private/direct-dml-triage-001.json
```

This **never runs SQL** and emits no quoted literal values. It masks comments, strings, double-quoted identifiers and dollar bodies, then classifies top-level INSERT/UPDATE/DELETE and procedural DO statements. It will **not** reliably identify side effects inside procedures, function bodies, dynamic SQL, or complex CTEs. Every migration remains `replay_approved=false`.

A direct read-only source inspection of 82 historical records already yielded 11 migration versions containing 20 top-level data-changing statements, plus 7 versions containing DO blocks. See `frontend/docs/PS_L2_3B_B2_6_SOURCE_SQL_TRIAGE_20261110.md` and `statement-risk-screen-readonly-20261110.json`. This is not a substitute for the still-pending privately archived original SQL source and human review.


## B2.7 — One-command PRIVATE source archive and pinned attestation

**Use this workflow, rather than repeatedly running individual metadata scripts, when the database connection is configured locally.** Never send passwords or raw historical SQL to GitHub, CI logs or ChatGPT. This command runs **SELECT only** against Supabase. It saves the SQL statement arrays in an ignored folder on your own computer. It does **not** run any historical migration SQL.

From the AcadPro repository root (Windows Git Bash / Linux / macOS):

1. Check `psql --version` and `python --version`. Use PostgreSQL's current `psql` binary and Python 3.11+.
2. Obtain the active project's **Session Pooler** host and username in Supabase **Connect** (project `ulyealhkmlorsbdiknrh`). Do not copy the credentials into code or Git.
3. Configure a locally authorized **SELECT-only** database account if one exists. Otherwise a database account with permissions to read `supabase_migrations.schema_migrations` is needed. The exporter explicitly requests read-only transactions; this is a safety guard and not a replacement for server-side least privilege.
4. Set the environment in your terminal:

```bash
export PGHOST='SESSION_POOLER_HOST_FROM_SUPABASE_CONNECT'
export PGPORT=5432
export PGUSER='DATABASE_USER_FROM_SUPABASE_CONNECT'
export PGDATABASE=postgres
export PGSSLMODE=require
read -rs -p 'Database password (not echoed): ' PGPASSWORD; echo
export PGPASSWORD
```

Then run the **single recovery command** (use a fresh archive suffix if one already exists):

```bash
python supabase/recovery/historical-baseline/run_verified_private_archive.py \
  --migrations supabase/migrations \
  --expected-parity supabase/recovery/historical-baseline/parity-fingerprints-readonly-20261109.json \
  --output supabase/recovery/historical-baseline/.recovery-private/baseline-001
unset PGPASSWORD
```

The workflow performs all of these steps automatically:

- Fetches remote migration history with **read-only SQL** using the existing exporter; validates **all 82** migration names, versions, exact statement counts, SQL UTF-8 byte lengths and Git-blob fingerprints against the committed, read-only evidence **before any raw SQL is written**. Any mismatch stops without creating the archive.
- Creates an ignored `.recovery-private/baseline-001/` directory with restrictive file permissions where supported by the OS. Saves 82 raw SQL statement arrays and their SHA-256 manifest.
- Independently verifies every SQL array against the pinned fingerprints and writes `archive-attestation.json`.
- Runs the strict Git migration-content comparison and statement-risk inspection **offline**. Writes `content-parity.json` and `sql-statement-risk-review.json`.
- Reports **ready_for_disposable_replay=false** and **ready_for_production=false** even on an integrity PASS. A verified archive is not authorization to replay SQL.

Expected verified-history counters from 10 November 2026 are **82 records, 168 original statement-array elements**. The source may have changed since the fingerprint checkpoint; do not bypass the gate if it reports a drift.

To verify a previously exported local archive again **without a database connection**:

```bash
python supabase/recovery/historical-baseline/run_verified_private_archive.py \
  --verify-only \
  --expected-parity supabase/recovery/historical-baseline/parity-fingerprints-readonly-20261109.json \
  --output supabase/recovery/historical-baseline/.recovery-private/baseline-001
```

The above outputs are **private working evidence**, not committed migrations. Share only sanitized summaries and approval statuses in the next development checkpoint; do not commit or paste raw SQL containing player, parent or payment identifiers.

**Alternate fetch method:** Supabase CLI v3 documents `supabase migration fetch --remote` for retrieving migration files from the history table. If used, run `supabase migration fetch --help` and perform the fetch inside a separately initialized scratch workspace — never within the current tracked `supabase/migrations` directory. Those fetched files must still pass the exact source-fingerprint review before use. The canonical B2.7 workflow above preserves statement arrays explicitly.

The next action *after* a successful private archive is a source/privilege review and controlled disposable Supabase replay design. A full live-history replica has **not yet** been executed or approved.


## B3.1 — Original migration sequence assembly (review-only)

This stage does **not** require a database password, `psql`, Docker or full local Supabase. It produces **metadata-only JSON** from the committed B2.4–B2.6 evidence and checks Git SQL source integrity.

From the repository root in VS Code PowerShell:

```powershell
python supabase/recovery/historical-baseline/b3_1_assembly_manifest.py --root . --output "$env:TEMP\kheltriva_b3_1_review_only.json"
```

The output is **one entry per all 82 original migration versions**, with verified Git-content links where available and hard replay denial for every entry. It identifies **14 migrations requiring data/procedural quarantine review**, the six same-version differences, 51 no-content-match source records, duplicate `20260926133000` and the 12-digit `202610210001` local version. It proposes a **non-executable** placement window for the B2.9 live-helper snapshot, *not* approval to run or retimestamp it.

GitHub Actions [42882011251](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42882011251) **PASSED nine tests**, and published the 82-entry metadata-only report as artifact `kheltriva-b3-1-assembly-review-only` (14-day retention).

Do not copy the B2.9 fixture into `supabase/migrations`, combine it with the older seven-helper CI fixture or run the existing full local Supabase workflow based on this manifest. Full original SQL archiving, historical data fixes, authorization ordering, Auth/RLS/finance parity and the PS-L2.3 proposal remain blocked. See `frontend/docs/PS_L2_3B_B3_1_HISTORICAL_ASSEMBLY_REVIEW_20261111.md`.


## B3.2 — Historical SQL source reconciliation, review-only

B3.2 generates an **82-migration metadata decision matrix**. It does not generate or execute SQL and does not modify `supabase/migrations/`.

From the repository root in PowerShell:

```powershell
python supabase/recovery/historical-baseline/b3_2_reconciliation_design.py --root . --output "$env:TEMP\kheltriva_b3_2_review_only.json"
```

Source evidence: `b3_2_six_divergences_review_20261111.json`. The design keeps **25 strict Git-content links**, **6 same-version divergences**, **51 no-content-match remote rows**, **8 retimestamped links**, **14 data/procedural quarantine cases**, the duplicate `20260926133000` and irregular 12-digit filename explicitly unresolved. The initial schema's 17 detected CREATE declarations align by name, but SQL semantics and RLS/security/constraints do **not** have approved parity.

GitHub Actions [42883854807](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42883854807) **PASS (10 tests)**. The workflow publishes metadata-only artifact `kheltriva-b3-2-reconciliation-review-only` for 14 days.

Every migration entry still has `replay_approved=false`. Do not execute historical customer-specific cleanup SQL, inject the current helper fixture into original history, rewrite tracked migration timestamps or apply the PS-L2.3 candidate. Further steps require privately verified original SQL, manual security/statement review and a disposable Supabase-only environment.

See `frontend/docs/PS_L2_3B_B3_2_SOURCE_RECONCILIATION_20261111.md`.
