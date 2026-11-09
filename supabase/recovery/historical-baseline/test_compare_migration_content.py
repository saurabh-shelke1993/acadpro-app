import tempfile
from pathlib import Path
import unittest

from export_migrations import export
from compare_migration_content import compare


class MigrationContentParityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.local = self.root / "migrations"
        self.local.mkdir()
        self.archive = self.root / "archive"

    def tearDown(self):
        self.tmp.cleanup()

    def write_migration(self, version, suffix, content):
        (self.local / (version + "_" + suffix + ".sql")).write_bytes(content)

    def archive_rows(self, rows):
        export([{"version": v, "name": n, "statements": a} for v, n, a in rows],
               self.local, self.archive)

    def test_exact_content_same_version(self):
        self.write_migration("20260823093317", "remote_schema", b"select 1;")
        self.archive_rows([("20260823093317", "remote_schema", ["select 1;"])])
        report = compare(self.archive, self.local)
        self.assertEqual(report["counts"]["exact-bytes"], 1)
        self.assertEqual(report["timestamp_drift_links"], 0)
        self.assertFalse(report["remote_migrations"][0]["replay_approved"])

    def test_retimestampped_exact_content(self):
        self.write_migration("20260920051000", "candidate", b"select 2;")
        self.archive_rows([("20260920045507", "historical", ["select 2;"])])
        report = compare(self.archive, self.local)
        self.assertEqual(report["timestamp_drift_links"], 1)
        self.assertEqual(report["counts"]["exact-bytes"], 1)

    def test_trailing_newline_not_confused_with_exact(self):
        self.write_migration("20260926081010", "test", b"select 3;\n")
        self.archive_rows([("20260926081010", "test", ["select 3;"])])
        report = compare(self.archive, self.local)
        self.assertEqual(report["counts"]["terminal-lf-only"], 1)
        self.assertEqual(report["counts"]["exact-bytes"], 0)

    def test_same_version_different_sql_is_not_verified(self):
        self.write_migration("20260926081053", "payment", b"select true;")
        self.archive_rows([("20260926081053", "payment", ["select false;"])])
        report = compare(self.archive, self.local)
        self.assertEqual(report["counts"]["same-version-content-divergence"], 1)
        self.assertFalse(report["remote_migrations"][0]["content_equivalence_claimed"])

    def test_unmapped_files_and_duplicate_local_timestamp(self):
        self.write_migration("20260926133000", "one", b"select 1;")
        self.write_migration("20260926133000", "two", b"select 2;")
        self.archive_rows([("20260926081053", "payment", ["select 3;"])])
        report = compare(self.archive, self.local)
        self.assertEqual(report["counts"]["no-content-match"], 1)
        self.assertEqual(len(report["local_unmatched_files"]), 2)
        self.assertEqual(len(report["local_timestamp_collisions"]["20260926133000"]), 2)

    def test_tampered_evidence_is_rejected(self):
        self.write_migration("20260926081053", "payment", b"select 1;")
        self.archive_rows([("20260926081053", "payment", ["select 1;"])])
        sql_file = next((self.archive / "quarantine_sql").glob("*"))
        sql_file.write_bytes(b'["select 2;"]')
        with self.assertRaisesRegex(ValueError, "Hash mismatch"):
            compare(self.archive, self.local)


if __name__ == "__main__":
    unittest.main()
