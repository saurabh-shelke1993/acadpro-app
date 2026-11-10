#!/usr/bin/env python3
"""Read-only Supabase migration evidence export. No DDL, replay or commits."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

VERSION = re.compile(r"^[0-9]{14}$")
NAME = re.compile(r"^[A-Za-z0-9_]+$")
SENSITIVE = re.compile(r"(?i)(?:password\s*=|service_role|\b(?:insert\s+into|update|delete\s+from|truncate)\b|auth\.users|\b(?:phone|email|token|secret)\b)")
QUERY = """SELECT row_to_json(m)::text FROM (
 SELECT version, name, statements FROM supabase_migrations.schema_migrations
 ORDER BY version, name
) m;"""


def digest(data):
    return hashlib.sha256(data).hexdigest()


def get_remote_records():
    env = os.environ.copy()
    env["PGOPTIONS"] = (env.get("PGOPTIONS", "") + " -c default_transaction_read_only=on").strip()
    result = subprocess.run(
        ["psql", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--quiet", "-c", QUERY],
        capture_output=True, text=True, env=env, check=True,
    )
    return [json.loads(line) for line in result.stdout.splitlines() if line.strip()]


def local_files(folder):
    found = {}
    for path in sorted(folder.glob("*.sql")):
        version = path.name.split("_", 1)[0]
        if VERSION.fullmatch(version):
            found.setdefault(version, []).append(path.name)
    return found


def export(records, migrations, output):
    if output.exists() and any(output.iterdir()):
        raise RuntimeError("Output directory must be empty to avoid replacing existing evidence")
    output.mkdir(parents=True, exist_ok=True)
    sql_dir = output / "quarantine_sql"
    sql_dir.mkdir()
    local = local_files(migrations)
    seen = set()
    items = []
    for record in records:
        version, name, statements = record["version"], record["name"], record["statements"]
        if not VERSION.fullmatch(version) or not NAME.fullmatch(name):
            raise ValueError("Unexpected version/name in remote ledger; export refused")
        if version in seen:
            raise ValueError(f"Duplicate remote version {version}; export refused")
        seen.add(version)
        if not isinstance(statements, list) or not all(isinstance(x, str) for x in statements):
            raise ValueError(f"Non-string or missing statements for {version}")
        # Lossless JSON preserves statement boundaries and ordering.
        payload = json.dumps(statements, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        path = sql_dir / f"{version}_{name}.statements.json"
        path.write_bytes(payload)
        local_names = local.get(version, [])
        flags = [i for i, statement in enumerate(statements) if SENSITIVE.search(statement)]
        items.append({
            "version": version, "name": name, "statement_count": len(statements),
            "sha256": digest(payload), "relative_path": str(path.relative_to(output)),
            "local_filenames": local_names, "version_match": bool(local_names),
            "manual_review_required": bool(flags) or not local_names,
            "flagged_statement_indexes": flags,
            "replay_approved": False, "content_equivalent_to_local": None,
        })
    local_only = {key: value for key, value in local.items() if key not in seen}
    local_collision = {key: value for key, value in local.items() if len(value) > 1}
    manifest = {
        "schema": "kheltriva-migration-provenance-v1",
        "source": "supabase_migrations.schema_migrations (SELECT-only)",
        "exported_record_count": len(items),
        "migration_file_count": sum(map(len, local.values())),
        "version_matched_count": sum(item["version_match"] for item in items),
        "remote_only_count": sum(not item["version_match"] for item in items),
        "local_only_versions": local_only,
        "local_version_collisions": local_collision,
        "statement_encoding": "UTF-8 JSON array, compact separators, order preserved",
        "items": items,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def verify(output):
    root = output.resolve(strict=True)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema") != "kheltriva-migration-provenance-v1":
        raise ValueError("Unexpected archive schema")
    items = manifest.get("items")
    if not isinstance(items, list):
        raise ValueError("Archive manifest must contain migration items")
    seen = set()
    for item in items:
        version = item["version"]
        if version in seen:
            raise ValueError("Duplicate migration in archive")
        seen.add(version)
        path = (root / item["relative_path"]).resolve(strict=True)
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError("Unsafe archive source path")
        contents = path.read_bytes()
        if digest(contents) != item["sha256"]:
            raise ValueError(f"Hash mismatch {version}")
        statements = json.loads(contents)
        if (not isinstance(statements, list)
                or any(not isinstance(x, str) for x in statements)
                or len(statements) != item["statement_count"]):
            raise ValueError(f"Statement count or type mismatch {version}")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--migrations", type=Path, default=Path("supabase/migrations"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    try:
        if not args.verify_only:
            # Restrict private SQL output permissions wherever the OS supports it.
            os.umask(0o077)
        if args.verify_only:
            manifest = verify(args.output)
        else:
            if not all(os.environ.get(key) for key in ("PGHOST", "PGUSER", "PGDATABASE")):
                parser.error("PGHOST, PGUSER and PGDATABASE are required; use a read-only DB role")
            if not args.migrations.is_dir():
                parser.error("Local migrations directory not found")
            manifest = export(get_remote_records(), args.migrations, args.output)
            verify(args.output)
        print(json.dumps({key: manifest[key] for key in (
            "exported_record_count", "migration_file_count", "version_matched_count",
            "remote_only_count", "local_only_versions", "local_version_collisions",
        )}, indent=2))
    except (ValueError, RuntimeError, subprocess.CalledProcessError, FileNotFoundError) as exc:
        print(f"Recovery export failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
