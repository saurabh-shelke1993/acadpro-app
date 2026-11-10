import json
from pathlib import Path
import tempfile
import unittest

from attest_private_archive import git_blob_sha1
from run_verified_private_archive import build_private_archive, validate_remote_before_export


class OneCommandPrivateRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.output = self.root / ".recovery-private" / "baseline-1"
        self.migrations = self.root / "migrations"
        self.migrations.mkdir()
        self.records = [
            {"version": "20260823093317", "name": "remote_schema",
             "statements": ["CREATE SCHEMA private;"]},
            {"version": "20260912142706", "name": "link_parents_to_auth_users",
             "statements": ["UPDATE public.parents SET user_id = NULL WHERE id IS NULL;"]},
        ]
        self.inventory = self.root / "expected.json"
        self.write_inventory()
        (self.migrations / "20260823093317_remote_schema.sql").write_text(
            "CREATE SCHEMA private;", encoding="utf-8")
        (self.migrations / "20260912142706_link_parents_to_auth_users.sql").write_text(
            "UPDATE public.parents SET user_id = NULL WHERE id IS NULL;", encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def write_inventory(self):
        self.expected = {
            "schema": "kheltriva-b2-4-content-fingerprint-v2",
            "summary": {"remote_total": len(self.records)},
            "git_head_at_comparison": "synthetic-only",
            "project_id": "synthetic-only",
            "remote_rows": [],
        }
        for row in self.records:
            source = "".join(row["statements"]).encode("utf-8")
            self.expected["remote_rows"].append({
                "remote_version": row["version"],
                "remote_name": row["name"],
                "remote_statement_count": len(row["statements"]),
                "remote_sql_bytes": len(source),
                "remote_git_blob_sha1": git_blob_sha1(source),
            })
        self.inventory.write_text(json.dumps(self.expected), encoding="utf-8")

    def test_full_private_archive_workflow_creates_all_audit_outputs(self):
        report = build_private_archive(self.records, self.migrations, self.output,
                                       self.inventory)
        self.assertTrue(report["historical_sql_archived"])
        self.assertTrue(report["source_hash_verified"])
        self.assertFalse(report["ready_for_disposable_replay"])
        self.assertEqual(report["remote_migrations"], 2)
        self.assertEqual(report["direct_top_level_dml"], 1)
        self.assertEqual(len(list((self.output / "quarantine_sql").glob("*.json"))), 2)
        for name in ("manifest.json", "archive-attestation.json",
                     "content-parity.json", "sql-statement-risk-review.json"):
            self.assertTrue((self.output / name).is_file())
        attestation = json.loads((self.output / "archive-attestation.json").read_text())
        self.assertFalse(attestation["sql_bodies_embedded"])

    def test_stale_remote_source_refuses_before_writing(self):
        self.records[1]["statements"][0] = "DELETE FROM public.parents;"
        with self.assertRaisesRegex(ValueError, "fingerprint"):
            build_private_archive(self.records, self.migrations, self.output,
                                  self.inventory)
        self.assertFalse(self.output.exists())

    def test_incomplete_source_refuses_before_writing(self):
        with self.assertRaisesRegex(ValueError, "migration count"):
            build_private_archive(self.records[:1], self.migrations, self.output,
                                  self.inventory)
        self.assertFalse(self.output.exists())

    def test_unprotected_output_path_refused(self):
        with self.assertRaisesRegex(ValueError, ".recovery-private"):
            build_private_archive(self.records, self.migrations,
                                  self.root / "dangerously-tracked", self.inventory)

    def test_existing_archive_cannot_be_overwritten(self):
        self.output.mkdir(parents=True)
        with self.assertRaisesRegex(ValueError, "already exists"):
            build_private_archive(self.records, self.migrations, self.output,
                                  self.inventory)

    def test_modified_version_rejected(self):
        self.records[1]["version"] = "20260913000000"
        with self.assertRaisesRegex(ValueError, "fingerprint"):
            validate_remote_before_export(self.records, self.expected)


if __name__ == "__main__":
    unittest.main()
