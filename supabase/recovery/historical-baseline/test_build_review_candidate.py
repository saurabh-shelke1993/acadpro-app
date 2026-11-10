import tempfile
from pathlib import Path
import unittest

from build_review_candidate import build_candidate, write_candidate


def fixtures():
    original = {
        "remote_version": "20260823093317",
        "remote_name": "remote_schema",
        "content_status": "same-version-content-divergence",
        "matched_git_files": [],
        "replay_approved": False,
    }
    parity = {
        "schema": "kheltriva-b2-4-content-fingerprint-v2",
        "summary": {
            "remote_total": 1,
            "same_version_content_divergence": 1,
            "no_content_match": 0,
            "local_unmatched": 1,
            "local_duplicate_versions": {"20260926133000": ["one.sql", "two.sql"]},
        },
        "remote_rows": [original],
    }
    review = {
        "schema": "kheltriva-b2-5-recovery-review-queue-v1",
        "git_head_at_review": "abc123",
        "summary": {"migration_records": 1},
        "global_gates": {"sql_review": False, "baseline": False},
        "eligible_for_disposable_replay": False,
        "unresolved_helpers": [{
            "name": "is_super_admin",
            "provenance_status": "UNRESOLVED",
            "replay_approved": False,
        }],
        "records": [{
            "version": "20260823093317",
            "name": "remote_schema",
            "content_status": "same-version-content-divergence",
            "matched_git_files": [],
            "review_flags": ["privilege_ddl"],
            "approval_status": "PENDING",
            "requires_manual_review": True,
            "replay_approved": False,
        }],
    }
    return parity, review


class ReplayCandidateReviewTests(unittest.TestCase):
    def test_emits_metadata_only_and_blocked(self):
        p, r = fixtures()
        out = build_candidate(p, r)
        self.assertEqual(out["remote_migrations"], 1)
        self.assertFalse(out["ready_for_disposable_replay"])
        self.assertFalse(out["ready_for_production"])
        self.assertFalse(out["sql_embedded"])
        self.assertFalse(out["ordered_historical_records"][0]["local_replay_permitted"])
        self.assertEqual(out["blocking_issues"]["same_version_sql_divergences"], 1)

    def test_review_approval_flag_does_not_bypass_gate(self):
        p, r = fixtures()
        r["records"][0]["replay_approved"] = True
        with self.assertRaisesRegex(ValueError, "unreviewed or approved"):
            build_candidate(p, r)

    def test_attempt_to_remove_foundation_gate_refused(self):
        p, r = fixtures()
        r["unresolved_helpers"] = []
        with self.assertRaisesRegex(ValueError, "Baseline helper"):
            build_candidate(p, r)

    def test_review_and_parity_mismatch_refused(self):
        p, r = fixtures()
        r["records"][0]["name"] = "unexpected"
        with self.assertRaisesRegex(ValueError, "lineage mismatch"):
            build_candidate(p, r)

    def test_changed_gate_to_true_refused(self):
        p, r = fixtures()
        r["global_gates"]["baseline"] = True
        with self.assertRaisesRegex(ValueError, "cannot validate approved"):
            build_candidate(p, r)

    def test_existing_candidate_is_not_overwritten(self):
        p, r = fixtures()
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "candidate.json"
            write_candidate(target, build_candidate(p, r))
            initial = target.read_text()
            with self.assertRaisesRegex(ValueError, "exists"):
                write_candidate(target, build_candidate(p, r))
            self.assertEqual(target.read_text(), initial)


if __name__ == "__main__":
    unittest.main()
