import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from attest_private_archive import attest, git_blob_sha1
from export_migrations import export


VERSIONS = ["20260908062059", "20260912142706"]


class ArchiveAttestationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.migrations = self.root / "migrations"
        self.migrations.mkdir()
        self.archive = self.root / "archive"
        self.sources = [
            {"version": VERSIONS[0], "name": "parent_read_isolation",
             "statements": ["create schema private;", "select 1;"]},
            {"version": VERSIONS[1], "name": "link_parents_to_auth_users",
             "statements": ["alter table public.parents add column user_id uuid;"]},
        ]
        export(self.sources, self.migrations, self.archive)
        self.fingerprint = self.root / "fingerprints.json"
        self.write_reference()

    def tearDown(self):
        self.temp.cleanup()

    def write_reference(self):
        ref = {
            "schema": "kheltriva-b2-4-content-fingerprint-v2",
            "summary": {"remote_total": len(self.sources)},
            "project_id": "example-only",
            "git_head_at_comparison": "0123456",
            "remote_rows": [],
        }
        for item in self.sources:
            sql = "".join(item["statements"]).encode("utf-8")
            ref["remote_rows"].append({
                "remote_version": item["version"],
                "remote_name": item["name"],
                "remote_statement_count": len(item["statements"]),
                "remote_sql_bytes": len(sql),
                "remote_git_blob_sha1": git_blob_sha1(sql),
            })
        self.fingerprint.write_text(json.dumps(ref), encoding="utf-8")

    def test_verified_archive_does_not_approve_replay(self):
        result = attest(self.archive, self.fingerprint)
        self.assertEqual(result["remote_migration_count"], 2)
        self.assertEqual(result["stored_statement_count"], 3)
        self.assertTrue(result["historical_sql_content_verified"])
        self.assertFalse(result["ready_for_disposable_replay"])
        self.assertFalse(result["ready_for_production"])
        self.assertFalse(result["sql_bodies_embedded"])
        self.assertTrue(all(not item["replay_approved"] for item in result["records"]))

    def test_changed_sql_and_updated_manifest_hash_still_refused(self):
        record_file = next((self.archive / "quarantine_sql").glob("*.json"))
        record_file.write_text('["select 2;"]', encoding="utf-8")
        manifest_path = self.archive / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        first = next(i for i in manifest["items"]
                     if i["relative_path"] == str(record_file.relative_to(self.archive)))
        first["sha256"] = hashlib.sha256(record_file.read_bytes()).hexdigest()
        first["statement_count"] = 1
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "fingerprint mismatch"):
            attest(self.archive, self.fingerprint)

    def test_missing_migration_rejected(self):
        manifest_path = self.archive / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["items"].pop()
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "incomplete"):
            attest(self.archive, self.fingerprint)

    def test_wrong_historical_order_rejected(self):
        manifest_path = self.archive / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["items"].reverse()
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "versions/order"):
            attest(self.archive, self.fingerprint)

    def test_wrong_source_name_rejected(self):
        ref = json.loads(self.fingerprint.read_text(encoding="utf-8"))
        ref["remote_rows"][0]["remote_name"] = "other"
        self.fingerprint.write_text(json.dumps(ref), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "fingerprint mismatch"):
            attest(self.archive, self.fingerprint)

    def test_wrong_database_lineage_rejected_by_hash(self):
        ref = json.loads(self.fingerprint.read_text(encoding="utf-8"))
        ref["remote_rows"][0]["remote_git_blob_sha1"] = "0" * 40
        self.fingerprint.write_text(json.dumps(ref), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "fingerprint mismatch"):
            attest(self.archive, self.fingerprint)

    def test_unsupported_inventory_schema_rejected(self):
        ref = json.loads(self.fingerprint.read_text(encoding="utf-8"))
        ref["schema"] = "unrecognized"
        self.fingerprint.write_text(json.dumps(ref), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Unexpected source"):
            attest(self.archive, self.fingerprint)


if __name__ == "__main__":
    unittest.main()
