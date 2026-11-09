#!/usr/bin/env python3
"""Compare quarantined migration statements with tracked SQL by Git blob hash.

Strict evidence classification only. Never executes SQL or modifies migration sources.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

from export_migrations import verify

VERSION = re.compile(r"^[0-9]{14}$")


def git_blob_sha1(blob: bytes) -> str:
    header = b"blob " + str(len(blob)).encode("ascii") + b"\0"
    return hashlib.sha1(header + blob).hexdigest()


def compare(archive: Path, migrations: Path) -> dict:
    root = archive.resolve(strict=True)
    manifest = verify(root)
    if not migrations.is_dir():
        raise ValueError("Local migrations directory is missing")

    by_sha = {}
    by_version = {}
    local_files = []
    for file in sorted(migrations.glob("*.sql")):
        version = file.name.split("_", 1)[0]
        if not VERSION.fullmatch(version):
            continue
        info = {"file": file.name, "version": version,
                "git_blob_sha1": git_blob_sha1(file.read_bytes())}
        local_files.append(info)
        by_sha.setdefault(info["git_blob_sha1"], []).append(info)
        by_version.setdefault(version, []).append(info)

    matched_files = set()
    remote_seen = set()
    results = []
    for item in manifest["items"]:
        version = item["version"]
        if version in remote_seen:
            raise ValueError(f"Duplicate remote migration version {version}")
        remote_seen.add(version)
        path = (root / item["relative_path"]).resolve(strict=True)
        if not path.is_relative_to(root):
            raise ValueError("Archive path traversal is not allowed")
        statements = json.loads(path.read_bytes())
        if not isinstance(statements, list) or not all(isinstance(s, str) for s in statements):
            raise ValueError(f"Invalid SQL statement array for {version}")
        raw = "".join(statements).encode("utf-8")
        direct = by_sha.get(git_blob_sha1(raw), [])
        with_lf = [] if direct else by_sha.get(git_blob_sha1(raw + b"\n"), [])
        no_leading_lf = []
        if not direct and not with_lf and raw.startswith(b"\n"):
            no_leading_lf = by_sha.get(git_blob_sha1(raw[1:]), [])
        candidates = direct or with_lf or no_leading_lf
        for info in candidates:
            matched_files.add(info["file"])
        same_version = by_version.get(version, [])
        if direct:
            status = "exact-bytes"
        elif with_lf:
            status = "terminal-lf-only"
        elif no_leading_lf:
            status = "leading-lf-only"
        elif same_version:
            status = "same-version-content-divergence"
        else:
            status = "no-content-match"
        results.append({
            "remote_version": version,
            "remote_name": item["name"],
            "remote_statement_count": len(statements),
            "remote_git_blob_sha1": git_blob_sha1(raw),
            "content_status": status,
            "matched_local_files": [x["file"] for x in candidates],
            "same_version_local_files": [x["file"] for x in same_version],
            "version_drift": bool(candidates and all(x["version"] != version for x in candidates)),
            "content_equivalence_claimed": bool(candidates),
            "semantic_equivalence_verified": False,
            "replay_approved": False,
        })
    collisions = {
        version: [x["file"] for x in items]
        for version, items in sorted(by_version.items()) if len(items) > 1
    }
    counts = {name: sum(x["content_status"] == name for x in results)
              for name in ("exact-bytes", "terminal-lf-only", "leading-lf-only",
                           "same-version-content-divergence", "no-content-match")}
    return {
        "schema": "kheltriva-b2-4-local-parity-v1",
        "method": "SHA1 git blob of UTF-8 concatenated ledger statements, or exactly one appended LF",
        "warning": "Fingerprint parity is not proof of semantic equivalence, historical order or safe replay",
        "remote_count": len(results),
        "local_count": len(local_files),
        "counts": counts,
        "timestamp_drift_links": sum(x["version_drift"] for x in results),
        "local_unmatched_files": [x["file"] for x in local_files if x["file"] not in matched_files],
        "local_timestamp_collisions": collisions,
        "remote_migrations": results,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--migrations", type=Path, default=Path("supabase/migrations"))
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise ValueError("Output already exists; refusing to overwrite evidence")
        result = compare(args.archive, args.migrations)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "remote_count": result["remote_count"],
            "local_count": result["local_count"],
            "counts": result["counts"],
            "timestamp_drift_links": result["timestamp_drift_links"],
            "local_unmatched_count": len(result["local_unmatched_files"]),
        }, indent=2))
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"Content parity audit refused: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
