#!/usr/bin/env python3
"""PS-L2.3B B3.0: read-only, fail-closed replay-readiness inspection.

No network access, SQL execution, migration creation or modification.
A green *audit* result means blockers were detected correctly, NOT that replay is ready.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

FUNCTION_DEF = re.compile(
    r"\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+private\.([a-z_][a-z_0-9]*)\s*\(",
    re.I,
)
DATE_PREFIX = re.compile(r"^(\d{12,14})_")
REQUIRED = {
    "old_bootstrap": "supabase/tests/subscriptions/ps_l2_3_local_private_baseline.sql",
    "current_snapshot": "supabase/tests/subscriptions/ps_l2_3_b2_9_live_helper_snapshot.sql",
    "snapshot_manifest": "supabase/tests/subscriptions/ps_l2_3_b2_9_live_helper_snapshot_manifest.json",
    "parity": "supabase/recovery/historical-baseline/parity-fingerprints-readonly-20261109.json",
    "review_queue": "supabase/recovery/historical-baseline/review-queue-readonly-20261110.json",
    "old_workflow": ".github/workflows/subscriptions-ps-l2-3-supabase-local.yml",
    "subscription_proposal": "supabase/proposals/subscriptions/ps_l2_3_foundation.sql",
}
EARLY_CI_FIXTURE_VERSION = "20260823100000"
PARENTS_USER_ID_ADD_VERSION = "20260912142706"


def get_text(root, relative):
    return (root / relative).read_text(encoding="utf-8")


def get_json(root, relative):
    return json.loads(get_text(root, relative))


def audit(root):
    root = Path(root).resolve(strict=True)
    sql_files = sorted((root / "supabase/migrations").glob("*.sql"))
    if not sql_files:
        raise ValueError("Missing canonical migrations; cannot assess readiness")

    local_versions = {}
    irregular_versions = []
    for file in sql_files:
        match = DATE_PREFIX.match(file.name)
        if match is None:
            raise ValueError("Unexpected local migration file name: " + file.name)
        local_versions.setdefault(match.group(1), []).append(file.name)
        if len(match.group(1)) != 14:
            irregular_versions.append(file.name)

    old = get_text(root, REQUIRED["old_bootstrap"])
    current = get_text(root, REQUIRED["current_snapshot"])
    snapshot = get_json(root, REQUIRED["snapshot_manifest"])
    fingerprints = get_json(root, REQUIRED["parity"])
    review = get_json(root, REQUIRED["review_queue"])
    workflow = get_text(root, REQUIRED["old_workflow"])
    get_text(root, REQUIRED["subscription_proposal"])

    if fingerprints.get("schema") != "kheltriva-b2-4-content-fingerprint-v2":
        raise ValueError("Unexpected migration parity source schema")
    if snapshot.get("schema") != "kheltriva-b2-9-current-private-helper-snapshot-v1":
        raise ValueError("Unexpected current-state snapshot source schema")
    if review.get("schema") != "kheltriva-b2-5-recovery-review-queue-v1":
        raise ValueError("Unexpected historical review queue schema")

    source = fingerprints["summary"]
    remote_rows = fingerprints["remote_rows"]
    manifest_functions = snapshot["functions"]
    if source["remote_total"] != len(remote_rows):
        raise ValueError("Remote fingerprint history count mismatch")
    if source["local_total"] != len(sql_files):
        raise ValueError("Tracked migration file count changed since fingerprint audit")
    if review["summary"]["migration_records"] != len(remote_rows):
        raise ValueError("Review queue and migration fingerprints disagree")

    pinned_versions = [r["remote_version"] for r in remote_rows]
    review_versions = [r["version"] for r in review["records"]]
    if pinned_versions != review_versions:
        raise ValueError("Unreviewed remote history change or source ordering conflict")

    expected_new = {f["helper"] for f in manifest_functions}
    actual_new = set(FUNCTION_DEF.findall(current))
    if len(manifest_functions) != 11 or len(expected_new) != 11 or actual_new != expected_new:
        raise ValueError("Current-state helper snapshot definition count mismatch")
    if snapshot.get("authoritative_historical_provenance") is not False:
        raise ValueError("Current-state fixture is being misrepresented as historical")
    if snapshot.get("production_replay_approved") is not False:
        raise ValueError("Unexpected production approval on fixture")

    old_defs = set(FUNCTION_DEF.findall(old))
    overlap = sorted(old_defs & actual_new)
    legacy_only = sorted(old_defs - actual_new)
    canonical_dupes = {
        version: sorted(names) for version, names in local_versions.items()
        if len(names) > 1
    }

    # The historical version and first-use order are source facts from B2.
    old_bootstrap_is_early = (
        "private.current_parent_id()" in old
        and EARLY_CI_FIXTURE_VERSION < PARENTS_USER_ID_ADD_VERSION
    )
    body_validation_disabled = bool(re.search(
        r"\bSET\s+check_function_bodies\s*=\s*off\s*;", old, re.I
    ))
    injects_old_fixture = (
        "cp supabase/tests/subscriptions/ps_l2_3_local_private_baseline.sql" in workflow
        and "supabase/migrations/20260823100000_ps_l2_3_ci_only_private_baseline.sql" in workflow
    )
    tries_full_replay = "supabase db start" in workflow
    tries_candidate_apply = (
        "ps_l2_3_foundation.sql" in workflow
        and "psql" in workflow
    )
    source_conflicts = [
        row["remote_version"] for row in remote_rows
        if row["content_status"] == "same-version-content-divergence"
    ]
    unmatched_remote = [
        row["remote_version"] for row in remote_rows
        if row["content_status"] == "no-content-match"
    ]
    source_unlinked = [
        row["remote_version"] for row in remote_rows
        if not row.get("matched_git_files")
    ]
    hashes = {
        "old_ci_fixture_sha256": hashlib.sha256(old.encode("utf-8")).hexdigest(),
        "b29_fixture_sha256": hashlib.sha256(current.encode("utf-8")).hexdigest(),
        "original_ci_workflow_sha256": hashlib.sha256(workflow.encode("utf-8")).hexdigest(),
    }

    gates = [
        {
            "gate": "historical_source_and_order",
            "ready": not (source_conflicts or unmatched_remote
                         or source["local_unmatched"] or canonical_dupes or irregular_versions),
            "evidence": {
                "remote_migrations": len(remote_rows),
                "local_files": len(sql_files),
                "content_matched_remote": source["total_strict_content_links"],
                "same_version_content_conflicts": source_conflicts,
                "without_any_content_match": len(unmatched_remote),
                "remote_not_content_linked": len(source_unlinked),
                "local_unmatched": source["local_unmatched"],
                "duplicate_version_ids": canonical_dupes,
                "nonstandard_timestamp_filenames": sorted(irregular_versions),
            },
        },
        {
            "gate": "foundational_helper_origin",
            "ready": snapshot["authoritative_historical_provenance"],
            "evidence": {
                "current_verified_helpers": len(manifest_functions),
                "historical_origin_unproven": len(review["unresolved_helpers"]),
                "current_state_fixture_not_historical": True,
            },
        },
        {
            "gate": "overlapping_bootstrap_fixtures",
            "ready": not overlap and not legacy_only,
            "evidence": {
                "legacy_helpers": sorted(old_defs),
                "b29_current_helpers": sorted(actual_new),
                "duplicate_definition_names": overlap,
                "legacy_only_definitions_require_historical_order": legacy_only,
            },
        },
        {
            "gate": "parent_user_id_schema_timing",
            "ready": not old_bootstrap_is_early and not body_validation_disabled,
            "evidence": {
                "legacy_ci_fixture_timestamp": EARLY_CI_FIXTURE_VERSION,
                "parents_user_id_recorded_addition": PARENTS_USER_ID_ADD_VERSION,
                "legacy_fixture_creates_current_parent_id_early": old_bootstrap_is_early,
                "legacy_fixture_disables_function_body_validation": body_validation_disabled,
            },
        },
        {
            "gate": "legacy_ci_workflow_replay_guard",
            "ready": not injects_old_fixture and not tries_candidate_apply,
            "evidence": {
                "inserts_old_fixture_into_disposable_migrations": injects_old_fixture,
                "attempts_full_supabase_replay": tries_full_replay,
                "attempts_subscription_proposal_if_replay_succeeds": tries_candidate_apply,
                "legacy_ci_unmodified_by_b30": True,
            },
        },
        {
            "gate": "original_sql_manual_data_security_review",
            "ready": False,
            "evidence": {
                "pending_review_records": review["summary"]["requires_review"],
                "protected_original_sql_archive_signed_off": False,
                "historical_player_payment_cleanups_approved": False,
            },
        },
        {
            "gate": "actual_supabase_auth_rls_finance_parity",
            "ready": False,
            "evidence": {
                "b29_synthetic_postgres17_tested": True,
                "full_supabase_replay_passed": False,
                "ps_l2_3_integration_passed": False,
            },
        },
    ]
    return {
        "schema": "kheltriva-b3-0-replay-readiness-v1",
        "mode": "offline_source_audit_no_sql_execution",
        "production_writes": False,
        "candidate_sql_executed": False,
        "ready_for_disposable_full_replay": all(g["ready"] for g in gates),
        "ready_for_production": False,
        "source_hashes": hashes,
        "gates": gates,
        "note": "PASS of this inspection means evidence was checked, not permission to execute migrations.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise ValueError("Output already exists; refusing overwrite")
        result = audit(args.root)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "ready_for_disposable_full_replay": result["ready_for_disposable_full_replay"],
            "blocked_gates": [g["gate"] for g in result["gates"] if not g["ready"]],
        }, indent=2))
    except (ValueError, KeyError, TypeError, OSError, json.JSONDecodeError) as exc:
        print("B3.0 readiness analysis blocked: " + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
