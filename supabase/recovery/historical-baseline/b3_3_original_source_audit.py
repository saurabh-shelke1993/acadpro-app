#!/usr/bin/env python3
"""B3.3 read-only ORIGINAL migration-element source integrity/lexical review.

Offline. No database connections, SQL execution, migration repair or SQL export
into tracked directories. Full source inspection requires an ignored, verified
private archive; --inventory-only does NOT imply that archive exists.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

from attest_private_archive import attest
from b3_2_reconciliation_design import design, RECOVERY
from export_migrations import verify

EVIDENCE = RECOVERY / "b3_3_original_statement_fingerprints_20261111.json"
BASE_REVIEW = RECOVERY / "b3_3_base_statement_review_20261111.json"
PARITY = RECOVERY / "parity-fingerprints-readonly-20261109.json"
SIX_VERSIONS = {
    "20260823093317", "20260920041302", "20260920041356",
    "20260920041457", "20260920041516", "20260920041606",
}


def tokens_and_statements(source):
    """Lexical comparison only; protect semicolons in quotes/dollar bodies.

    This is not a PostgreSQL parser. Dollar-quoted bodies are compared as
    opaque exact strings, never assumed equivalent if whitespace differs.
    """
    segments = []
    tokens = []
    i = 0
    n = len(source)
    depth = 0

    def append_value(kind, value):
        tokens.append((kind, value))

    def flush():
        nonlocal tokens
        if tokens:
            segments.append(tokens)
            tokens = []

    while i < n:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < n else ""
        if ch.isspace():
            i += 1
            continue
        if ch == "-" and nxt == "-":
            i += 2
            while i < n and source[i] not in "\r\n":
                i += 1
            continue
        if ch == "/" and nxt == "*":
            depth = 1
            i += 2
            while i < n and depth:
                if source.startswith("/*", i):
                    depth += 1
                    i += 2
                elif source.startswith("*/", i):
                    depth -= 1
                    i += 2
                else:
                    i += 1
            if depth:
                raise ValueError("Unclosed SQL block comment")
            continue
        if ch in ("'", '"'):
            start = i
            i += 1
            while i < n:
                if source[i] == ch and i + 1 < n and source[i + 1] == ch:
                    i += 2
                elif source[i] == ch:
                    i += 1
                    break
                else:
                    i += 1
            else:
                raise ValueError("Unclosed SQL quoted literal or identifier")
            append_value("str" if ch == "'" else "quoted_id", source[start:i])
            continue
        if ch == "$":
            index = i + 1
            while index < n and (source[index].isalnum() or source[index] == "_"):
                index += 1
            if index < n and source[index] == "$":
                marker = source[i:index + 1]
                close = source.find(marker, index + 1)
                if close < 0:
                    raise ValueError("Unclosed dollar-quoted body")
                append_value("dollar_body", source[i:close + len(marker)])
                i = close + len(marker)
                continue
        if ch == ";":
            flush()
            i += 1
            continue
        if ch.isalpha() or ch == "_":
            start = i
            i += 1
            while i < n and (source[i].isalnum() or source[i] == "_"):
                i += 1
            append_value("keyword_or_identifier", source[start:i].lower())
            continue
        if ch.isdigit():
            start = i
            i += 1
            while i < n and (source[i].isdigit() or source[i] == "."):
                i += 1
            append_value("numeric", source[start:i])
            continue
        append_value("punctuation", ch)
        i += 1

    flush()
    return segments


def validate_pinned_evidence(root):
    report = json.loads((root / EVIDENCE).read_text(encoding="utf-8"))
    base = json.loads((root / BASE_REVIEW).read_text(encoding="utf-8"))
    plan = design(root)
    if report.get("schema") != "kheltriva-b3-3-original-ledger-statement-fingerprints-v1":
        raise ValueError("Invalid original-statement fingerprint schema")
    if base.get("schema") != "kheltriva-b3-3-base-element-aware-review-v1":
        raise ValueError("Invalid base-source comparison evidence schema")
    if report.get("project_id") != plan["remote_project_id"] or base.get("project_id") != plan["remote_project_id"]:
        raise ValueError("Original statement evidence belongs to a different project")
    if report.get("all_statement_sources_review_approved") is not False:
        raise ValueError("Unexpected original-statement approval")
    if report.get("ready_for_sql_assembly") is not False or base.get("eligible_for_replay") is not False:
        raise ValueError("Premature replay permission")
    items = report.get("items", [])
    sources = plan["ordered_migration_decisions"]
    if len(items) != 168 or len(sources) != 82 or report["summary"]["total_elements"] != 168:
        raise ValueError("Incomplete original statement inventory")
    expected = [(r["original_version"], r["original_name"]) for r in sources]
    pairs = []
    positions = {}
    total_bytes = 0
    for item in items:
        key = (item["version"], item["name"])
        if len(item["original_sql_element_sha256"]) != 64 or len(bytes.fromhex(item["original_sql_element_sha256"])) != 32:
            raise ValueError("Missing statement SHA-256")
        if item.get("raw_sql_archived") is not False or item.get("replay_approved") is not False:
            raise ValueError("Statement incorrectly marked recovered or approved")
        if item.get("original_sql_review_status") != "PENDING":
            raise ValueError("Source review status modified")
        if key not in positions:
            pairs.append(key)
            positions[key] = 0
        positions[key] += 1
        if item["ordinal"] != positions[key] or item["sql_byte_length"] < 0:
            raise ValueError("Original statement ordinality or length changed")
        total_bytes += item["sql_byte_length"]
    if pairs != expected or total_bytes != report["summary"]["byte_lengths_sum"]:
        raise ValueError("Source ordering / original byte counts mismatch")
    if report["summary"]["base_elements"] != 87 or positions[expected[0]] != 87:
        raise ValueError("Unexpected original initial-schema structure")
    if not (base["original_ledger_statement_array_elements"] == 87
            and base["git_semicolon_delimited_statements"] == 87
            and base["token_equivalent_statement_positions"] == 87
            and base["eligible_for_replay"] is False
            and base["semantic_equivalence_proven"] is False):
        raise ValueError("Initial schema must remain pending despite 87/87 lexical matches")
    return report, base, plan


def verify_original_element_hashes(items, lookup):
    """Verify every ORIGINAL SQL element's bytes, ordinal, name and SHA-256.

    Exact bytes are checked in memory and never included in returned metadata.
    A caller must also verify archive manifests and pinned migration-wide hashes.
    """
    verified = 0
    for item in items:
        row = lookup.get(item["version"])
        if row is None or row[0] != item["name"]:
            raise ValueError("Original SQL record missing")
        statements = row[1]
        if item["ordinal"] < 1 or item["ordinal"] > len(statements):
            raise ValueError("Original statement ordinal missing")
        sql = statements[item["ordinal"] - 1]
        if not isinstance(sql, str):
            raise ValueError("Original statement SQL is not text")
        exact = sql.encode("utf-8")
        if (len(exact) != item["sql_byte_length"]
                or hashlib.sha256(exact).hexdigest() != item["original_sql_element_sha256"]):
            raise ValueError("Historical statement source fingerprint mismatch")
        verified += 1
    return verified


def analyze(root, archive=None):
    root = Path(root).resolve(strict=True)
    evidence, base_review, plan = validate_pinned_evidence(root)
    output = {
        "schema": "kheltriva-b3-3-original-source-attestation-v1",
        "mode": "metadata_only_private_original_source_audit",
        "remote_migration_count": 82,
        "original_ledger_element_count": 168,
        "source_bytes_held_by_remote_ledger": evidence["summary"]["byte_lengths_sum"],
        "historical_schema_87_statements_lexically_aligned": True,
        "original_sql_body_embedded": False,
        "private_archive_integrity_checked": False,
        "private_archive_source_matched_to_live_fingerprints": False,
        "all_168_element_hashes_verified_from_private_archive": False,
        "private_archive_present": archive is not None,
        "schema_parity_tested": False,
        "ready_for_disposable_sql_generation": False,
        "ready_for_full_supabase_replay": False,
        "ready_for_production": False,
        "divergent_source_comparisons": [],
        "manual_review_remaining": [
            "original_complete_private_archive", "initial_schema_parser_and_security_review",
            "three_player_batch_routine_semantics", "two_player_specific_cleanup_selectors",
            "fourteen_data_or_procedural_migrations", "eleven_helper_original_provenance",
            "complete_disposable_supabase_auth_rls_finance_replay",
        ],
    }
    if archive is None:
        return output

    archive = Path(archive).resolve(strict=True)
    canonical = (root / "supabase/migrations").resolve(strict=True)
    if archive.is_relative_to(canonical):
        raise ValueError("Private archive must never be under canonical migrations")
    # SHA-256 of the original raw JSON arrays is checked first, followed by
    # source migration-wide Git blob fingerprints from read-only live inventory.
    verified = verify(archive)
    attest(archive, root / PARITY)
    if len(verified["items"]) != 82:
        raise ValueError("Incomplete private original SQL archive")
    lookup = {}
    for item in verified["items"]:
        path = (archive / item["relative_path"]).resolve(strict=True)
        if not path.is_relative_to(archive):
            raise ValueError("Private SQL path traversal")
        statements = json.loads(path.read_bytes())
        lookup[item["version"]] = (item["name"], statements)
    if verify_original_element_hashes(evidence["items"], lookup) != 168:
        raise ValueError("Not all original SQL elements verified")

    output["private_archive_integrity_checked"] = True
    output["private_archive_source_matched_to_live_fingerprints"] = True
    output["all_168_element_hashes_verified_from_private_archive"] = True
    for row in plan["ordered_migration_decisions"]:
        v = row["original_version"]
        if v not in SIX_VERSIONS:
            continue
        name, originals = lookup[v]
        paths = [
            p for p in (root / "supabase/migrations").glob(v + "_*.sql")
            if p.is_file()
        ]
        if len(paths) != 1:
            raise ValueError("Expected exactly one original same-version Git file")
        git_parts = tokens_and_statements(paths[0].read_text(encoding="utf-8"))
        remote_parts = []
        for sql in originals:
            remote_parts.extend(tokens_and_statements(sql))
        matches = sum(1 for left, right in zip(remote_parts, git_parts) if left == right)
        output["divergent_source_comparisons"].append({
            "version": v,
            "original_array_elements": len(originals),
            "remote_lexical_statements": len(remote_parts),
            "git_lexical_statements": len(git_parts),
            "matching_ordinals": matches,
            "fully_lexically_identical": (
                len(remote_parts) == len(git_parts) and matches == len(remote_parts)
            ),
            "tokens_or_quoted_literals_exposed": False,
            "security_semantics_approved": False,
            "replay_approved": False,
        })
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--archive", type=Path, help="Verified ignored private archive; omit for metadata-only check")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        root = args.root.resolve(strict=True)
        out = args.output.resolve()
        if out.exists():
            raise ValueError("Output exists, refusing evidence overwrite")
        if out.is_relative_to((root / "supabase/migrations").resolve(strict=True)):
            raise ValueError("Do not write artifacts under tracked migrations")
        report = analyze(root, args.archive)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "original_ledger_element_count": report["original_ledger_element_count"],
            "private_archive_present": report["private_archive_present"],
            "all_168_element_hashes_verified_from_private_archive":
                report["all_168_element_hashes_verified_from_private_archive"],
            "ready_for_full_supabase_replay": False,
        }, indent=2))
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as err:
        # Exceptions only name source/hash errors, never include SQL or literals.
        print("B3.3 source audit refused: " + str(err), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
