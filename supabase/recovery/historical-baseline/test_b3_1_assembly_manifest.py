"""B3.1 offline assembly provenance and fail-closed migration quarantine tests."""
import copy
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from b3_1_assembly_manifest import assemble, PARITY, REVIEW, RISKS, HELPERS

ROOT = Path(__file__).resolve().parents[3]


class B31AssemblyTests(unittest.TestCase):
    def test_exactly_eighty_two_historical_migrations_ordered_and_blocked(self):
        out = assemble(ROOT)
        self.assertEqual(out["original_source_versions"], 82)
        self.assertEqual(len(out["ordered_original_migrations"]), 82)
        self.assertEqual(out["ordered_original_migrations"][0]["original_remote_version"], "20260823093317")
        self.assertEqual(out["ordered_original_migrations"][-1]["original_remote_version"], "20261101082001")
        self.assertFalse(out["ready_for_disposable_sql_generation"])
        self.assertFalse(out["ready_for_disposable_full_replay"])
        self.assertFalse(out["ready_for_production"])
        self.assertFalse(out["sql_bodies_embedded"])
        self.assertFalse(out["sql_files_created"])
        self.assertTrue(all(not item["historical_migration_replay_approved"] for item in out["ordered_original_migrations"]))
        self.assertTrue(all(value is False for value in out["unmet_release_gates"].values()))

    def test_real_content_counts_and_timestamp_collisions(self):
        out = assemble(ROOT)
        counts = out["migration_issues"]
        self.assertEqual(counts["unlinked_remote_sources"], 57)
        self.assertEqual(counts["same_version_content_divergences"], 6)
        self.assertEqual(counts["remote_without_any_content_match"], 51)
        self.assertEqual(counts["unmatched_git_files"], 15)
        self.assertEqual(len(counts["duplicate_local_timestamp"]["20260926133000"]), 2)
        self.assertEqual(counts["irregular_local_timestamp"], "202610210001_private_player_photo_storage.sql")
        linked = sum(bool(row["linked_local_sources"]) for row in out["ordered_original_migrations"])
        self.assertEqual(linked, 25)

    def test_data_specific_player_reconciliation_quarantined(self):
        out = assemble(ROOT)
        rows = {item["original_remote_version"]: item for item in out["ordered_original_migrations"]}
        for version in ("20260920041516", "20260920041606"):
            self.assertTrue(rows[version]["data_risk"]["record_specific_literal_conflict"])
            self.assertTrue(rows[version]["data_risk"]["quarantine_for_manual_split_or_synthetic_adaptation"])
            self.assertFalse(rows[version]["synthetic_cleanup_adaptation_approved"])
        self.assertFalse(rows["20260926081053"]["historical_migration_replay_approved"])
        self.assertTrue(rows["20260926081053"]["data_risk"]["direct_top_level_mutation_statements"])

    def test_helper_bootstrap_is_only_a_proposal_with_parent_timing(self):
        out = assemble(ROOT)
        h = out["bootstrap_insertion_candidate"]
        self.assertEqual(h["function_count"], 11)
        self.assertEqual(h["after_remote_version"], "20260823093317")
        self.assertEqual(h["before_first_recorded_private_helper_reference"], "20260903173804")
        self.assertTrue(h["not_historical_creation_evidence"])
        self.assertFalse(h["placement_reviewed_and_approved"])
        self.assertFalse(h["executable_fixture_injected"])
        timing = out["parent_auth_linkage"]
        self.assertLess(timing["current_parent_id_original_recorded_version"],
                        timing["parents_user_id_column_added_recorded_version"])
        self.assertFalse(timing["schema_timing_verified_in_disposable_db"])

    def test_unreviewed_mutation_is_rejected(self):
        with self.source_clone() as tmp:
            path = tmp / REVIEW
            review = json.loads(path.read_text(encoding="utf-8"))
            review["records"][0]["replay_approved"] = True
            path.write_text(json.dumps(review), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "marked approved"):
                assemble(tmp)

    def test_source_reordered_rejected(self):
        with self.source_clone() as tmp:
            path = tmp / RISKS
            risk = json.loads(path.read_text(encoding="utf-8"))
            risk["records"][0], risk["records"][1] = risk["records"][1], risk["records"][0]
            path.write_text(json.dumps(risk), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "ordering differs"):
                assemble(tmp)

    def test_tracked_source_tampering_detected(self):
        with self.source_clone() as tmp:
            p = tmp / "supabase/migrations/20261101082001_enquiries_e5_1_owner_only_delete.sql"
            self.assertTrue(p.exists())
            with p.open("ab") as handle:
                handle.write(b"\n-- unaudited change\n")
            with self.assertRaisesRegex(ValueError, "Tracked SQL changed"):
                assemble(tmp)

    def test_pretending_current_snapshot_historical_is_rejected(self):
        with self.source_clone() as tmp:
            path = tmp / HELPERS
            meta = json.loads(path.read_text(encoding="utf-8"))
            meta["authoritative_historical_provenance"] = True
            path.write_text(json.dumps(meta), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "falsely approved"):
                assemble(tmp)

    def test_no_unapproved_original_sql_can_become_executable(self):
        out = assemble(ROOT)
        for row in out["ordered_original_migrations"]:
            self.assertIsNone(row["approved_sql_file"])
            self.assertTrue(row["requires_original_sql_source_review"])
            self.assertEqual(row["source_authority"], "original_remote_ledger_unarchived")

    def source_clone(self):
        class Clone:
            def __init__(self):
                self.tmp = tempfile.TemporaryDirectory()
            def __enter__(self):
                root = Path(self.tmp.name)
                files = (PARITY, REVIEW, RISKS, HELPERS,
                         Path("supabase/tests/subscriptions/ps_l2_3_local_private_baseline.sql"),
                         Path("supabase/tests/subscriptions/ps_l2_3_b2_9_live_helper_snapshot.sql"),
                         Path(".github/workflows/subscriptions-ps-l2-3-supabase-local.yml"),
                         Path("supabase/proposals/subscriptions/ps_l2_3_foundation.sql"))
                for relative in files:
                    dest = root / relative
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(ROOT / relative, dest)
                migr_dir = root / "supabase/migrations"
                migr_dir.mkdir(parents=True, exist_ok=True)
                for file in (ROOT / "supabase/migrations").glob("*.sql"):
                    shutil.copy2(file, migr_dir / file.name)
                return root
            def __exit__(self, *_):
                self.tmp.cleanup()
        return Clone()


if __name__ == "__main__":
    unittest.main()
