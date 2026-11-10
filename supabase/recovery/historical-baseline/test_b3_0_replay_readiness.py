"""B3.0 offline readiness checks. No hosted or disposable database connections."""
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from b3_0_replay_readiness import REQUIRED, audit

ROOT = Path(__file__).resolve().parents[3]


class B30ReplayReadinessTests(unittest.TestCase):
    def test_repo_is_correctly_blocked(self):
        result = audit(ROOT)
        self.assertFalse(result["ready_for_disposable_full_replay"])
        self.assertFalse(result["ready_for_production"])
        self.assertFalse(result["candidate_sql_executed"])
        self.assertFalse(result["production_writes"])
        self.assertEqual(len(result["gates"]), 7)
        self.assertTrue(all(g["ready"] is False for g in result["gates"]))

    def test_detects_original_migration_gaps(self):
        result = audit(ROOT)
        g = {x["gate"]: x for x in result["gates"]}
        evidence = g["historical_source_and_order"]["evidence"]
        self.assertEqual(evidence["remote_migrations"], 82)
        self.assertEqual(evidence["local_files"], 40)
        self.assertEqual(evidence["content_matched_remote"], 25)
        self.assertEqual(len(evidence["same_version_content_conflicts"]), 6)
        self.assertEqual(evidence["without_any_content_match"], 51)
        self.assertEqual(evidence["remote_not_content_linked"], 57)
        self.assertEqual(evidence["local_unmatched"], 15)
        self.assertEqual(len(evidence["duplicate_version_ids"]["20260926133000"]), 2)
        self.assertEqual(evidence["nonstandard_timestamp_filenames"],
                         ["202610210001_private_player_photo_storage.sql"])

    def test_detects_legacy_and_b29_duplicate_helpers(self):
        result = audit(ROOT)
        g = {x["gate"]: x["evidence"] for x in result["gates"]}
        self.assertEqual(
            g["overlapping_bootstrap_fixtures"]["duplicate_definition_names"],
            ["current_academy_id", "current_user_role", "is_academy_owner", "is_super_admin"],
        )
        self.assertEqual(
            g["overlapping_bootstrap_fixtures"]["legacy_only_definitions_require_historical_order"],
            ["can_manage_academy", "current_parent_id", "is_parent_of_player"],
        )
        self.assertTrue(g["parent_user_id_schema_timing"]["legacy_fixture_creates_current_parent_id_early"])
        self.assertTrue(g["parent_user_id_schema_timing"]["legacy_fixture_disables_function_body_validation"])

    def test_old_workflow_is_identified_not_mutated(self):
        result = audit(ROOT)
        w = next(g["evidence"] for g in result["gates"] if g["gate"] == "legacy_ci_workflow_replay_guard")
        self.assertTrue(w["inserts_old_fixture_into_disposable_migrations"])
        self.assertTrue(w["attempts_subscription_proposal_if_replay_succeeds"])
        self.assertTrue(w["legacy_ci_unmodified_by_b30"])

    def test_fails_if_migration_file_removed(self):
        with self.fixture_clone() as folder:
            first = next((folder / "supabase/migrations").glob("*.sql"))
            first.unlink()
            with self.assertRaisesRegex(ValueError, "file count changed"):
                audit(folder)

    def test_fails_if_snapshot_is_wrongly_marked_historical(self):
        with self.fixture_clone() as folder:
            path = folder / REQUIRED["snapshot_manifest"]
            manifest = json.loads(path.read_text(encoding="utf-8"))
            manifest["authoritative_historical_provenance"] = True
            path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "misrepresented as historical"):
                audit(folder)

    def test_fails_if_reviewer_history_order_is_mutated(self):
        with self.fixture_clone() as folder:
            path = folder / REQUIRED["review_queue"]
            review = json.loads(path.read_text(encoding="utf-8"))
            review["records"].reverse()
            path.write_text(json.dumps(review), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "source ordering conflict"):
                audit(folder)

    def fixture_clone(self):
        """Return temporary fixture root with only B3.0's required inputs."""
        class Clone:
            def __init__(self):
                self.tmp = tempfile.TemporaryDirectory()
            def __enter__(self):
                root = Path(self.tmp.name)
                (root / "supabase/migrations").mkdir(parents=True)
                for src in (ROOT / "supabase/migrations").glob("*.sql"):
                    shutil.copy2(src, root / "supabase/migrations" / src.name)
                for relative in REQUIRED.values():
                    dest = root / relative
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(ROOT / relative, dest)
                return root
            def __exit__(self, *_):
                self.tmp.cleanup()
        return Clone()


if __name__ == "__main__":
    unittest.main()
