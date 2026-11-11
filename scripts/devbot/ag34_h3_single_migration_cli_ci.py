#!/usr/bin/env python3
"""AG34-H3: isolated CLI migration fetch/up, exact one-version atomicity rehearsal.

No credentials for hosted Supabase. The --remote URL points ONLY to the
existing disposable native Supabase DB at 127.0.0.1:54322.
Never uses the checkout's incomplete 41-file migration directory.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path
import sys

import ag3_4b_live_mapping_ci as b
import ag34_h1_legacy_lockdown_ci as h1
import ag34_h2_rollout_rehearsal_ci as h2

ROOT = Path(__file__).resolve().parents[2]
VERSION = "20261111165330"
MIGRATION = h2.MIGRATION
LOCAL_DATABASE = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
TEMP_PROJECT = "kheltriva-ag34-h3-fetch-only"
TOTAL_HISTORICAL = 82


def cli(args: list[str], cwd: Path, *, succeed: bool = True) -> str:
    if args[:1] != ["supabase"] or not cwd.is_relative_to(
            Path(os.environ.get("RUNNER_TEMP", "/no-runner")).resolve()):
        raise b.SecurityMismatch("AG34-H3 refused non-disposable CLI invocation")
    if len(args) >= 3 and args[1:3] == ["migration", "up"]:
        if "--yes" not in args:
            raise b.SecurityMismatch("AG34-H3 migration up requires explicit scratch-only consent")
    if any("remote" in x for x in args):
        if not any(x == "--remote=" + LOCAL_DATABASE for x in args):
            raise b.SecurityMismatch("AG34-H3 command tried a nonlocal database")
    if os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_DB_URL"):
        raise b.SecurityMismatch("AG34-H3 hosted connection variables prohibited")
    run = subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                         timeout=120, check=False)
    if (run.returncode == 0) != succeed:
        raise b.SecurityMismatch("AG34-H3 CLI result differed from expected fail/success")
    return run.stdout + run.stderr if succeed else ""


def sql_value(query: str) -> str:
    return b.sql("-At", "-c", query).strip()


def ledger_digest() -> str:
    return sql_value("""
      SELECT md5(string_agg(version || ':' || coalesce(name,'') || ':' ||
              coalesce(array_to_string(statements,';'),''), '|' ORDER BY version))
      FROM supabase_migrations.schema_migrations
      WHERE version <> '20261111165330';""")


def seed_mock_remote_history() -> str:
    # Invented rows/SQL; these are NOT the 82 real hosted migrations.
    # "migration fetch" must read and create 82 local files without replay.
    b.sql("-c", """CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version text NOT NULL PRIMARY KEY, statements text[], name text);
      INSERT INTO supabase_migrations.schema_migrations(version,name,statements)
      SELECT to_char(timestamp '2026-01-01' + g * interval '1 second',
              'YYYYMMDDHH24MISS'), 'invented_applied_' || lpad(g::text,3,'0'),
             ARRAY['SELECT 1']
      FROM generate_series(0,81) g;""")
    if sql_value("SELECT count(*) FROM supabase_migrations.schema_migrations") != "82":
        raise b.SecurityMismatch("AG34-H3 synthetic history is not 82 applied versions")
    return ledger_digest()


def verify_history_workdir(workspace: Path, historical: set[str], with_pending: bool) -> None:
    files = list((workspace / "supabase/migrations").glob("*.sql"))
    versions = [p.name.split("_",1)[0] for p in files]
    needed = historical | ({VERSION} if with_pending else set())
    if len(files) != len(needed) or set(versions) != needed:
        raise b.SecurityMismatch("AG34-H3 fetched ledger/source names differ from scratch history")
    if any(p.name.count("/") or not re.fullmatch(r"[0-9]{14}_[A-Za-z0-9_]+\.sql",p.name)
           for p in files):
        raise b.SecurityMismatch("AG34-H3 migration file path invalid")
    if not (workspace / "supabase/config.toml").is_file():
        raise b.SecurityMismatch("AG34-H3 isolated CLI config absent")
    if (workspace / "supabase/.temp/project-ref").exists():
        raise b.SecurityMismatch("AG34-H3 isolated CLI unexpectedly linked")


def check_legacy_unhardened(snapshot: str) -> None:
    if b.db_counts() != "9|8|0|4|11":
        raise b.SecurityMismatch("AG34-H3 failed run must leave four original policies")
    if sql_value("SELECT has_table_privilege('authenticated','public.coach_batches','INSERT')") != "t":
        raise b.SecurityMismatch("AG34-H3 failed migration incorrectly revoked grants")
    if sql_value("SELECT count(*) FROM supabase_migrations.schema_migrations") != "82":
        raise b.SecurityMismatch("AG34-H3 failed migration incorrectly recorded version")
    if ledger_digest() != snapshot:
        raise b.SecurityMismatch("AG34-H3 failure changed prior history")


def prove_cli_single_version(key: str, tokens: dict[str,str]) -> None:
    if set(tokens) != set(h1.ROLE_NAMES):
        raise b.SecurityMismatch("AG34-H3 role JWT fixture changed")
    h1.check_scratch_baseline()
    h2.verify_cli_migration_body()
    # Only remove three invented fixture rows, never hosted data.
    b.sql("-c","DELETE FROM public.coach_batches WHERE id IN (" +
          ",".join("'" + x + "'::uuid" for x in sorted(h1.EXPECTED_IDS)) + ");")
    if b.db_counts() != "9|8|0|4|11":
        raise b.SecurityMismatch("AG34-H3 scratch pre-migration rows not empty")
    before = seed_mock_remote_history()
    raw = sql_value("SELECT version FROM supabase_migrations.schema_migrations ORDER BY version")
    previous = set(raw.splitlines())
    if len(previous) != TOTAL_HISTORICAL or VERSION in previous:
        raise b.SecurityMismatch("AG34-H3 historical/version baseline changed")

    run_root = Path(os.environ.get("RUNNER_TEMP", "/non-runner")).resolve()
    workspace = run_root / TEMP_PROJECT
    if workspace.exists() or not os.environ.get("GITHUB_ACTIONS") == "true":
        raise b.SecurityMismatch("AG34-H3 isolated workspace not clean")
    workspace.mkdir(parents=True)
    try:
        cli(["supabase","init","--yes"],workspace)
        # Official v3 migration fetch reads stored migrations and writes
        # only into the isolated filesystem directory. It does not apply them.
        cli(["supabase","migration","fetch","--remote=" + LOCAL_DATABASE],workspace)
        verify_history_workdir(workspace,previous,False)
        if ledger_digest() != before:
            raise b.SecurityMismatch("AG34-H3 CLI fetch changed applied history")
        target = workspace / "supabase/migrations" / MIGRATION.name
        content = MIGRATION.read_text(encoding="utf-8")
        if "\nBEGIN;\n" in content or "\nCOMMIT;\n" in content:
            raise b.SecurityMismatch("AG34-H3 CLI migration still owns boundaries")

        # A deliberate failure *after* RLS DDL must roll back everything,
        # including access revocation and migration history. Scratch only.
        target.write_text(content + "\nSELECT 1/0;\n",encoding="utf-8")
        verify_history_workdir(workspace,previous,True)
        cli(["supabase","migration","up","--remote=" + LOCAL_DATABASE,"--yes"],
            workspace,succeed=False)
        check_legacy_unhardened(before)
        target.write_text(content,encoding="utf-8")
        # One and only one filename has no matching applied version.
        if sql_value("SELECT count(*) FROM supabase_migrations.schema_migrations") != "82":
            raise b.SecurityMismatch("AG34-H3 extra pending history before CLI up")
        cli(["supabase","migration","up","--remote=" + LOCAL_DATABASE,"--yes"],workspace)
        if sql_value("SELECT count(*) FROM supabase_migrations.schema_migrations") != "83":
            raise b.SecurityMismatch("AG34-H3 CLI did not record exactly one new version")
        if sql_value("SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='"+
                     VERSION+"' AND name='ag34_h1_legacy_coach_batches_client_lockdown'") != "1":
            raise b.SecurityMismatch("AG34-H3 CLI did not preserve canonical version/name")
        if ledger_digest() != before:
            raise b.SecurityMismatch("AG34-H3 migration rewrote historical ledger entries")
        h1.assert_no_client_privileges()
        h2.verify_postflight_sql()

        for name in h1.ROLE_NAMES:
            token = tokens[name]
            h1.must_get_denied(key,token)
            for method in ("POST","PATCH","DELETE"):
                h1.must_write_denied(key,token,method)
        h1.must_get_denied(key,None)
        b.ag32.read_scoped(key,tokens["coach_a"],[
            {"id":b.ag3.BATCH_A,"academy_id":b.ag3.ACADEMY_A}])
        b.ag32.read_scoped(key,tokens["owner_b"],[
            {"id":b.ag3.BATCH_B,"academy_id":b.ag3.ACADEMY_B}])

        # Same workspace and same CLI --remote scratch URL: duplicate is a no-op.
        cli(["supabase","migration","up","--remote=" + LOCAL_DATABASE,"--yes"],workspace)
        if sql_value("SELECT count(*) FROM supabase_migrations.schema_migrations") != "83":
            raise b.SecurityMismatch("AG34-H3 CLI repeat created duplicate history")
        print("AG34-H3 PASS: 82 fetched applied migrations, exactly one new "
              "CLI version, schema+ledger rollback on injected failure, JWT denial",
              flush=True)
    finally:
        shutil.rmtree(workspace,ignore_errors=True)


if __name__ == "__main__":
    sys.exit(b.main(on_live_snapshot=prove_cli_single_version))
