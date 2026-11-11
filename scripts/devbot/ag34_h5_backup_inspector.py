#!/usr/bin/env python3
"""AG34-H5: verify PRIVATE H4 logical SQL export integrity/coverage only.

Runs entirely on the user's computer. Does not connect to Supabase, execute
the SQL, print payloads or claim full restore recoverability. Requires the
original H4 SHA-256 checksums for both files (not checksums of new exports).
"""
from __future__ import annotations
import argparse
import hashlib
import re
import sys
from pathlib import Path

SCHEMA_FILE = "schema_public_auth_storage_migrations.sql"
DATA_FILE = "data_public_auth_storage_migrations.sql"
ROLES_FILE = "roles.sql"
REQUIRED_TABLES = (
    ("public", "academies"),
    ("public", "players"),
    ("public", "coach_batch_assignments"),
    ("auth", "users"),
    ("storage", "objects"),
    ("supabase_migrations", "schema_migrations"),
)
SQL_TABLE = rb'"?%s"?\s*\.\s*"?%s"?'
HEX_SHA = re.compile(r"^[0-9a-fA-F]{64}$")


class BackupGateError(Exception):
    """Sanitized failure message. Never expose SQL, table rows or user identities."""


def safe_file(folder: Path, name: str) -> Path:
    path = folder / name
    if not path.is_file() or path.is_symlink() or path.stat().st_size < 100:
        raise BackupGateError(f"{name}: missing, symlinked or suspiciously small")
    if path.resolve().parent != folder.resolve():
        raise BackupGateError(f"{name}: resolved outside private backup directory")
    return path


def scan_file(path: Path, patterns: dict[str, bytes]) -> tuple[str, dict[str, bool]]:
    digest = hashlib.sha256()
    found = {key: False for key in patterns}
    compiled = {key: re.compile(rx, re.IGNORECASE) for key, rx in patterns.items()}
    window = b""
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            if b"\x00" in block:
                raise BackupGateError(f"{path.name}: binary/NUL content in SQL export")
            digest.update(block)
            region = window + block
            for name, regex in compiled.items():
                if not found[name] and regex.search(region):
                    found[name] = True
            window = region[-4096:]
    return digest.hexdigest(), found


def coverage_patterns(prefix: bytes) -> dict[str, bytes]:
    patterns = {}
    for schema, table in REQUIRED_TABLES:
        target = SQL_TABLE % (schema.encode(), table.encode())
        patterns[f"{schema}.{table}"] = prefix + rb"\s+" + target + rb"(?:\s|\(|;)"
    return patterns


def inspect(folder: Path, expected_schema: str, expected_data: str,
            require_roles: bool = True) -> dict[str, object]:
    if not HEX_SHA.fullmatch(expected_schema) or not HEX_SHA.fullmatch(expected_data):
        raise BackupGateError("Both original H4 SHA-256 digests must be 64 hex characters")
    folder = folder.expanduser().resolve()
    if not folder.is_dir():
        raise BackupGateError("Private backup directory not found")
    # Fail closed: inspecting a Git checkout or the public GitHub workspace is not safe.
    if any((parent / ".git").exists() for parent in (folder, *folder.parents)):
        raise BackupGateError("Backup folder is located inside a Git working tree")
    schema = safe_file(folder, SCHEMA_FILE)
    data = safe_file(folder, DATA_FILE)
    create = coverage_patterns(rb"\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?")
    inserts = coverage_patterns(rb"\bINSERT\s+INTO")
    schema_digest, schema_found = scan_file(schema, create)
    data_digest, data_found = scan_file(data, inserts)
    if schema_digest.lower() != expected_schema.lower():
        raise BackupGateError("Schema SQL SHA-256 does not match original H4 output")
    if data_digest.lower() != expected_data.lower():
        raise BackupGateError("Data SQL SHA-256 does not match original H4 output")
    missing_schema = [key for key, yes in schema_found.items() if not yes]
    missing_data = [key for key, yes in data_found.items() if not yes]
    if missing_schema:
        raise BackupGateError("Schema export missing expected critical CREATE TABLE markers: " +
                              ", ".join(missing_schema))
    if missing_data:
        raise BackupGateError("Data export missing expected nonempty table INSERT markers: " +
                              ", ".join(missing_data))
    if require_roles:
        roles = safe_file(folder, ROLES_FILE)
        role_sha, markers = scan_file(
            roles, {"role_commands": rb"\b(CREATE|ALTER|GRANT)\s+ROLE\b|\bGRANT\b"})
        if not markers["role_commands"]:
            raise BackupGateError("Roles dump lacks role/privilege commands")
    else:
        role_sha = None
    return {
        "schema_sha256_match": True,
        "data_sha256_match": True,
        "critical_table_schemas_detected": len(schema_found),
        "critical_nonempty_table_data_detected": len(data_found),
        "roles_dump_present": bool(require_roles),
        "roles_sha256_generated": bool(role_sha),
        "restorability": "NOT_TESTED",
        "storage_file_bytes": "NOT_INCLUDED_IN_SQL_EXPORT",
        "point_in_time_consistency": "NOT_PROVEN",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Local-only AG34-H5 private SQL verification")
    parser.add_argument("--backup-directory", required=True, type=Path)
    parser.add_argument("--schema-sha256", required=True)
    parser.add_argument("--data-sha256", required=True)
    parser.add_argument("--skip-roles", action="store_true",
                        help="Only for diagnosing original H4 backups. Cannot pass H5 roles gate.")
    args = parser.parse_args()
    try:
        state = inspect(args.backup_directory, args.schema_sha256, args.data_sha256,
                        require_roles=not args.skip_roles)
    except (BackupGateError, OSError, ValueError) as e:
        err = str(e) if isinstance(e, BackupGateError) else "Private backup file unreadable"
        print("AG34-H5 STOP: " + err)
        return 2
    print("AG34-H5 PASS: original SHA-256 integrity, six critical schema tables, " +
          "six nonempty table export markers, roles export present.")
    print("AG34-H5 RECOVERY GATE: NOT VERIFIED — no isolated SQL restore executed.")
    print("AG34-H5 STORAGE: SQL metadata does not contain the underlying object files.")
    print("AG34-H5 STOP: NO HOSTED DDL OR MIGRATION EXECUTED.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
