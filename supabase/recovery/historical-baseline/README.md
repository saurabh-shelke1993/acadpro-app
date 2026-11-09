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
