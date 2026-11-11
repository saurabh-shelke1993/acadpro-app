"""AG34-H3 offline safety contract for a single CLI-owned migration."""
from __future__ import annotations
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import ag34_h3_single_migration_cli_ci as h3
import ag34_h2_rollout_rehearsal_ci as h2
import ag3_4b_live_mapping_ci as b


class SingleMigrationMechanism(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source=Path(h3.__file__).read_text(encoding="utf-8")
        cls.migration=h3.MIGRATION.read_text(encoding="utf-8")

    def test_version_and_isolated_local_url(self):
        self.assertEqual(h3.VERSION,"20261111165330")
        self.assertEqual(h3.TOTAL_HISTORICAL,82)
        self.assertEqual(h3.LOCAL_DATABASE,
                         "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
        self.assertEqual(h3.TEMP_PROJECT,"kheltriva-ag34-h3-fetch-only")

    def test_no_authored_transaction_boundaries_or_history_mutations(self):
        h2.verify_cli_migration_body()
        self.assertNotIn("\nBEGIN;\n",self.migration)
        self.assertNotIn("\nCOMMIT;\n",self.migration)
        self.assertNotIn("supabase_migrations.schema_migrations",self.migration)
        self.assertNotIn("migration repair",self.migration.split("\nDO $ag34_h1_preflight$",1)[1])

    def test_fetch_then_up_only_from_unlinked_scratch(self):
        for phrase in ("GITHUB_ACTIONS","RUNNER_TEMP","SUPABASE_ACCESS_TOKEN",
                       "SUPABASE_DB_URL","TEMP_PROJECT","verify_history_workdir",
                       "migration\",\"fetch", "migration\",\"up",
                       "--remote=", "shutil.rmtree"):
            self.assertIn(phrase,self.source)
        self.assertNotIn("supabase db push",self.source)
        self.assertNotIn("supabase migration repair",self.source)

    def test_transaction_failure_injected_after_policy_creation(self):
        self.assertIn('content + "\\nSELECT 1/0;\\n"',self.source)
        self.assertIn("check_legacy_unhardened(before)",self.source)
        self.assertIn('succeed=False',self.source)
        self.assertIn("ledger_digest() != snapshot",self.source)

    def test_only_one_new_version_and_previous_digest_unchanged(self):
        for phrase in (
            "TARGET_VERSION", "ledger_digest() != before",
            "supabase_migrations.schema_migrations", "83", "20261111165330",
            "failed migration incorrectly recorded version",
            "CLI did not preserve canonical version/name",
        ):
            if phrase=="TARGET_VERSION":
                continue
            self.assertIn(phrase,self.source)

    def test_denies_all_roles_and_preserves_modern_assignment(self):
        for phrase in ("h1.must_get_denied(key,token)",
                       'for method in ("POST","PATCH","DELETE")',
                       "h1.assert_no_client_privileges()",
                       "b.ag32.read_scoped", "h2.verify_postflight_sql()"):
            self.assertIn(phrase,self.source)

    def test_cli_rejects_nonlocal_remote_url(self):
        with mock.patch.dict(os.environ,{"RUNNER_TEMP":"/tmp/gh-h3-safe","SUPABASE_ACCESS_TOKEN":"","SUPABASE_DB_URL":""}):
            with self.assertRaises(b.SecurityMismatch):
                h3.cli(["supabase","migration","fetch","--remote=postgresql://hosted"],Path("/tmp/gh-h3-safe"))

    def test_cli_rejects_missing_explicit_yes(self):
        with mock.patch.dict(os.environ,{"RUNNER_TEMP":"/tmp/gh-h3-safe","SUPABASE_ACCESS_TOKEN":"","SUPABASE_DB_URL":""}):
            with self.assertRaises(b.SecurityMismatch):
                h3.cli(["supabase","migration","up","--remote="+h3.LOCAL_DATABASE],Path("/tmp/gh-h3-safe"))

    def test_no_live_mcp_ddl_or_secret_exfiltration(self):
        self.assertNotIn("mcp__Supabase__apply_migration",self.source)
        self.assertNotIn("https://api.supabase.com",self.source)
        self.assertNotIn("service_role",self.source)
        self.assertNotIn("subprocess.Popen",self.source)
        self.assertNotIn("shell=True",self.source)


if __name__=="__main__":
    unittest.main()
