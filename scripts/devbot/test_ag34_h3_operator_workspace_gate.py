"""AG34-H3 workspace gate contract tests; no SQL, hosted connection or CLI."""
from __future__ import annotations

import hashlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import ag34_h3_operator_workspace_gate as gate


class WorkspaceGateTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix="ag34-h3-test-")
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.folder=self.root / "supabase/migrations"
        self.folder.mkdir(parents=True)
        (self.root / "supabase/config.toml").write_text("project_id='scratch'\n")
        self.history=[
            ("20260101000000", "first"),
            ("20260101000001", "second"),
        ]
        for version,name in self.history:
            (self.folder / f"{version}_{name}.sql").write_text("SELECT 1;\n")
        manifest="|".join(f"{v}:{n}" for v,n in self.history)
        self.expected=hashlib.md5(manifest.encode()).hexdigest()

    def patched(self):
        return (
            mock.patch.object(gate,"EXPECTED_HISTORY_COUNT",2),
            mock.patch.object(gate,"EXPECTED_NAMES_MD5",self.expected),
        )

    def test_fetched_exact_history_succeeds(self):
        with self.patched()[0],self.patched()[1]:
            x=gate.inspect(self.root,"fetched")
        self.assertEqual(x["historical_versions"],2)
        self.assertEqual(x["new_migration_count"],0)

    def test_one_matching_new_migration_succeeds(self):
        (self.folder / gate.TARGET).write_bytes(gate.CANONICAL.read_bytes())
        with self.patched()[0],self.patched()[1]:
            x=gate.inspect(self.root,"staged")
        self.assertEqual(x["new_migration_count"],1)

    def test_missing_pending_file_rejected(self):
        with self.patched()[0],self.patched()[1]:
            with self.assertRaises(gate.ReleaseGateError):
                gate.inspect(self.root,"staged")

    def test_altered_pending_file_rejected(self):
        (self.folder / gate.TARGET).write_text("SELECT 1;\n")
        with self.patched()[0],self.patched()[1]:
            with self.assertRaises(gate.ReleaseGateError):
                gate.inspect(self.root,"staged")

    def test_unknown_extra_migration_rejected(self):
        (self.folder / "20260201000000_unexpected.sql").write_text("SELECT 1;")
        with self.patched()[0],self.patched()[1]:
            with self.assertRaises(gate.ReleaseGateError):
                gate.inspect(self.root,"fetched")

    def test_version_duplicate_rejected(self):
        (self.folder / "20260101000000_other.sql").write_text("SELECT 1;")
        with self.patched()[0],self.patched()[1]:
            with self.assertRaises(gate.ReleaseGateError):
                gate.inspect(self.root,"fetched")

    def test_history_digest_drift_rejected(self):
        with mock.patch.object(gate,"EXPECTED_HISTORY_COUNT",2):
            with self.assertRaises(gate.ReleaseGateError):
                gate.inspect(self.root,"fetched")

    def test_project_ref_or_git_workspace_rejected(self):
        (self.root / "supabase/.temp").mkdir()
        (self.root / "supabase/.temp/project-ref").write_text("bad")
        with self.patched()[0],self.patched()[1]:
            with self.assertRaises(gate.ReleaseGateError):
                gate.inspect(self.root,"fetched")

    def test_unusual_filename_rejected(self):
        (self.folder / "not-migration.sql").write_text("SELECT 1;")
        with self.patched()[0],self.patched()[1]:
            with self.assertRaises(gate.ReleaseGateError):
                gate.inspect(self.root,"fetched")


if __name__ == "__main__":
    unittest.main()
