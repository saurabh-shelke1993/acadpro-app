#!/usr/bin/env python3
"""B3.5 local-only review of 14 historical data/procedural migrations.

Reads original SQL ONLY from the B3.4 private archive. Checks all 82 source
migrations / 168 SHA-256s via B3.3 first. Emits no SQL bodies or literal values.
Conservative structural triage only; not a PostgreSQL parser or replay approval.
"""
import argparse
from collections import Counter
import json
import os
from pathlib import Path
import re
import sys

from b3_3_original_source_audit import analyze, EVIDENCE
from b3_1_assembly_manifest import RISKS
from export_migrations import verify
from inspect_historical_statements import DIRECT_DML, split_masked_statements

RECOVERY = Path("supabase/recovery/historical-baseline")
REGISTER = RECOVERY / "b3_4_data_procedural_quarantine_review_20261111.json"
CHECKS = {
 "parent_auth_linkage_and_backfill": ["PARENT_AUTH_LINK", "PARENT_PLAYER_SCOPE"],
 "schedule_rls_or_policy_procedural": ["ATTENDANCE_SCHEDULE_INVARIANTS", "COACH_AND_PARENT_SCOPES"],
 "record_specific_player_reconciliation": ["PLAYER_BATCH_INVARIANTS", "NO_REAL_PLAYER_UUID_REPLAY"],
 "parent_player_duplicate_cleanup": ["PARENT_FK_INTEGRITY", "NO_REAL_USER_DELETION"],
 "financial_or_receipt_reconciliation": ["FINANCIAL_LEDGER_ATOMICITY", "RECEIPT_UNIQUENESS", "NO_REAL_DUE_MUTATIONS"],
 "storage_or_logo_policy_setup": ["STORAGE_RLS_PATH_SCOPE", "PHOTO_OWNERSHIP"],
 "enquiry_security_and_backfill": ["ENQUIRY_COACH_CENTER_SCOPE", "OWNER_CONVERSION_AND_DELETE"],
}
GENERAL_CHECKS = ["AUTHENTIC_SOURCE", "MANUAL_SCHEMA_VS_DATA_SEPARATION",
                  "SECURITY_DEFINER_SEARCH_PATH_GRANTS", "RLS_CROSS_ACADEMY_NEGATIVE_TESTS",
                  "TRIGGER_SIDE_EFFECT_REVIEW", "DISPOSABLE_SYNTHETIC_DATA_ONLY"]


def structural_kind(masked):
    """Only masked top-level syntax; never inspect/return raw SQL literal values."""
    s = masked.strip().upper()
    if DIRECT_DML.match(s):
        return "DIRECT_MUTATION"
    if re.match(r"^DO\b", s):
        return "OPAQUE_DO"
    if re.match(r"^WITH\b", s):
        return "CTE_REVIEW"
    if re.match(r"^(?:CREATE(?:\s+OR\s+REPLACE)?|ALTER|DROP)\s+(?:FUNCTION|PROCEDURE)\b", s):
        return "OPAQUE_ROUTINE"
    if re.match(r"^(?:CREATE(?:\s+OR\s+REPLACE)?|ALTER|DROP)\s+TRIGGER\b", s):
        return "TRIGGER"
    if (re.match(r"^(?:CREATE|ALTER|DROP)\s+POLICY\b", s)
            or re.search(r"\b(?:ENABLE|DISABLE|FORCE)\s+ROW\s+LEVEL\s+SECURITY\b", s)):
        return "RLS"
    if re.match(r"^(?:GRANT|REVOKE|ALTER\s+DEFAULT\s+PRIVILEGES)\b", s):
        return "PRIVILEGE"
    if re.match(r"^(?:SELECT|CALL|PERFORM|EXECUTE)\b", s):
        return "EXECUTION_POSSIBLE"
    if re.match(r"^(?:CREATE|ALTER|DROP|COMMENT|REINDEX)\b", s):
        return "DDL_REVIEW"
    return "OTHER_UNREVIEWED"


def inspect_case(case, statements, pinned_hashes):
    """Pure helper: requires a verified source caller; all decisions remain pending."""
    if (case["review_class"] not in CHECKS
            or case["replay_approved"] is not False
            or case["statement_level_review_completed"] is not False
            or case["essential_ddl_separation_approved"] is not False):
        raise ValueError("Unrecognized or prematurely approved quarantine entry")
    if (len(statements) != case["original_sql_array_elements"]
            or any(not isinstance(s, str) for s in statements)):
        raise ValueError("Original SQL array mismatch")
    segment_reviews = []
    for original_ordinal, sql in enumerate(statements, 1):
        if original_ordinal not in pinned_hashes:
            raise ValueError("Original element SHA-256 missing")
        segments, incomplete = split_masked_statements(sql)
        if incomplete or not segments:
            raise ValueError("Unterminated or empty original SQL element")
        for seg_ordinal, masked in enumerate(segments, 1):
            segment_reviews.append({
                "original_element_ordinal": original_ordinal,
                "structural_segment_ordinal": seg_ordinal,
                "original_element_sha256": pinned_hashes[original_ordinal],
                "structural_category": structural_kind(masked),
                "routine_or_do_body_manually_reviewed": False,
                "rls_and_grants_manually_reviewed": False,
                "ddl_approved": False,
                "dml_approved": False,
                "replay_approved": False,
            })
    checklist = GENERAL_CHECKS + CHECKS[case["review_class"]]
    if case["procedural_do_block_count"]:
        checklist.append("INSPECT_OPAQUE_DO_BODY_MANUALLY")
    if case["direct_top_level_mutation_count"]:
        checklist.append("INSPECT_MUTATION_TARGET_AND_WHERE_MANUALLY")
    if case["quoted_uuid_pattern"]:
        checklist.append("RECORD_SPECIFIC_UUID_LITERAL_QUARANTINE")
    return {
        "version": case["version"],
        "historical_name": case["name"],
        "review_class": case["review_class"],
        "original_element_count": len(statements),
        "masked_top_level_segment_count": len(segment_reviews),
        "structural_category_counts": dict(sorted(Counter(
            item["structural_category"] for item in segment_reviews).items())),
        "historical_direct_dml_count": case["direct_top_level_mutation_count"],
        "historical_do_count": case["procedural_do_block_count"],
        "manual_review_checks": checklist,
        "segments": segment_reviews,
        "manual_review_status": "PENDING",
        "schema_data_split_approved": False,
        "privilege_and_rls_parity_approved": False,
        "safe_synthetic_replacement_approved": False,
        "replay_approved": False,
    }


def prepare_local_review(root, archive):
    root = Path(root).resolve(strict=True)
    archive = Path(archive).resolve(strict=True)
    private = (root / RECOVERY / ".recovery-private").resolve(strict=True)
    if not archive.is_relative_to(private) or not archive.is_dir():
        raise ValueError("Archive must remain inside .recovery-private")
    attested = analyze(root, archive)
    if not (attested["private_archive_source_matched_to_live_fingerprints"]
            and attested["all_168_element_hashes_verified_from_private_archive"]):
        raise ValueError("Original source archive failed full attestation")
    register = json.loads((root / REGISTER).read_text(encoding="utf-8"))
    fingerprints = json.loads((root / EVIDENCE).read_text(encoding="utf-8"))
    risks = json.loads((root / RISKS).read_text(encoding="utf-8"))
    if (register.get("schema") != "kheltriva-b3-4-historical-data-procedure-review-v1"
            or register.get("active_project_id") != fingerprints.get("project_id")
            or risks.get("project_id") != fingerprints.get("project_id")
            or register.get("all_approved") is not False):
        raise ValueError("Source review register project or approval flag mismatch")
    b26 = {row["version"]: row for row in risks["records"]}
    expected = {
        ver for ver, row in b26.items()
        if (row["direct_data_statement_count"] > 0
            or row["do_block_count"] > 0
            or row["possible_with_mutation_count"] > 0
            or ver in {"20260920041516", "20260920041606"})
    }
    cases = register.get("cases", [])
    versions = [row["version"] for row in cases]
    if (len(cases) != 14 or len(set(versions)) != 14 or set(versions) != expected):
        raise ValueError("14-case historical quarantine coverage changed")
    archive_manifest = verify(archive)
    manifest = {row["version"]: row for row in archive_manifest["items"]}
    hashes = {}
    for row in fingerprints["items"]:
        hashes.setdefault(row["version"], {})[row["ordinal"]] = row["original_sql_element_sha256"]
    items = []
    for case in cases:
        version = case["version"]
        source = manifest.get(version)
        old_risk = b26.get(version)
        if (source is None or old_risk is None
                or case["name"] != source["name"] or case["name"] != old_risk["name"]
                or case["original_sql_array_elements"] != old_risk["stored_statement_count"]
                or case["direct_top_level_mutation_count"] != old_risk["direct_data_statement_count"]
                or case["procedural_do_block_count"] != old_risk["do_block_count"]):
            raise ValueError("Historical source, risk and quarantine inventory drift")
        location = (archive / source["relative_path"]).resolve(strict=True)
        if not location.is_relative_to(archive):
            raise ValueError("Unsafe original SQL location")
        statements = json.loads(location.read_bytes())
        items.append(inspect_case(case, statements, hashes[version]))
    return {
        "schema": "kheltriva-b3-5-private-review-v1",
        "mode": "offline_original_sql_structural_review",
        "verified_original_versions": 82,
        "verified_original_elements": 168,
        "quarantined_cases_structurally_scanned": 14,
        "contains_original_sql_or_literal_values": False,
        "full_postgresql_parser_used": False,
        "manual_source_review_complete": False,
        "tenant_security_parity_tested": False,
        "historical_data_operation_approved": False,
        "ready_for_disposable_sql_generation": False,
        "ready_for_disposable_replay": False,
        "ready_for_production": False,
        "cases": items,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        root = args.root.resolve(strict=True)
        output = args.output.resolve()
        private = (root / RECOVERY / ".recovery-private").resolve(strict=True)
        if not output.is_relative_to(private) or output == private or output.exists():
            raise ValueError("Output must be a new file in .recovery-private")
        report = prepare_local_review(root, args.archive)
        output.parent.mkdir(parents=True, exist_ok=True)
        os.umask(0o077)
        with output.open("x", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)
            handle.write("\n")
        print(json.dumps({
            "verified_original_versions": report["verified_original_versions"],
            "verified_original_elements": report["verified_original_elements"],
            "quarantined_cases_structurally_scanned": report["quarantined_cases_structurally_scanned"],
            "manual_source_review_complete": False,
            "ready_for_disposable_replay": False,
        }, indent=2))
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
        print("B3.5 review stopped: private source, risk register or safe output validation failed.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
