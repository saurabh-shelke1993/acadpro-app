"""AG34-H5 synthetic fixture tests: no database data or connection used."""
from pathlib import Path
import hashlib
import tempfile
import sys
import unittest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ag34_h5_backup_inspector as h5


def samples() -> tuple[bytes, bytes, bytes]:
    schema = b"SET standard_conforming_strings = on;\n" + b"".join(
        f'CREATE TABLE IF NOT EXISTS "{ns}"."{name}" (id uuid);\n'.encode()
        for ns, name in h5.REQUIRED_TABLES
    )
    data = b"SET session_replication_role = replica;\n" + b"".join(
        f'INSERT INTO "{ns}"."{name}" ("id") VALUES (\'00000000-0000-4000-8000-000000000001\');\n'.encode()
        for ns, name in h5.REQUIRED_TABLES
    )
    roles = b'CREATE ROLE "test_h5_non_sens";\nGRANT "test_h5_non_sens" TO "postgres";\n' * 3
    return schema, data, roles


class BackupVerifier(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="ag34-h5-test-")
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.schema, self.data, self.roles = samples()
        (self.folder / h5.SCHEMA_FILE).write_bytes(self.schema)
        (self.folder / h5.DATA_FILE).write_bytes(self.data)
        (self.folder / h5.ROLES_FILE).write_bytes(self.roles)
        self.schema_sha = hashlib.sha256(self.schema).hexdigest()
        self.data_sha = hashlib.sha256(self.data).hexdigest()

    def check(self, *, roles=True):
        return h5.inspect(self.folder, self.schema_sha, self.data_sha, require_roles=roles)

    def test_valid_input_does_not_claim_restorable(self):
        r = self.check()
        self.assertTrue(r["schema_sha256_match"])
        self.assertEqual(r["critical_table_schemas_detected"], 6)
        self.assertEqual(r["critical_nonempty_table_data_detected"], 6)
        self.assertEqual(r["restorability"], "NOT_TESTED")
        self.assertEqual(r["point_in_time_consistency"], "NOT_PROVEN")

    def test_missing_roles_fails(self):
        (self.folder / h5.ROLES_FILE).unlink()
        with self.assertRaises(h5.BackupGateError):
            self.check()

    def test_roles_skip_does_not_prove_roles(self):
        (self.folder / h5.ROLES_FILE).unlink()
        r = self.check(roles=False)
        self.assertFalse(r["roles_dump_present"])
        self.assertEqual(r["restorability"], "NOT_TESTED")

    def test_modified_schema_digest_fails(self):
        with self.assertRaises(h5.BackupGateError):
            h5.inspect(self.folder, "0"*64, self.data_sha)

    def test_modified_data_digest_fails(self):
        with self.assertRaises(h5.BackupGateError):
            h5.inspect(self.folder, self.schema_sha, "f"*64)

    def test_hash_must_be_exact_format(self):
        with self.assertRaises(h5.BackupGateError):
            h5.inspect(self.folder, "NOTHASH", self.data_sha)

    def test_missing_critical_schema_table_fails_even_with_matching_hash(self):
        new = self.schema.replace(b'CREATE TABLE IF NOT EXISTS "auth"."users"', b'SELECT 1')
        (self.folder / h5.SCHEMA_FILE).write_bytes(new)
        with self.assertRaises(h5.BackupGateError):
            h5.inspect(self.folder, hashlib.sha256(new).hexdigest(), self.data_sha)

    def test_missing_critical_data_table_fails_even_with_matching_hash(self):
        new = self.data.replace(b'INSERT INTO "storage"."objects"', b'SELECT 1')
        (self.folder / h5.DATA_FILE).write_bytes(new)
        with self.assertRaises(h5.BackupGateError):
            h5.inspect(self.folder, self.schema_sha, hashlib.sha256(new).hexdigest())

    def test_binary_sql_fails(self):
        new = self.schema + b"\x00"
        (self.folder / h5.SCHEMA_FILE).write_bytes(new)
        with self.assertRaises(h5.BackupGateError):
            h5.inspect(self.folder, hashlib.sha256(new).hexdigest(), self.data_sha)

    def test_empty_backup_fails(self):
        (self.folder / h5.DATA_FILE).write_bytes(b"")
        with self.assertRaises(h5.BackupGateError):
            self.check()

    def test_sql_patterns_match_only_table_in_schema(self):
        patterns=h5.coverage_patterns(rb"\bINSERT\s+INTO\s+")
        import re
        for key,rx in patterns.items():
            pattern=re.compile(rx,re.IGNORECASE)
            self.assertTrue(pattern.search(self.data),key)

    def test_backup_directory_cannot_be_git_checkout(self):
        (self.folder / ".git").mkdir()
        with self.assertRaises(h5.BackupGateError):
            self.check()


class PowerShellBoundary(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.src=(HERE/"ag34_h5_verify_local_backup.ps1").read_text(encoding="utf-8")
    def test_no_remote_writes_or_sql_restore(self):
        for forbidden in ("'migration','up'","supabase migration up","'db','push'",
                          "'migration','repair'","'db','reset'","docker run",
                          "Invoke-Sqlcmd","mcp__Supabase__apply_migration"):
            self.assertNotIn(forbidden,self.src)
    def test_roles_dump_is_only_remote_operation(self):
        self.assertIn("db dump ('--remote=' + $referenceProject) --role-only --file",self.src)
        self.assertIn("3.0.0",self.src)
        self.assertIn("no hosted",self.src.lower())
        self.assertIn("critical table",self.src)


if __name__ == "__main__":
    unittest.main()
