#!/usr/bin/env python3
"""PS-L2.3B B3.2: source decision matrix and disposable assembly DESIGN ONLY.

This is deliberately not a migration generator. It never executes SQL,
downloads remote data or creates SQL scripts, and cannot authorize replay.
"""
import argparse
import json
from pathlib import Path
import sys

from b3_1_assembly_manifest import assemble, RECOVERY, REVIEW

DIVERGENCES = RECOVERY / "b3_2_six_divergences_review_20261111.json"
REQUIRED_DIVERGENCES = {
    "20260823093317", "20260920041302", "20260920041356",
    "20260920041457", "20260920041516", "20260920041606",
}
BLOCKING_STATES = {"same-version-content-divergence", "no-content-match"}
TIMING_ANCHORS = [
    "20260823093317",  # recorded initial snapshot, not necessarily Git-equivalent
    "20260903173804",  # earliest recorded foundational helper invocation
    "20260908062059",  # historical current_parent_id creation
    "20260912142706",  # parents.user_id and current_parent_id redefinition
]
LOCAL_IRREGULAR_FILE = "202610210001_private_player_photo_storage.sql"


def load(root, rel):
    return json.loads((root / rel).read_text(encoding="utf-8"))


def design(root):
    root = Path(root).resolve(strict=True)
    source = assemble(root)
    reviews = load(root, REVIEW)
    divergence = load(root, DIVERGENCES)

    if divergence.get("schema") != "kheltriva-b3-2-six-divergences-review-v1":
        raise ValueError("Incorrect six-divergence evidence schema")
    if divergence.get("project_id") != source["source_project_id"]:
        raise ValueError("Divergence evidence is for a different Supabase project")
    if divergence.get("all_replay_approved") is not False:
        raise ValueError("Divergence review cannot approve replay")
    if divergence.get("no_sql_bodies_or_record_identifiers") is not True:
        raise ValueError("Divergence evidence must not contain original SQL literals")
    gates = divergence.get("gates", {})
    if not gates or any(value is not False for value in gates.values()):
        raise ValueError("Divergence manual review gates cannot be pre-approved")

    cases = divergence.get("cases", [])
    case_map = {c["version"]: c for c in cases}
    if len(case_map) != len(cases) or set(case_map) != REQUIRED_DIVERGENCES:
        raise ValueError("Divergent source evidence is missing or duplicated")
    for case in cases:
        if case.get("approved") is not False or case.get("manual_review_status") != "PENDING":
            raise ValueError("A source divergence has unauthorized approval")
    rows = source["ordered_original_migrations"]
    expected = {
        r["original_remote_version"] for r in rows
        if r["source_match_status"] == "same-version-content-divergence"
    }
    if expected != set(case_map):
        raise ValueError("Six-divergence evidence does not match B3.1 source history")
    if [r["original_remote_version"] for r in rows] != sorted(expected.union(
            set(r["original_remote_version"] for r in rows))):
        raise ValueError("Historical source order was not preserved")

    review_map = {r["version"]: r for r in reviews["records"]}
    if len(review_map) != len(rows):
        raise ValueError("Review queue lost records")
    by_ver = {r["original_remote_version"]: r for r in rows}
    for version in TIMING_ANCHORS:
        if version not in by_ver:
            raise ValueError("Required chronological anchor missing: " + version)
    if TIMING_ANCHORS != sorted(TIMING_ANCHORS):
        raise ValueError("Required auth helper time anchors out of order")

    output = []
    timeline_drift = []
    for row in rows:
        v = row["original_remote_version"]
        rev = review_map[v]
        if (rev["name"] != row["original_remote_name"]
                or rev["content_status"] != row["source_match_status"]
                or rev.get("approval_status") != "PENDING"
                or rev.get("replay_approved") is not False):
            raise ValueError("B2.5 review or approval drift: " + v)
        if row["historical_migration_replay_approved"] is not False:
            raise ValueError("A historical migration has been approved")
        kind = row["source_match_status"]
        if kind in BLOCKING_STATES:
            source_decision = ("MANUAL_REMOTE_VS_LOCAL_SOURCE_DIFF"
                               if kind == "same-version-content-divergence"
                               else "PRIVATE_REMOTE_SQL_SOURCE_REQUIRED")
        else:
            source_decision = "STRICT_GIT_CONTENT_LINK_ONLY_NO_REPLAY_APPROVAL"
        recorded_conflict = case_map.get(v)
        if recorded_conflict:
            if source_decision != "MANUAL_REMOTE_VS_LOCAL_SOURCE_DIFF":
                raise ValueError("Divergent source illegally marked as content-linked")
            if (recorded_conflict["review_category"] == "record_specific_cleanup_conflict"
                    and not row["data_risk"]["quarantine_for_manual_split_or_synthetic_adaptation"]):
                raise ValueError("Record-specific cleanup missing quarantine")
        linked = row["linked_local_sources"]
        for item in linked:
            if item["local_version"] != v:
                timeline_drift.append({
                    "original_version": v,
                    "tracked_local_version": item["local_version"],
                    "tracked_git_file": item["path"],
                    "synthetic_version_assigned": None,
                    "local_filename_changed": False,
                    "remote_history_repaired": False,
                    "review_status": "PENDING",
                })
        data = row["data_risk"]
        quarantined = data["quarantine_for_manual_split_or_synthetic_adaptation"]
        output.append({
            "ordinal": row["ordinal"],
            "original_version": v,
            "original_name": row["original_remote_name"],
            "original_remote_sql_blob_sha1": row["remote_sql_fingerprint_sha1"],
            "source_resolution": source_decision,
            "content_link_classification": kind,
            "verified_local_content_links": linked,
            "divergence_review_category": recorded_conflict["review_category"] if recorded_conflict else None,
            "manual_source_review": "PENDING",
            "security_review_flags": rev.get("review_flags", []),
            "data_or_procedure_quarantine": bool(quarantined),
            "data_disposition": ("HOLD_SOURCE_THEN_REVIEW_STATEMENT_BY_STATEMENT"
                                 if quarantined else "NO_DATA_CLASSIFICATION_APPROVAL"),
            "historical_ddl_statement_boundaries_approved": False,
            "record_specific_selector_approved": False,
            "runnable_sql_path": None,
            "replay_approved": False,
        })

    if len(output) != 82:
        raise ValueError("Source history changed; expected 82 remote migrations")
    if len(timeline_drift) != 8:
        raise ValueError("Expected eight independently checked timestamp-drift links")
    if sum(x["data_or_procedure_quarantine"] for x in output) != 14:
        raise ValueError("Data/procedural quarantine coverage changed")
    if sum(x["source_resolution"] == "STRICT_GIT_CONTENT_LINK_ONLY_NO_REPLAY_APPROVAL"
           for x in output) != 25:
        raise ValueError("Source fingerprint coverage changed")
    if sum(x["source_resolution"] == "MANUAL_REMOTE_VS_LOCAL_SOURCE_DIFF"
           for x in output) != 6:
        raise ValueError("Same-version divergent source count changed")

    return {
        "schema": "kheltriva-b3-2-disposable-design-v1",
        "mode": "review_only_never_executable",
        "original_history_preserved": True,
        "remote_project_id": source["source_project_id"],
        "count": len(output),
        "sql_content_embedded": False,
        "sql_files_generated": False,
        "ready_to_build_executable_migrations": False,
        "ready_for_full_supabase_replay": False,
        "ready_for_production": False,
        "source_reconciliation": {
            "strict_content_links_only": 25,
            "same_version_conflicts": 6,
            "remote_without_content_match": 51,
            "unlinked_remote_sources_total": 57,
            "quarantined_data_or_procedural_migrations": 14,
            "all_original_sources_privately_archived_and_reviewed": False,
            "initial_base_schema": {
                "remote_version": "20260823093317",
                "same_create_object_names_in_heuristic_scan": True,
                "same_detected_create_object_count": 17,
                "full_sql_equivalence": "UNPROVEN",
                "source_choice": "REVIEW_REMOTE_ORIGINAL_FIRST",
            },
            "source_conflict_decisions": [
                {
                    "version": case["version"],
                    "review_category": case["review_category"],
                    "status": case["manual_review_status"],
                    "approved": False,
                }
                for case in cases
            ],
        },
        "disposable_workspace_design": {
            "root_type": "fresh_unlinked_supabase_scratch_workspace",
            "canonical_git_migrations_modified": False,
            "remote_migration_ledger_modified": False,
            "scratch_sql_output_created": False,
            "stage_sequence": [
                "SUPABASE_PLATFORM_AUTH_STORAGE_PREREQUISITES_UNVERIFIED",
                "REVIEW_AUTHENTIC_REMOTE_BASE_SCHEMA_20260823093317",
                "REVIEW_PRIVATE_SCHEMA_AND_CURRENT_HELPER_INSERTION_BEFORE_20260903173804",
                "ORIGINAL_REMOTE_VERSIONS_IN_RECORDED_ORDER_PENDING_EACH_SOURCE_APPROVAL",
                "REVIEW_HISTORICAL_PARENT_FUNCTION_VERSIONS_AND_PARENTS_USER_ID_CHRONOLOGY",
                "SPLIT_AND_REVIEW_DATA_PROCEDURES_NOT_SKIP_MIXED_DDL",
                "VERIFY_FUNCTIONS_GRANTS_RLS_TRIGGERS_FINANCE_AUTH_PARITY",
                "LOCAL_ONLY_PS_L2_3_PROPOSAL_TEST_AFTER_CLEAN_REPLAY",
            ],
            "helper_snapshot": {
                "source": "supabase/tests/subscriptions/ps_l2_3_b2_9_live_helper_snapshot.sql",
                "type": "current_state_reconstruction_not_historical",
                "after_base": "20260823093317",
                "before_first_private_helper_use": "20260903173804",
                "validated_for_real_supabase_replay": False,
                "fixture_injected": False,
            },
            "historical_parent_timing": {
                "current_parent_id_first_version": "20260908062059",
                "parents_user_id_and_parent_function_revision": "20260912142706",
                "use_modern_parent_function_before_column_created": False,
                "disable_function_body_validation_to_bypass_failure": False,
            },
            "retimestamped_links": timeline_drift,
            "local_version_conflicts": {
                "duplicate_timestamp_20260926133000": source["migration_issues"]["duplicate_local_timestamp"]["20260926133000"],
                "irregular_12_digit": source["migration_issues"]["irregular_local_timestamp"],
                "scratch_mapping_approved": False,
                "canonical_migrations_renamed": False,
            },
        },
        "mandatory_human_review": {
            "original_statement_array_archive": "PENDING",
            "six_original_vs_git_diffs": "PENDING",
            "initial_schema_ddl_and_grants": "PENDING",
            "eleven_private_helper_placement_and_security": "PENDING",
            "fourteen_data_procedure_operations": "PENDING",
            "timestamp_collisions_in_scratch_only": "PENDING",
            "real_auth_rls_payment_subscription_negative_tests": "PENDING",
        },
        "ordered_migration_decisions": output,
        "note": "No output path for SQL is provided; no SQL has been written, compiled or executed.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        root = args.root.resolve(strict=True)
        out = args.output.resolve()
        migrations = (root / "supabase/migrations").resolve(strict=True)
        if out.is_relative_to(migrations):
            raise ValueError("Refusing to place review artifacts in canonical migrations")
        if out.exists():
            raise ValueError("Output exists; refusing to overwrite source decisions")
        plan = design(root)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "historical_versions": plan["count"],
            "source_linked": plan["source_reconciliation"]["strict_content_links_only"],
            "remote_unlinked": plan["source_reconciliation"]["unlinked_remote_sources_total"],
            "quarantine": plan["source_reconciliation"]["quarantined_data_or_procedural_migrations"],
            "ready_for_full_supabase_replay": False,
        }, indent=2))
    except (ValueError, TypeError, KeyError, OSError, json.JSONDecodeError) as exc:
        print("B3.2 source reconciliation refused: " + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
