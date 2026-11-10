#!/usr/bin/env python3
"""B3.4: Import privately exported Supabase SQL Editor CSV without DB password.

The SQL Editor export MUST contain one column named migration_json and row_to_json
of version, name, statements. All 82 records and all 168 source elements are
fingerprint-verified BEFORE archive creation. SQL never goes to GitHub.
No SQL is executed, no database accessed, no production migration repaired.
"""
import argparse
import csv
import json
import os
from pathlib import Path
import sys

from b3_3_original_source_audit import (
    EVIDENCE, verify_original_element_hashes, analyze,
)
from b3_1_assembly_manifest import PARITY
from run_verified_private_archive import (
    validate_remote_before_export, build_private_archive,
)

EXPECTED_VERSIONS = 82
EXPECTED_ELEMENTS = 168
MAX_CSV_BYTES = 5_000_000
MAX_TOTAL_BYTES = 15_000_000


def read_csv_exports(folder):
    folder = Path(folder).resolve(strict=True)
    if not folder.is_dir() or folder.is_symlink():
        raise ValueError("Source must be a private, non-symlink CSV folder")
    files = sorted(folder.glob("*.csv"))
    if not files or len(files) > 20:
        raise ValueError("Expected 1–20 SQL Editor CSV files")
    if sum(p.stat().st_size for p in files) > MAX_TOTAL_BYTES:
        raise ValueError("CSV export size exceeds review-only limit")
    records = []
    for file in files:
        if file.is_symlink() or not file.is_file() or file.stat().st_size > MAX_CSV_BYTES:
            raise ValueError("Unsafe or oversized CSV source")
        with file.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream, strict=True)
            if reader.fieldnames != ["migration_json"]:
                raise ValueError("CSV must contain only the migration_json column")
            for row in reader:
                if len(records) >= EXPECTED_VERSIONS:
                    raise ValueError("More original records than expected")
                if None in row or not isinstance(row.get("migration_json"), str):
                    raise ValueError("Malformed SQL Editor CSV row")
                try:
                    data = json.loads(row["migration_json"])
                except json.JSONDecodeError as error:
                    raise ValueError("Malformed row_to_json migration record") from error
                if not isinstance(data, dict) or set(data) != {"version", "name", "statements"}:
                    raise ValueError("Unexpected migration JSON fields")
                if (not isinstance(data["version"], str)
                        or not isinstance(data["name"], str)
                        or not isinstance(data["statements"], list)
                        or not all(isinstance(s, str) for s in data["statements"])):
                    raise ValueError("Malformed historical SQL source record")
                records.append(data)
    if len(records) != EXPECTED_VERSIONS:
        raise ValueError("Original SQL CSV export is incomplete")
    versions = [item["version"] for item in records]
    if len(set(versions)) != EXPECTED_VERSIONS:
        raise ValueError("Duplicate historical migration version")
    records.sort(key=lambda item: item["version"])
    return records


def preverify(root, records):
    """Precheck migration-wide AND individual original statement fingerprints."""
    root = Path(root).resolve(strict=True)
    parity = json.loads((root / PARITY).read_text(encoding="utf-8"))
    evidence = json.loads((root / EVIDENCE).read_text(encoding="utf-8"))
    if (parity.get("project_id") != evidence.get("project_id")
            or parity.get("project_id") != "ulyealhkmlorsbdiknrh"):
        raise ValueError("Fingerprint inventories belong to different projects")
    if len(records) != EXPECTED_VERSIONS:
        raise ValueError("Incomplete original migration source")
    validate_remote_before_export(records, parity)
    lookup = {item["version"]: (item["name"], item["statements"]) for item in records}
    if (len(evidence["items"]) != EXPECTED_ELEMENTS
            or verify_original_element_hashes(evidence["items"], lookup) != EXPECTED_ELEMENTS):
        raise ValueError("Incomplete original SQL statement hash verification")
    return {"migration_versions": EXPECTED_VERSIONS,
            "original_statement_elements": EXPECTED_ELEMENTS,
            "source_hashes_verified_before_archive": True,
            "ready_for_disposable_replay": False}


def import_csv_archive(root, csv_directory, output):
    root = Path(root).resolve(strict=True)
    csv_directory = Path(csv_directory).resolve(strict=True)
    output = Path(output).resolve()
    migrations = (root / "supabase/migrations").resolve(strict=True)
    private_root = (root / "supabase/recovery/historical-baseline/.recovery-private").resolve()
    if not csv_directory.is_relative_to(private_root):
        raise ValueError("Keep SQL Editor CSV downloads inside ignored .recovery-private")
    if not output.is_relative_to(private_root) or output == private_root:
        raise ValueError("Archive must be in a new ignored .recovery-private subfolder")
    if output.is_relative_to(csv_directory) or csv_directory.is_relative_to(output):
        raise ValueError("CSV source folder and output archive must be separate")
    if output.exists() or output.is_relative_to(migrations):
        raise ValueError("Refusing to overwrite existing or canonical migration path")

    # Do not create a folder or write a single SQL byte until every input
    # has passed the pinned original source and per-element hash checks.
    records = read_csv_exports(csv_directory)
    verified = preverify(root, records)
    os.umask(0o077)
    built = build_private_archive(records, migrations, output, root / PARITY)
    inspected = analyze(root, output)
    if (not inspected["all_168_element_hashes_verified_from_private_archive"]
            or not inspected["private_archive_source_matched_to_live_fingerprints"]):
        raise ValueError("Full private source attestation not complete")
    attestation = {
        "schema": "kheltriva-b3-4-dashboard-export-attestation-v1",
        "source_method": "Supabase SQL Editor row_to_json CSV export, private import, offline",
        **verified,
        "private_archive_integrity_checked": True,
        "all_168_element_hashes_verified_from_private_archive": True,
        "historical_sql_content_verified": built["source_hash_verified"],
        "historical_sql_replay_approved": False,
        "ready_for_disposable_replay": False,
        "ready_for_production": False,
        "sql_bodies_embedded": False,
        "manual_security_and_ddl_review": "PENDING",
    }
    (output / "b3-4-dashboard-attestation.json").write_text(
        json.dumps(attestation, indent=2) + "\n", encoding="utf-8"
    )
    return attestation


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--csv-directory", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        outcome = import_csv_archive(args.root, args.csv_directory, args.output)
        print(json.dumps({
            "migration_versions": outcome["migration_versions"],
            "original_statement_elements": outcome["original_statement_elements"],
            "source_hashes_verified_before_archive": outcome["source_hashes_verified_before_archive"],
            "ready_for_disposable_replay": False,
        }, indent=2))
        return 0
    except (ValueError, OSError, csv.Error, KeyError, TypeError,
            json.JSONDecodeError) as exc:
        # Never print source SQL, the CSV row, credentials or private literals.
        print("B3.4 private SQL import refused: " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
