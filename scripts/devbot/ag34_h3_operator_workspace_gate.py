#!/usr/bin/env python3
"""Offline AG34-H3 operator gate for a temporary, isolated migration-fetch workspace.

Never connects to Supabase, never executes SQL, never edits a file. Compares
fetched 82 remote migration version/name pairs to an inspected live fingerprint.
Source SQL from those 82 stored migrations stays OUT of GitHub.
"""
from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CANONICAL = ROOT / "supabase/migrations/20261111165330_ag34_h1_legacy_coach_batches_client_lockdown.sql"
TARGET = CANONICAL.name
EXPECTED_HISTORY_COUNT = 82
EXPECTED_NAMES_MD5 = "09dcece659f31b05aa7db67c05374e44"
VALID = re.compile(r"^([0-9]{14})_([A-Za-z0-9_]+)\.sql$")


class ReleaseGateError(Exception):
    """Non-sensitive release blocker."""


def inspect(workspace: Path, phase: str) -> dict[str, str | int]:
    if phase not in {"fetched", "staged"}:
        raise ReleaseGateError("Invalid operator phase")
    workspace = workspace.expanduser().resolve()
    if (workspace == ROOT or workspace.is_relative_to(ROOT)
        or not (workspace / "supabase/config.toml").is_file()
        or (workspace / ".git").exists()
        or (workspace / "supabase/.temp/project-ref").exists()):
        raise ReleaseGateError("Requires separate unlinked workspace outside the checkout")
    folder = workspace / "supabase/migrations"
    if not folder.is_dir():
        raise ReleaseGateError("Migration fetch directory missing")
    files = sorted((p for p in folder.iterdir()), key=lambda x: x.name)
    if any(not p.is_file() for p in files):
        raise ReleaseGateError("Unexpected item in migration directory")
    manifest: list[tuple[str,str]] = []
    seen: set[str] = set()
    pending = False
    for file in files:
        match = VALID.fullmatch(file.name)
        if match is None or file.stat().st_size == 0:
            raise ReleaseGateError("Unexpected or empty fetched migration file")
        version, name = match.groups()
        if version in seen:
            raise ReleaseGateError("Duplicate fetched migration version")
        seen.add(version)
        if file.name == TARGET:
            if phase != "staged":
                raise ReleaseGateError("New migration unexpectedly present before staging")
            if file.read_bytes() != CANONICAL.read_bytes():
                raise ReleaseGateError("Staged migration SQL differs from reviewed GitHub version")
            pending = True
        else:
            manifest.append((version,name))
    if len(manifest) != EXPECTED_HISTORY_COUNT:
        raise ReleaseGateError("Fetched history does not match the expected live count")
    if len(files) != EXPECTED_HISTORY_COUNT + (1 if phase == "staged" else 0):
        raise ReleaseGateError("Extra migration file in temporary workspace")
    if phase == "staged" and not pending:
        raise ReleaseGateError("Canonical single migration is missing")
    manifest.sort()
    raw = "|".join(f"{v}:{n}" for v,n in manifest).encode("utf-8")
    names_digest = hashlib.md5(raw).hexdigest()
    if names_digest != EXPECTED_NAMES_MD5:
        raise ReleaseGateError("Fetched history differs from inspected live manifest; stop and review")
    if max(seen) != ("20261111165330" if phase == "staged" else max(v for v,_ in manifest)):
        raise ReleaseGateError("Unexpected pending migration ordering")
    return {"phase":phase,"historical_versions":len(manifest),
            "new_migration_count":int(pending),"names_manifest_md5":names_digest}


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only AG34-H3 migration workspace gate")
    parser.add_argument("--workspace",required=True,type=Path)
    parser.add_argument("--phase",required=True,choices=("fetched","staged"))
    args = parser.parse_args()
    try:
        data=inspect(args.workspace,args.phase)
    except ReleaseGateError as err:
        print("AG34-H3 STOP: "+str(err))
        return 2
    print(f"AG34-H3 PASS: {data['historical_versions']} stored applied migrations; "
          f"{data['new_migration_count']} staged pending; manifest verified; no SQL executed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
