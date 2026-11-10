#!/usr/bin/env python3
"""PS-L2.3B B3.1: assemble an 82-version NON-EXECUTABLE provenance manifest.

No network, database access, or SQL execution. Reads checked-in metadata and
canonical SQL bytes for source verification. Never creates migration SQL.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

from b3_0_replay_readiness import audit as b30_audit

RECOVERY = Path("supabase/recovery/historical-baseline")
PARITY = RECOVERY / "parity-fingerprints-readonly-20261109.json"
REVIEW = RECOVERY / "review-queue-readonly-20261110.json"
RISKS = RECOVERY / "statement-risk-screen-readonly-20261110.json"
HELPERS = Path("supabase/tests/subscriptions/ps_l2_3_b2_9_live_helper_snapshot_manifest.json")
VERSION_RE = re.compile(r"^(\d{12}|\d{14})_")
CONFLICTED_DATA_VERSIONS = {"20260920041516", "20260920041606"}
SOURCE_STATES = {
    "exact-bytes", "terminal-lf-only", "leading-lf-only",
    "same-version-content-divergence", "no-content-match",
}


def git_blob_sha1(data):
    return hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def check_local_source(root, remote):
    """Prove that each already-linked local blob still matches its pinned remote hash.

    One narrowly defined linefeed variant is allowed per B2.4 category;
    this never implies SQL semantic equivalence or historical completeness.
    """
    status = remote["content_status"]
    files = remote["matched_git_files"]
    if status not in SOURCE_STATES:
        raise ValueError("Unrecognized historical fingerprint classification")
    if status in {"same-version-content-divergence", "no-content-match"}:
        if files:
            raise ValueError("Unmatched remote SQL cannot have a strict Git content link")
        return []

    if not files:
        raise ValueError("Strict source status without linked local file")

    matches = []
    for relative in files:
        path = (root / relative).resolve(strict=True)
        migration_root = (root / "supabase/migrations").resolve(strict=True)
        if not path.is_relative_to(migration_root) or path.suffix != ".sql":
            raise ValueError("Out-of-tree migration evidence path")
        raw = path.read_bytes()
        if status == "exact-bytes":
            canonical = raw
        elif status == "terminal-lf-only":
            if not raw.endswith(b"\n"):
                raise ValueError("Expected trailing LF in Git migration blob")
            canonical = raw[:-1]
        else:
            canonical = b"\n" + raw
        if git_blob_sha1(canonical) != remote["remote_git_blob_sha1"]:
            raise ValueError("Tracked SQL changed from pinned source fingerprint: " + remote["remote_version"])
        matches.append({
            "path": relative,
            "local_version": VERSION_RE.match(path.name).group(1),
            "local_blob_sha1": git_blob_sha1(raw),
            "verified_strict_variant": status,
            "approved_for_execution": False,
        })
    return matches


def assemble(root):
    root = Path(root).resolve(strict=True)
    preflight = b30_audit(root)
    if preflight["ready_for_disposable_full_replay"]:
        # This assembly tool can only represent blocked candidates, never approval.
        raise ValueError("B3.1 cannot authorize a fully runnable replay")

    parity = read_json(root / PARITY)
    review = read_json(root / REVIEW)
    risks = read_json(root / RISKS)
    helpers = read_json(root / HELPERS)
    if parity.get("schema") != "kheltriva-b2-4-content-fingerprint-v2":
        raise ValueError("Unexpected B2.4 source schema")
    if review.get("schema") != "kheltriva-b2-5-recovery-review-queue-v1":
        raise ValueError("Unexpected B2.5 review schema")
    if risks.get("schema") != "kheltriva-ps-l2-3b-source-reviewed-statement-types-v1":
        raise ValueError("Unexpected B2.6 risk schema")
    if helpers.get("source_type") != "live-current-state-not-historical":
        raise ValueError("Source helper fixture mislabeled as original historical SQL")
    if helpers.get("production_replay_approved") is not False:
        raise ValueError("Unexpected production approval on helper fixture")
    if helpers.get("authoritative_historical_provenance") is not False:
        raise ValueError("Current helper snapshot falsely approved as historical")

    p = parity["remote_rows"]
    r = review["records"]
    x = risks["records"]
    if not p or len(p) != len(r) or len(p) != len(x):
        raise ValueError("Migration evidence row counts disagree")
    if (len(p) != parity["summary"]["remote_total"]
            or len(r) != review["summary"]["migration_records"]
            or len(x) != risks["summary"]["remote_migrations"]):
        raise ValueError("Migration evidence totals disagree")
    versions = [entry["remote_version"] for entry in p]
    if len(versions) != len(set(versions)) or versions != sorted(versions):
        raise ValueError("Historical versions must be unique and strictly ordered")
    if versions != [entry["version"] for entry in r] or versions != [entry["version"] for entry in x]:
        raise ValueError("B2.4/B2.5/B2.6 migration ordering differs")

    stages = []
    for n, (f, review_row, risk_row) in enumerate(zip(p, r, x), start=1):
        version = f["remote_version"]
        if f["remote_name"] != review_row["name"] or f["remote_name"] != risk_row["name"]:
            raise ValueError("Migration source names disagree: " + version)
        if f["remote_statement_count"] != review_row["statements"] or f["remote_statement_count"] != risk_row["stored_statement_count"]:
            raise ValueError("Migration SQL statement counts disagree: " + version)
        if (f["content_status"] != review_row["content_status"]
                or f["matched_git_files"] != review_row["matched_git_files"]):
            raise ValueError("Migration content provenance differs: " + version)
        if (f.get("replay_approved") is not False
                or review_row.get("replay_approved") is not False
                or review_row.get("approval_status") != "PENDING"
                or risk_row.get("safe_to_replay") is not False
                or risk_row.get("review_status") != "PENDING"):
            raise ValueError("An unreviewed migration was marked approved: " + version)
        local_sources = check_local_source(root, f)
        has_direct_dml = risk_row["direct_data_statement_count"] > 0
        has_do = risk_row["do_block_count"] > 0
        has_cte = risk_row["possible_with_mutation_count"] > 0
        record_specific = version in CONFLICTED_DATA_VERSIONS
        requires_quarantine = has_direct_dml or has_do or has_cte or record_specific
        stages.append({
            "ordinal": n,
            "original_remote_version": version,
            "original_remote_name": f["remote_name"],
            "remote_sql_fingerprint_sha1": f["remote_git_blob_sha1"],
            "remote_statement_count": f["remote_statement_count"],
            "source_match_status": f["content_status"],
            "linked_local_sources": local_sources,
            "source_authority": "original_remote_ledger_unarchived",
            "requires_original_sql_source_review": True,
            "data_risk": {
                "direct_top_level_mutation_statements": risk_row["direct_data_statement_count"],
                "procedural_do_blocks": risk_row["do_block_count"],
                "possible_mutating_ctes": risk_row["possible_with_mutation_count"],
                "quoted_uuid_pattern": bool(risk_row["embedded_quoted_uuid_pattern"]),
                "record_specific_literal_conflict": record_specific,
                "quarantine_for_manual_split_or_synthetic_adaptation": requires_quarantine,
            },
            "historical_migration_replay_approved": False,
            "approved_sql_file": None,
            "synthetic_cleanup_adaptation_approved": False,
        })

    # Interstitial source reconstruction is a review-only ordering proposal.
    bootstrap = {
        "phase": "after_historical_base_before_first_private_policy_use",
        "after_remote_version": "20260823093317",
        "before_first_recorded_private_helper_reference": "20260903173804",
        "source": str(HELPERS).replace("\\", "/"),
        "source_type": "current-state-test-only-not-historical",
        "function_count": len(helpers["functions"]),
        "helper_names": sorted(row["helper"] for row in helpers["functions"]),
        "not_historical_creation_evidence": True,
        "requires_private_schema_and_grant_audit": True,
        "requires_base_schema_object_review": True,
        "placement_reviewed_and_approved": False,
        "executable_fixture_injected": False,
    }
    if len(helpers["functions"]) != 11 or len(set(bootstrap["helper_names"])) != 11:
        raise ValueError("Expected eleven unique baseline functions")
    if bootstrap["after_remote_version"] not in versions or bootstrap["before_first_recorded_private_helper_reference"] not in versions:
        raise ValueError("Expected helper timing anchors missing from remote history")
    if not (bootstrap["after_remote_version"] < bootstrap["before_first_recorded_private_helper_reference"]):
        raise ValueError("Invalid helper insertion window")

    gates = {
        "complete_original_sql_archive_verified": False,
        "base_schema_source_divergence_resolved": False,
        "all_remote_versions_source_reviewed": False,
        "foundational_current_state_reconstruction_placement_approved": False,
        "parent_user_id_schema_chronology_validated": False,
        "historical_player_and_finance_data_operations_quarantined_and_approved": False,
        "duplicate_and_12_digit_local_versions_resolved_in_disposable_workspace": False,
        "auth_rls_grants_triggers_and_finance_parity_passed": False,
    }
    if not any(row["original_remote_version"] == "20260912142706" for row in stages):
        raise ValueError("Parent Auth-linkage chronology is missing")
    return {
        "schema": "kheltriva-b3-1-review-only-historical-assembly-v1",
        "mode": "non_executable_source_manifest",
        "git_head_evidence_anchor": parity.get("git_head_at_comparison"),
        "source_project_id": parity.get("project_id"),
        "original_source_versions": len(stages),
        "ready_for_disposable_sql_generation": False,
        "ready_for_disposable_full_replay": False,
        "ready_for_production": False,
        "original_remote_sequence_preserved": True,
        "sql_bodies_embedded": False,
        "sql_files_created": False,
        "bootstrap_insertion_candidate": bootstrap,
        "parent_auth_linkage": {
            "current_parent_id_original_recorded_version": "20260908062059",
            "parents_user_id_column_added_recorded_version": "20260912142706",
            "current_live_parent_function_must_not_be_used_prematurely": True,
            "schema_timing_verified_in_disposable_db": False,
        },
        "migration_issues": {
            "unlinked_remote_sources": sum(not v["linked_local_sources"] for v in stages),
            "same_version_content_divergences": sum(v["source_match_status"] == "same-version-content-divergence" for v in stages),
            "remote_without_any_content_match": sum(v["source_match_status"] == "no-content-match" for v in stages),
            "quarantined_data_or_procedural_review": sum(v["data_risk"]["quarantine_for_manual_split_or_synthetic_adaptation"] for v in stages),
            "unmatched_git_files": parity["summary"]["local_unmatched"],
            "duplicate_local_timestamp": parity["summary"]["local_duplicate_versions"],
            "irregular_local_timestamp": "202610210001_private_player_photo_storage.sql",
        },
        "unmet_release_gates": gates,
        "ordered_original_migrations": stages,
        "warning": "A validated manifest proves source links and review order only. No migration SQL may execute until all gates pass in a disposable environment.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        root = args.root.resolve(strict=True)
        output = args.output.resolve()
        migration_dir = (root / "supabase/migrations").resolve(strict=True)
        if output.is_relative_to(migration_dir):
            raise ValueError("Refusing to write any file under canonical migrations")
        if output.exists():
            raise ValueError("Output already exists; refusing overwrite")
        manifest = assemble(root)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "original_migrations": manifest["original_source_versions"],
            "migration_issues": manifest["migration_issues"],
            "ready_for_disposable_full_replay": manifest["ready_for_disposable_full_replay"],
            "all_release_gates_satisfied": all(manifest["unmet_release_gates"].values()),
        }, indent=2))
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print("B3.1 review-only assembly blocked: " + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
