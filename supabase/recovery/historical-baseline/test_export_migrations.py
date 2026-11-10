import json
from pathlib import Path
import tempfile
import unittest
from export_migrations import export, verify


class RecoveryExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.migrations = self.root / "migrations"
        self.migrations.mkdir()
        (self.migrations / "20260926133000_a.sql").write_text("SELECT 1;")
        (self.migrations / "20260926133000_b.sql").write_text("SELECT 2;")
        self.output = self.root / "output"

    def tearDown(self):
        self.tmp.cleanup()

    def test_lossless_statements_and_collision(self):
        sample = [{"version": "20260908075043", "name": "security", "statements": ["SELECT 1;", " SELECT 2;\\n"]}]
        manifest = export(sample, self.migrations, self.output)
        self.assertEqual(verify(self.output)["remote_only_count"], 1)
        self.assertEqual(manifest["local_version_collisions"]["20260926133000"], ["20260926133000_a.sql", "20260926133000_b.sql"])
        self.assertEqual(json.loads((self.output / manifest["items"][0]["relative_path"]).read_text()), sample[0]["statements"])
        self.assertFalse(manifest["items"][0]["replay_approved"])

    def test_modified_file_fails_verification(self):
        manifest = export([{"version": "20260908075043", "name": "security", "statements": ["SELECT 1;"]}], self.migrations, self.output)
        path = self.output / manifest["items"][0]["relative_path"]
        path.write_text('["SELECT 3;"]')
        with self.assertRaises(ValueError):
            verify(self.output)

    def test_nonempty_output_refused(self):
        self.output.mkdir()
        (self.output / "existing.txt").write_text("keep")
        with self.assertRaises(RuntimeError):
            export([], self.migrations, self.output)
        self.assertEqual((self.output / "existing.txt").read_text(), "keep")

    def test_manifest_path_traversal_is_rejected(self):
        manifest = export([{"version": "20260908075043", "name": "security",
                            "statements": ["SELECT 1;"]}], self.migrations, self.output)
        manifest["items"][0]["relative_path"] = "../outside.json"
        (self.output / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaises((ValueError, FileNotFoundError)):
            verify(self.output)

    def test_archive_duplicate_version_is_rejected(self):
        manifest = export([{"version": "20260908075043", "name": "security",
                            "statements": ["SELECT 1;"]}], self.migrations, self.output)
        manifest["items"].append(manifest["items"][0].copy())
        (self.output / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Duplicate migration"):
            verify(self.output)

    def test_duplicate_remote_version_refused(self):
        record = {"version": "20260908075043", "name": "security", "statements": ["SELECT 1;"]}
        with self.assertRaises(ValueError):
            export([record, record], self.migrations, self.output)


if __name__ == "__main__":
    unittest.main()
