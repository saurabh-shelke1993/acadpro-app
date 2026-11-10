#!/usr/bin/env python3
"""Offline SQL statement risk triage for SHA-256-verified historical migration evidence.

Does NOT run any SQL. This is a conservative lexical scan, not a PostgreSQL parser
or replay-approval mechanism. Never records SQL bodies or quoted literal values.
"""
import argparse
import json
from pathlib import Path
import re
import sys

from export_migrations import verify

DIRECT_DML = re.compile(
    r"^(INSERT\s+INTO|UPDATE\b|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE(?:\s+TABLE)?\b|COPY\b)",
    re.IGNORECASE,
)
TARGET = re.compile(
    r"^(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE(?:\s+TABLE)?|COPY)\s+"
    r"(?:ONLY\s+)?([a-z_][\w]*(?:\.[a-z_][\w]*)?)",
    re.IGNORECASE,
)
DOLLAR = re.compile(r"\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$")
KEYWORD = re.compile(r"^[A-Za-z]+(?:\s+[A-Za-z]+)?")


def split_masked_statements(text):
    """Split at semicolons only outside comments, literals and dollar bodies.

    Comments, quoted identifiers and literal/function bodies are masked.
    Never accept this as a complete PostgreSQL syntax or execution validator.
    """
    output = []
    buf = []
    i = 0
    state = "normal"
    delim = ""
    depth = 0
    n = len(text)

    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if state == "normal":
            if c == "-" and nxt == "-":
                state = "line"
                buf.append(" ")
                i += 2
                continue
            if c == "/" and nxt == "*":
                state = "block"
                depth = 1
                buf.append(" ")
                i += 2
                continue
            if c == "'":
                state = "single"
                buf.append(" ")
                i += 1
                continue
            if c == '"':
                state = "identifier"
                buf.append(" ")
                i += 1
                continue
            if c == "$":
                match = DOLLAR.match(text, i)
                if match:
                    delim = match.group(0)
                    state = "dollar"
                    buf.append(" ")
                    i = match.end()
                    continue
            if c == ";":
                statement = "".join(buf).strip()
                if statement:
                    output.append(statement)
                buf = []
                i += 1
                continue
            buf.append(c)
            i += 1
            continue

        if state == "line":
            if c in "\r\n":
                buf.append(c)
                state = "normal"
            i += 1
            continue

        if state == "block":
            if c == "/" and nxt == "*":
                depth += 1
                i += 2
            elif c == "*" and nxt == "/":
                depth -= 1
                i += 2
                if depth == 0:
                    state = "normal"
            else:
                i += 1
            continue

        if state == "single":
            if c == "'" and nxt == "'":
                i += 2
            elif c == "'":
                state = "normal"
                i += 1
            elif c == "\\" and nxt:
                i += 2
            else:
                i += 1
            continue

        if state == "identifier":
            if c == '"' and nxt == '"':
                i += 2
            elif c == '"':
                state = "normal"
                i += 1
            else:
                i += 1
            continue

        if state == "dollar":
            if text.startswith(delim, i):
                i += len(delim)
                state = "normal"
            else:
                i += 1
            continue

    remainder = "".join(buf).strip()
    if remainder:
        output.append(remainder)
    return output, state not in ("normal", "line")


def scan_records(items):
    if not items:
        raise ValueError("Empty historical migration record set")
    seen = set()
    rows = []
    for item in items:
        version = item["version"]
        if version in seen:
            raise ValueError(f"Duplicate migration version: {version}")
        seen.add(version)
        statements = item["statements"]
        if not isinstance(statements, list) or not all(isinstance(x, str) for x in statements):
            raise ValueError(f"Invalid SQL evidence for {version}")
        segments = []
        uncertain = False
        for sql in statements:
            parts, is_uncertain = split_masked_statements(sql)
            segments.extend(parts)
            uncertain = uncertain or is_uncertain

        direct = []
        procedural_count = 0
        cte_risk = 0
        unknown_start = 0
        for index, statement in enumerate(segments):
            match = DIRECT_DML.match(statement)
            if match:
                target_match = TARGET.match(statement)
                target = target_match.group(2) if target_match else "UNPARSED"
                # SQL identifier only, no literal or user value.
                direct.append({
                    "statement_index": index,
                    "operation": " ".join(match.group(1).upper().split()),
                    "target": target.lower(),
                    "where_token_present": bool(re.search(r"\bWHERE\b", statement, re.I)),
                })
            if re.match(r"^DO\b", statement, re.I):
                procedural_count += 1
            if re.match(r"^WITH\b", statement, re.I) and re.search(
                    r"\b(?:UPDATE|DELETE|INSERT|MERGE)\b", statement, re.I):
                cte_risk += 1
            if not KEYWORD.match(statement):
                unknown_start += 1

        source = "\n".join(statements)
        rows.append({
            "version": version,
            "name": item["name"],
            "ledger_statement_entries": len(statements),
            "top_level_segments": len(segments),
            "direct_data_statements": direct,
            "procedural_do_blocks": procedural_count,
            "potential_mutating_ctes": cte_risk,
            "unknown_start_segments": unknown_start,
            "unterminated_lexical_segment": uncertain,
            "quoted_uuid_pattern_seen": bool(re.search(
                r"['\"][0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}['\"]", source, re.I)),
            "manual_review_required": True,
            "replay_approved": False,
        })

    return {
        "schema": "kheltriva-ps-l2-3b-historical-statement-audit-v1",
        "method": "Conservative offline top-level SQL lexical segmentation; no SQL bodies exported in report",
        "limitations": ("Not a PostgreSQL parser; may miss writes in function bodies, DO blocks, "
                        "dynamic SQL, SELECT-callable functions or advanced CTEs. "
                        "Quoted values are never emitted; no execution is authorized."),
        "summary": {
            "migrations": len(rows),
            "ledger_statement_entries": sum(x["ledger_statement_entries"] for x in rows),
            "top_level_segments": sum(x["top_level_segments"] for x in rows),
            "migrations_with_direct_data_statements": sum(bool(x["direct_data_statements"]) for x in rows),
            "direct_data_statement_count": sum(len(x["direct_data_statements"]) for x in rows),
            "migrations_with_procedural_do": sum(x["procedural_do_blocks"] > 0 for x in rows),
            "migrations_with_unterminated_lexical_segment": sum(x["unterminated_lexical_segment"] for x in rows),
        },
        "records": rows,
        "ready_for_disposable_replay": False,
        "ready_for_production": False,
    }


def inspect_archive(archive):
    root = archive.resolve(strict=True)
    manifest = verify(root)
    records = []
    for item in manifest["items"]:
        path = (root / item["relative_path"]).resolve(strict=True)
        if not path.is_relative_to(root):
            raise ValueError("Path traversal in archive manifest")
        statements = json.loads(path.read_bytes())
        if len(statements) != item["statement_count"]:
            raise ValueError("Statement count mismatch in archive manifest")
        records.append({
            "version": item["version"],
            "name": item["name"],
            "statements": statements,
        })
    return scan_records(records)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise ValueError("Output exists; refusing to overwrite previous evidence")
        report = inspect_archive(args.archive)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report["summary"], indent=2))
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"Historical SQL review blocked: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
