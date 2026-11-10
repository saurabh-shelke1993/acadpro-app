#!/usr/bin/env python3
"""One-command, read-only and private historical SQL provenance checkpoint.

Never runs migration SQL, changes hosted database state, or writes in
supabase/migrations. Export must stay under a .recovery-private/ directory.
"""
import argparse
import json
import os
from pathlib import Path
import sys

from attest_private_archive import attest, git_blob_sha1
from compare_migration_content import compare
from export_migrations import export, get_remote_records
from inspect_historical_statements import inspect_archive


def validate_remote_before_export(records, inventory):
    """Pin full source identity in memory before any historical SQL is written."""
    if inventory.get("schema") != "kheltriva-b2-4-content-fingerprint-v2":
        raise ValueError("Unexpected pinned source fingerprint schema")
    expected = inventory.get("remote_rows")
    if (not isinstance(expected, list)
            or not expected
            or len(expected) != inventory.get("summary", {}).get("remote_total")
            or len(records) != len(expected)):
        raise ValueError("Remote migration count differs from pinned source")

    versions = set()
    for got, want in zip(records, expected):
        version = got.get("version")
        statements = got.get("statements")
        if version in versions:
            raise ValueError("Duplicate remote migration version")
        versions.add(version)
        if not isinstance(statements, list) or not all(isinstance(s, str) for s in statements):
            raise ValueError("Invalid remote SQL statement data")
        raw = "".join(statements).encode("utf-8")
        if (version != want["remote_version"]
                or got["name"] != want["remote_name"]
                or len(statements) != want["remote_statement_count"]
                or len(raw) != want["remote_sql_bytes"]
                or git_blob_sha1(raw) != want["remote_git_blob_sha1"]):
            raise ValueError("Remote ledger differs from the historical fingerprint at "
                             + str(version))
    return len(expected)


def build_private_archive(records, migrations, output, inventory_path):
    if ".recovery-private" not in output.parts:
        raise ValueError("Output must be inside a .recovery-private directory")
    if output.exists():
        raise ValueError("Output already exists: create a fresh, uniquely named archive")
    if not migrations.is_dir():
        raise ValueError("Migration source directory is missing")
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    validate_remote_before_export(records, inventory)

    os.umask(0o077)
    export(records, migrations, output)
    attestation = attest(output, inventory_path)
    content_parity = compare(output, migrations)
    sql_review = inspect_archive(output)

    # The following reports contain no historical SQL bodies or quoted values.
    for filename, report in (
            ("archive-attestation.json", attestation),
            ("content-parity.json", content_parity),
            ("sql-statement-risk-review.json", sql_review)):
        (output / filename).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return {
        "historical_sql_archived": True,
        "source_hash_verified": attestation["historical_sql_content_verified"],
        "remote_migrations": attestation["remote_migration_count"],
        "ledger_statement_entries": attestation["stored_statement_count"],
        "direct_top_level_dml": sql_review["summary"]["direct_data_statement_count"],
        "ready_for_disposable_replay": False,
        "ready_for_production": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--migrations", default=Path("supabase/migrations"), type=Path)
    parser.add_argument("--expected-parity", required=True, type=Path)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    try:
        if args.verify_only:
            result = attest(args.output, args.expected_parity)
            print(json.dumps({
                "remote_migrations": result["remote_migration_count"],
                "historical_sql_content_verified": result["historical_sql_content_verified"],
                "ready_for_disposable_replay": False,
            }, indent=2))
            return 0
        if not all(os.environ.get(key) for key in ("PGHOST", "PGUSER", "PGDATABASE")):
            parser.error("PGHOST, PGUSER and PGDATABASE required for read-only export")
        result = build_private_archive(
            get_remote_records(), args.migrations, args.output, args.expected_parity)
        print(json.dumps(result, indent=2))
        return 0
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print("Private SQL recovery blocked: " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
