"""B3.4 synthetic SQL Editor CSV importer integrity tests: no live DB access."""
import csv
import hashlib
import json
from pathlib import Path
from unittest.mock import patch
import tempfile
import unittest

from attest_private_archive import git_blob_sha1
from b3_4_import_dashboard_csv import (
    read_csv_exports, preverify, import_csv_archive, finalize_existing_private_archive,
)
from b3_1_assembly_manifest import PARITY, RISKS
from b3_3_original_source_audit import EVIDENCE


class DashboardCsvPrivateArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.private = self.root / "supabase/recovery/historical-baseline/.recovery-private"
        self.input = self.private / "csv-downloads"
        self.input.mkdir(parents=True)
        self.output = self.private / "archive-001"
        self.migrations = self.root / "supabase/migrations"
        self.migrations.mkdir(parents=True)
        self.rows = []
        for i in range(82):
            statements = [
                f"-- synthetic comment with newline and comma,\nSELECT 'value; {i}';",
                f"SELECT {i};",
            ]
            if i < 4:
                statements.append(f"SELECT 'extra {i}';")
            self.rows.append({
                "version": f"20260101{i:06d}",
                "name": "synthetic",
                "statements": statements,
            })
        self.write_metadata()
        self.write_csv()

    def tearDown(self):
        self.temp.cleanup()

    def write_metadata(self):
        linked = []
        individual = []
        for row in self.rows:
            joined = "".join(row["statements"]).encode("utf-8")
            linked.append({
                "remote_version": row["version"],
                "remote_name": row["name"],
                "remote_statement_count": len(row["statements"]),
                "remote_sql_bytes": len(joined),
                "remote_git_blob_sha1": git_blob_sha1(joined),
            })
            for index, sql in enumerate(row["statements"], 1):
                encoded = sql.encode("utf-8")
                individual.append({
                    "version": row["version"],
                    "name": row["name"],
                    "ordinal": index,
                    "sql_byte_length": len(encoded),
                    "original_sql_element_sha256": hashlib.sha256(encoded).hexdigest(),
                })
        self.assertEqual(len(individual), 168)
        payloads = (
            (PARITY, {"schema": "kheltriva-b2-4-content-fingerprint-v2",
                      "project_id": "ulyealhkmlorsbdiknrh",
                      "summary": {"remote_total": 82}, "remote_rows": linked}),
            (EVIDENCE, {"project_id": "ulyealhkmlorsbdiknrh", "items": individual}),
        )
        for relative, content in payloads:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(content), encoding="utf-8")

    def write_csv(self):
        for offset in range(0, 82, 20):
            with (self.input / f"chunk-{offset:03d}.csv").open(
                    "w", encoding="utf-8", newline="") as file:
                writer = csv.DictWriter(file, fieldnames=["migration_json"])
                writer.writeheader()
                for row in self.rows[offset:offset + 20]:
                    writer.writerow({"migration_json": json.dumps(row)})

    def test_five_csv_batches_and_quoted_multiline_sql(self):
        actual = read_csv_exports(self.input)
        self.assertEqual(len(actual), 82)
        self.assertEqual(actual[0]["statements"], self.rows[0]["statements"])

    def test_preverify_all_82_versions_and_168_original_sql_elements(self):
        verified = preverify(self.root, read_csv_exports(self.input))
        self.assertEqual(verified["original_statement_elements"], 168)
        self.assertTrue(verified["source_hashes_verified_before_archive"])
        self.assertFalse(verified["ready_for_disposable_replay"])
        self.assertFalse(self.output.exists())

    def test_modified_sql_refused_without_writing_archive(self):
        target = self.input / "chunk-000.csv"
        with target.open("r", encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))
        obj = json.loads(rows[0]["migration_json"])
        obj["statements"][0] += " TAMPERED"
        rows[0]["migration_json"] = json.dumps(obj)
        with target.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["migration_json"])
            writer.writeheader()
            writer.writerows(rows)
        with self.assertRaisesRegex(ValueError, "fingerprint"):
            import_csv_archive(self.root, self.input, self.output)
        self.assertFalse(self.output.exists())

    def test_incomplete_csv_refused_before_writing(self):
        (self.input / "chunk-080.csv").unlink()
        with self.assertRaisesRegex(ValueError, "incomplete"):
            import_csv_archive(self.root, self.input, self.output)
        self.assertFalse(self.output.exists())

    def test_duplicate_version_rejected(self):
        (self.input / "chunk-080.csv").unlink()
        with (self.input / "chunk-060.csv").open("r",encoding="utf-8",newline="") as file:
            rows = list(csv.DictReader(file))
        with (self.input / "chunk-080.csv").open("w",encoding="utf-8",newline="") as file:
            writer = csv.DictWriter(file,fieldnames=["migration_json"])
            writer.writeheader()
            writer.writerows(rows[:2])
        with self.assertRaisesRegex(ValueError, "Duplicate historical"):
            import_csv_archive(self.root, self.input, self.output)
        self.assertFalse(self.output.exists())

    def test_refuses_csv_source_outside_private_folder(self):
        with self.assertRaisesRegex(ValueError, "ignored .recovery-private"):
            import_csv_archive(self.root, self.root, self.output)

    def test_refuses_output_under_canonical_migrations(self):
        with self.assertRaisesRegex(ValueError, "ignored .recovery-private"):
            import_csv_archive(self.root, self.input, self.migrations / "danger")

    def test_refuses_overwriting_existing_archive(self):
        self.output.mkdir()
        with self.assertRaisesRegex(ValueError, "overwrite"):
            import_csv_archive(self.root, self.input, self.output)

    def test_rejects_wrong_csv_column(self):
        (self.input / "chunk-000.csv").write_text(
            "version,statements\nx,y\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "migration_json"):
            read_csv_exports(self.input)

    def test_all_fourteen_quarantine_cases_remain_blocked(self):
        root = Path(__file__).resolve().parents[3]
        register = json.loads((
            root / "supabase/recovery/historical-baseline/"
            "b3_4_data_procedural_quarantine_review_20261111.json"
        ).read_text(encoding="utf-8"))
        risks = json.loads((root / RISKS).read_text(encoding="utf-8"))
        expected = {
            row["version"] for row in risks["records"]
            if row["direct_data_statement_count"] > 0
            or row["do_block_count"] > 0
            or row["possible_with_mutation_count"] > 0
            or row["version"] in ("20260920041516", "20260920041606")
        }
        actual = {row["version"] for row in register["cases"]}
        self.assertEqual(len(actual), 14)
        self.assertEqual(actual, expected)
        self.assertFalse(register["all_approved"])
        self.assertFalse(register["sql_bodies_embedded"])
        for item in register["cases"]:
            self.assertFalse(item["replay_approved"])
            self.assertFalse(item["original_sql_privately_archived"])
            self.assertFalse(item["statement_level_review_completed"])
            self.assertFalse(item["essential_ddl_separation_approved"])

    def test_quarantined_player_literal_cases_are_not_auto_replayed(self):
        root = Path(__file__).resolve().parents[3]
        register = json.loads((
            root / "supabase/recovery/historical-baseline/"
            "b3_4_data_procedural_quarantine_review_20261111.json"
        ).read_text(encoding="utf-8"))
        rows = {row["version"]: row for row in register["cases"]}
        for version in ("20260920041516", "20260920041606"):
            self.assertEqual(rows[version]["review_class"],
                             "record_specific_player_reconciliation")
            self.assertEqual(rows[version]["dispose_data_operations_for_scratch_only"],
                             "PENDING_OWNER_REVIEW")
            self.assertFalse(rows[version]["replay_approved"])

    def synthetic_completed_b27_archive(self):
        self.output.mkdir()
        for name in ("manifest.json", "archive-attestation.json",
                     "content-parity.json", "sql-statement-risk-review.json"):
            (self.output / name).write_text("{}", encoding="utf-8")

    def test_finalize_existing_preserves_private_archive_without_csv_or_reimport(self):
        self.synthetic_completed_b27_archive()
        source = self.output / "quarantine_sql"
        source.mkdir()
        untouched = source / "synthetic-source.statements.json"
        untouched.write_text('["SELECT 1;"]', encoding="utf-8")
        with patch("b3_4_import_dashboard_csv.analyze", return_value={
            "all_168_element_hashes_verified_from_private_archive": True,
            "private_archive_source_matched_to_live_fingerprints": True,
            "ready_for_full_supabase_replay": False,
        }) as inspect:
            report = finalize_existing_private_archive(self.root, self.output)
        inspect.assert_called_once()
        self.assertEqual(untouched.read_text(), '["SELECT 1;"]')
        self.assertTrue((self.output / "b3-4-dashboard-attestation.json").is_file())
        self.assertEqual(report["original_statement_elements"], 168)
        self.assertFalse(report["historical_sql_replay_approved"])
        self.assertFalse(report["ready_for_disposable_replay"])

    def test_finalize_rejects_failed_reverification_without_writing_attestation(self):
        self.synthetic_completed_b27_archive()
        with patch("b3_4_import_dashboard_csv.analyze", return_value={
            "all_168_element_hashes_verified_from_private_archive": False,
            "private_archive_source_matched_to_live_fingerprints": False,
            "ready_for_full_supabase_replay": False,
        }):
            with self.assertRaisesRegex(ValueError, "attestation not complete"):
                finalize_existing_private_archive(self.root, self.output)
        self.assertFalse((self.output / "b3-4-dashboard-attestation.json").exists())

    def test_finalize_refuses_existing_attestation_and_unprotected_archive(self):
        self.synthetic_completed_b27_archive()
        (self.output / "b3-4-dashboard-attestation.json").write_text("{}")
        with self.assertRaisesRegex(ValueError, "refusing overwrite"):
            finalize_existing_private_archive(self.root, self.output)
        with self.assertRaisesRegex(ValueError, "ignored .recovery-private"):
            finalize_existing_private_archive(self.root, self.root)

    def test_no_hosted_sql_commands(self):
        code = (Path(__file__).parent / "b3_4_import_dashboard_csv.py").read_text()
        for forbidden in ("supabase db reset", "apply_migration(", "execute_sql("):
            self.assertNotIn(forbidden, code)


if __name__ == "__main__":
    unittest.main()
