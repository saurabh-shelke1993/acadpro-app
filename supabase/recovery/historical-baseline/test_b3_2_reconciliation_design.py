"""B3.2 metadata-only historical source reconciliation and disposable design tests."""
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from b3_2_reconciliation_design import design, DIVERGENCES, REVIEW, RECOVERY
from b3_1_assembly_manifest import PARITY, RISKS, HELPERS
from b3_0_replay_readiness import REQUIRED

ROOT = Path(__file__).resolve().parents[3]


class B32SourceReconciliationTests(unittest.TestCase):
    def test_eighty_two_decisions_all_non_executable(self):
        result = design(ROOT)
        self.assertEqual(result["count"], 82)
        self.assertEqual(len(result["ordered_migration_decisions"]), 82)
        self.assertFalse(result["sql_content_embedded"])
        self.assertFalse(result["sql_files_generated"])
        self.assertFalse(result["ready_to_build_executable_migrations"])
        self.assertFalse(result["ready_for_full_supabase_replay"])
        self.assertFalse(result["ready_for_production"])
        self.assertTrue(all(x["runnable_sql_path"] is None and not x["replay_approved"]
                            for x in result["ordered_migration_decisions"]))
        self.assertEqual(result["ordered_migration_decisions"][0]["original_version"], "20260823093317")
        self.assertEqual(result["ordered_migration_decisions"][-1]["original_version"], "20261101082001")

    def test_exact_provenance_class_counts(self):
        result = design(ROOT)
        src = result["source_reconciliation"]
        self.assertEqual(src["strict_content_links_only"], 25)
        self.assertEqual(src["same_version_conflicts"], 6)
        self.assertEqual(src["remote_without_content_match"], 51)
        self.assertEqual(src["unlinked_remote_sources_total"], 57)
        self.assertEqual(src["quarantined_data_or_procedural_migrations"], 14)
        self.assertEqual(len(result["disposable_workspace_design"]["retimestamped_links"]), 8)

    def test_six_divergent_migrations_remain_pending(self):
        result = design(ROOT)
        d = result["source_reconciliation"]["source_conflict_decisions"]
        self.assertEqual(len(d), 6)
        self.assertEqual(sum(x["review_category"] == "record_specific_cleanup_conflict" for x in d), 2)
        self.assertTrue(all(x["status"] == "PENDING" and x["approved"] is False for x in d))
        rows = {x["original_version"]: x for x in result["ordered_migration_decisions"]}
        for ver in ("20260920041516", "20260920041606"):
            self.assertTrue(rows[ver]["data_or_procedure_quarantine"])
            self.assertEqual(rows[ver]["source_resolution"], "MANUAL_REMOTE_VS_LOCAL_SOURCE_DIFF")
            self.assertFalse(rows[ver]["record_specific_selector_approved"])

    def test_initial_schema_not_falsely_reconciled(self):
        result = design(ROOT)
        base = result["source_reconciliation"]["initial_base_schema"]
        self.assertEqual(base["remote_version"], "20260823093317")
        self.assertEqual(base["same_detected_create_object_count"], 17)
        self.assertEqual(base["full_sql_equivalence"], "UNPROVEN")

    def test_current_helper_placement_and_parent_chronology_not_overridden(self):
        design_data = design(ROOT)["disposable_workspace_design"]
        helper = design_data["helper_snapshot"]
        self.assertEqual(helper["after_base"], "20260823093317")
        self.assertEqual(helper["before_first_private_helper_use"], "20260903173804")
        self.assertFalse(helper["fixture_injected"])
        self.assertFalse(helper["validated_for_real_supabase_replay"])
        timing = design_data["historical_parent_timing"]
        self.assertLess(timing["current_parent_id_first_version"], timing["parents_user_id_and_parent_function_revision"])
        self.assertFalse(timing["disable_function_body_validation_to_bypass_failure"])

    def test_duplicate_and_nonstandard_versions_never_renamed(self):
        design_data = design(ROOT)["disposable_workspace_design"]
        conf = design_data["local_version_conflicts"]
        self.assertEqual(len(conf["duplicate_timestamp_20260926133000"]), 2)
        self.assertEqual(conf["irregular_12_digit"], "202610210001_private_player_photo_storage.sql")
        self.assertFalse(conf["canonical_migrations_renamed"])
        self.assertFalse(conf["scratch_mapping_approved"])
        for relink in design_data["retimestamped_links"]:
            self.assertIsNone(relink["synthetic_version_assigned"])
            self.assertFalse(relink["remote_history_repaired"])

    def test_unauthorized_approval_in_six_divergences_refused(self):
        with self.cloned_source() as base:
            file = base / DIVERGENCES
            data = json.loads(file.read_text())
            data["cases"][0]["approved"] = True
            file.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, "unauthorized approval"):
                design(base)

    def test_cross_project_evidence_refused(self):
        with self.cloned_source() as base:
            file = base / DIVERGENCES
            data = json.loads(file.read_text())
            data["project_id"] = "different-project"
            file.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, "different Supabase project"):
                design(base)

    def test_missing_divergence_case_refused(self):
        with self.cloned_source() as base:
            file = base / DIVERGENCES
            data = json.loads(file.read_text())
            data["cases"].pop()
            file.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, "missing or duplicated"):
                design(base)

    def test_tampered_git_blob_refused(self):
        with self.cloned_source() as base:
            path = base / "supabase/migrations/20261101082001_enquiries_e5_1_owner_only_delete.sql"
            with path.open("ab") as f:
                f.write(b"\n-- changed without review")
            with self.assertRaisesRegex(ValueError, "Tracked SQL changed|Expected trailing LF"):
                design(base)

    def cloned_source(self):
        class Clone:
            def __init__(self):
                self.temp = tempfile.TemporaryDirectory()
            def __enter__(self):
                target = Path(self.temp.name)
                required = set(Path(p) for p in REQUIRED.values())
                required.update((PARITY, REVIEW, RISKS, HELPERS, DIVERGENCES))
                for relative in required:
                    dest = target / relative
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(ROOT / relative, dest)
                migrations = target / "supabase/migrations"
                migrations.mkdir(parents=True, exist_ok=True)
                for f in (ROOT / "supabase/migrations").glob("*.sql"):
                    shutil.copy2(f, migrations / f.name)
                return target
            def __exit__(self, *_):
                self.temp.cleanup()
        return Clone()


if __name__ == "__main__":
    unittest.main()
