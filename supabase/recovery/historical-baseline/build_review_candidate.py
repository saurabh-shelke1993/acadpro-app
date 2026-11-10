#!/usr/bin/env python3
"""Create a NON-EXECUTABLE, fail-closed B2.5 disposable-replay review candidate.

This tool uses metadata-only review evidence. It neither reads SQL bodies nor
creates/renames/applies database migrations. Replay approval is not implemented.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

EXPECTED_PARITY_SCHEMA = "kheltriva-b2-4-content-fingerprint-v2"
EXPECTED_REVIEW_SCHEMA = "kheltriva-b2-5-recovery-review-queue-v1"


def build_candidate(parity, review):
    if parity.get("schema") != EXPECTED_PARITY_SCHEMA:
        raise ValueError("Unexpected parity evidence schema")
    if review.get("schema") != EXPECTED_REVIEW_SCHEMA:
        raise ValueError("Unexpected review evidence schema")

    fingerprints = parity.get("remote_rows", [])
    reviews = review.get("records", [])
    if not fingerprints or len(fingerprints) != len(reviews):
        raise ValueError("Migration record counts disagree")

    if (parity.get("summary", {}).get("remote_total") != len(fingerprints)
            or review.get("summary", {}).get("migration_records") != len(reviews)):
        raise ValueError("Evidence counts do not match manifest")

    unique_versions = [entry["remote_version"] for entry in fingerprints]
    if unique_versions != sorted(set(unique_versions)):
        raise ValueError("Remote records must be unique and in historical version order")

    review_versions = [entry["version"] for entry in reviews]
    if unique_versions != review_versions:
        raise ValueError("Review queue does not match the remote migration sequence")

    if not review.get("unresolved_helpers"):
        raise ValueError("Baseline helper provenance requires separate explicit evidence")

    for helper in review["unresolved_helpers"]:
        if helper.get("provenance_status") != "UNRESOLVED" or helper.get("replay_approved") is not False:
            raise ValueError("Invalid foundational helper review state")

    gates = review.get("global_gates", {})
    if not gates or any(value is not False for value in gates.values()):
        raise ValueError("This review-only tool cannot validate approved gates")

    if review.get("eligible_for_disposable_replay") is not False:
        raise ValueError("Source evidence must remain non-executable")

    sequence = []
    for index, (fingerprint, row) in enumerate(zip(fingerprints, reviews), start=1):
        if (fingerprint["remote_version"] != row["version"]
                or fingerprint["remote_name"] != row["name"]
                or fingerprint["content_status"] != row["content_status"]
                or fingerprint["matched_git_files"] != row["matched_git_files"]):
            raise ValueError("Fingerprint/review lineage mismatch")
        if (row.get("approval_status") != "PENDING"
                or row.get("replay_approved") is not False
                or row.get("requires_manual_review") is not True
                or fingerprint.get("replay_approved") is not False):
            raise ValueError("An unreviewed or approved migration cannot enter the blocked candidate")

        sequence.append({
            "order": index,
            "remote_version": row["version"],
            "remote_name": row["name"],
            "content_status": row["content_status"],
            "git_source_links": row["matched_git_files"],
            "risk_flags": row["review_flags"],
            "manual_review_status": "PENDING",
            "local_replay_permitted": False,
        })

    summary = parity["summary"]
    pending = {
        "historical_sql_export_and_sensitive_review": True,
        "same_version_sql_divergences": summary["same_version_content_divergence"],
        "no_content_match_remote_records": summary["no_content_match"],
        "unmatched_local_migration_files": summary["local_unmatched"],
        "foundational_helper_origins": len(review["unresolved_helpers"]),
        "duplicate_version_ids_in_git": list(summary.get("local_duplicate_versions", {}).keys()),
        "tenant_role_rls_finance_regression": True,
    }

    fingerprint_bytes = json.dumps(
        {"review": review["records"], "parity": parity["remote_rows"]},
        sort_keys=True, separators=(",", ":")).encode("utf-8")

    return {
        "schema": "kheltriva-b2-5-nonexecutable-candidate-v1",
        "mode": "review-only",
        "source_git_head": review["git_head_at_review"],
        "evidence_sha256": hashlib.sha256(fingerprint_bytes).hexdigest(),
        "remote_migrations": len(sequence),
        "ready_for_disposable_replay": False,
        "ready_for_production": False,
        "sql_embedded": False,
        "no_hosted_db_access": True,
        "blocking_issues": pending,
        "required_manual_approval": True,
        "ordered_historical_records": sequence,
        "note": "No runnable migration tree is generated. Never alter applied remote history.",
    }


def write_candidate(output: Path, candidate):
    if output.exists():
        raise ValueError("Output exists; refusing to overwrite")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(candidate, indent=2) + "\n", encoding="utf-8")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--parity", type=Path, required=True)
    p.add_argument("--review", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    try:
        parity = json.loads(args.parity.read_text(encoding="utf-8"))
        review = json.loads(args.review.read_text(encoding="utf-8"))
        result = build_candidate(parity, review)
        write_candidate(args.output, result)
        print(json.dumps({
            "remote_migrations": result["remote_migrations"],
            "ready_for_disposable_replay": result["ready_for_disposable_replay"],
            "blocking_issues": result["blocking_issues"],
        }, indent=2))
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as e:
        print(f"Review-candidate gate blocked: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
