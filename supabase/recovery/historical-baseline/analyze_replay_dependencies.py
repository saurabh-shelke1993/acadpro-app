#!/usr/bin/env python3
"""Offline heuristic migration dependency audit; never executes archived SQL."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

FUNC_DEFINE = re.compile(r"\bcreate\s+(?:or\s+replace\s+)?function\s+(?:\"?private\"?\.)?\"?([a-z_][a-z0-9_]*)\"?\s*\(", re.I)
PRIVATE_DEFINE = re.compile(r"\bcreate\s+(?:or\s+replace\s+)?function\s+\"?private\"?\.\"?([a-z_][a-z0-9_]*)\"?\s*\(", re.I)
PRIVATE_USE = re.compile(r"\bprivate\.([a-z_][a-z0-9_]*)\s*\(", re.I)
SCHEMA_DEFINE = re.compile(r"\bcreate\s+schema\s+(?:if\s+not\s+exists\s+)?\"?private\"?", re.I)
PARENTS_ADD = re.compile(r"\balter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?parents\b[\s\S]{0,500}?\badd\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?user_id\b", re.I)
PARENTS_USE = re.compile(r"\b(?:public\.)?parents\s*\.\s*user_id\b", re.I)
DATA_MUTATION = re.compile(r"\b(?:insert\s+into|update\s+|delete\s+from|truncate\b)", re.I)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def analyze(archive):
    manifest = json.loads((archive / "manifest.json").read_text(encoding="utf-8"))
    ordered = manifest["items"]
    seen_versions = set()
    defined = set()
    schema_private = False
    parents_user_id = False
    findings = []
    first_definitions = {}
    for item in ordered:
        version = item["version"]
        if version in seen_versions:
            raise ValueError("Duplicate remote migration version in manifest")
        seen_versions.add(version)
        path = (archive / item["relative_path"]).resolve()
        if not path.is_relative_to(archive.resolve()):
            raise ValueError("Archive path traversal")
        raw = path.read_bytes()
        if digest(raw) != item["sha256"]:
            raise ValueError("Evidence hash mismatch: " + version)
        statements = json.loads(raw)
        if len(statements) != item["statement_count"] or not all(isinstance(x, str) for x in statements):
            raise ValueError("Statement integrity failure: " + version)
        uses = set()
        creates = set()
        data_mutation = False
        missing_private_schema = False
        missing_parent_column = False
        for sql in statements:
            uses.update(x.lower() for x in PRIVATE_USE.findall(sql))
            creates.update(x.lower() for x in PRIVATE_DEFINE.findall(sql))
            if uses and not schema_private and not SCHEMA_DEFINE.search(sql):
                missing_private_schema = True
            if PARENTS_USE.search(sql) and not parents_user_id and not PARENTS_ADD.search(sql):
                missing_parent_column = True
            data_mutation = data_mutation or bool(DATA_MUTATION.search(sql))
            schema_private = schema_private or bool(SCHEMA_DEFINE.search(sql))
            parents_user_id = parents_user_id or bool(PARENTS_ADD.search(sql))
        # Report unresolved references without assuming source order within each SQL statement.
        missing = sorted(uses - defined - creates)
        for fn in creates:
            first_definitions.setdefault(fn, version)
        defined.update(creates)
        findings.append({
            "version": version, "name": item["name"], "private_uses": sorted(uses),
            "private_definitions": sorted(creates), "private_references_without_prior_definition": missing,
            "schema_private_not_proven_before_use": missing_private_schema,
            "parents_user_id_not_proven_before_use": missing_parent_column,
            "potential_data_mutation": data_mutation,
            "replay_approved": False,
        })
    return {
        "schema": "kheltriva-replay-dependency-audit-v1",
        "scope": "heuristic, based on archived SQL text only, NOT proof of safe migration replay",
        "migration_count": len(findings),
        "first_private_function_definitions": dict(sorted(first_definitions.items())),
        "migrations_with_unresolved_private_references": sum(bool(x["private_references_without_prior_definition"]) for x in findings),
        "migrations_with_potential_data_mutations": sum(x["potential_data_mutation"] for x in findings),
        "private_schema_creation_seen": schema_private,
        "parents_user_id_addition_seen": parents_user_id,
        "findings": findings,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise ValueError("Output exists; refuse to overwrite audit evidence")
        audit = analyze(args.archive)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({key: audit[key] for key in ("migration_count", "migrations_with_unresolved_private_references", "migrations_with_potential_data_mutations", "private_schema_creation_seen", "parents_user_id_addition_seen")}, indent=2))
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print("Provenance analysis refused: " + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
