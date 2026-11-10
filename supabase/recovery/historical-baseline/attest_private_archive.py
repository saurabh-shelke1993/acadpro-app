#!/usr/bin/env python3
"""Verify a private historical SQL archive against read-only remote fingerprints.

No network calls, no SQL execution, and no SQL bodies or personal literals
included in the generated attestation. Does not approve any migration for replay.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

from export_migrations import verify


def git_blob_sha1(data):
    header = b"blob " + str(len(data)).encode("ascii") + b"\0"
    return hashlib.sha1(header + data).hexdigest()


def attest(archive, source_inventory):
    archive = Path(archive).resolve(strict=True)
    inventory = json.loads(Path(source_inventory).read_text(encoding="utf-8"))
    if inventory.get("schema") != "kheltriva-b2-4-content-fingerprint-v2":
        raise ValueError("Unexpected source fingerprint schema")

    reference = inventory.get("remote_rows")
    expected_count = inventory.get("summary", {}).get("remote_total")
    if not isinstance(reference, list) or expected_count != len(reference):
        raise ValueError("Reference migration count is inconsistent")
    if not reference:
        raise ValueError("Empty reference inventory")

    manifest = verify(archive)
    files = manifest.get("items")
    if not isinstance(files, list) or len(files) != expected_count:
        raise ValueError("Private archive is incomplete or has extra migrations")

    expected_versions = [r["remote_version"] for r in reference]
    actual_versions = [r["version"] for r in files]
    if (len(set(actual_versions)) != len(actual_versions)
            or actual_versions != expected_versions):
        raise ValueError("Migration versions/order do not match read-only source inventory")

    statement_total = 0
    byte_total = 0
    evidence = []
    for actual, expected in zip(files, reference):
        root = archive
        target = (root / actual["relative_path"]).resolve(strict=True)
        if not target.is_relative_to(root) or not target.is_file():
            raise ValueError("Unsafe archive file path")

        statements = json.loads(target.read_bytes())
        if not isinstance(statements, list) or any(not isinstance(s, str) for s in statements):
            raise ValueError("Expected exact string statement array")
        encoded = "".join(statements).encode("utf-8")
        actual_blob = git_blob_sha1(encoded)
        actual_bytes = len(encoded)
        if (actual["name"] != expected["remote_name"]
                or len(statements) != expected["remote_statement_count"]
                or actual_bytes != expected["remote_sql_bytes"]
                or actual_blob != expected["remote_git_blob_sha1"]):
            # No SQL body or potentially sensitive content in error messages.
            raise ValueError("Historical SQL source fingerprint mismatch at version "
                             + actual["version"])
        statement_total += len(statements)
        byte_total += actual_bytes
        evidence.append({
            "version": actual["version"],
            "source_git_blob_sha1": actual_blob,
            "archive_payload_sha256": actual["sha256"],
            "statement_count": len(statements),
            "replay_approved": False,
        })

    manifest_path = archive / "manifest.json"
    return {
        "schema": "kheltriva-b2-7-private-archive-attestation-v1",
        "source": "Pinned GitHub metadata + local SHA-256-checked historical SQL archive",
        "pinned_git_head": inventory["git_head_at_comparison"],
        "remote_project_id": inventory["project_id"],
        "remote_migration_count": len(evidence),
        "stored_statement_count": statement_total,
        "sql_source_bytes": byte_total,
        "manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "historical_sql_content_verified": True,
        "historical_privilege_baseline_verified": False,
        "reviewed_for_sensitive_literals": False,
        "ready_for_disposable_replay": False,
        "ready_for_production": False,
        "sql_bodies_embedded": False,
        "records": evidence,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--expected-parity", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise ValueError("Attestation output already exists")
        result = attest(args.archive, args.expected_parity)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "verified_migrations": result["remote_migration_count"],
            "verified_ledger_statements": result["stored_statement_count"],
            "historical_sql_content_verified": result["historical_sql_content_verified"],
            "ready_for_disposable_replay": result["ready_for_disposable_replay"],
        }, indent=2))
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"Private archive verification blocked: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
