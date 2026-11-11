"""AG34-H4: static fail-closed contract for the Windows read-only rollout preparer."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/"scripts/devbot/ag34_h4_prepare_hosted_release.ps1"
H3_GATE=ROOT/"scripts/devbot/ag34_h3_operator_workspace_gate.py"
MIGRATION=ROOT/"supabase/migrations/20261111165330_ag34_h1_legacy_coach_batches_client_lockdown.sql"

class H4ReadOnlyPreparation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text=SOURCE.read_text(encoding="utf-8")
    def test_no_cli_schema_mutation_operation(self):
        for bad in ("'migration','up'",'"migration","up"',"'db','push'",
                    "'migration','repair'","'db','reset'",
                    "'migration','down'","Invoke-Sqlcmd","mcp__Supabase__apply_migration"):
            self.assertNotIn(bad,self.text)
    def test_pins_target_and_release_version(self):
        self.assertIn("'ulyealhkmlorsbdiknrh'",self.text)
        self.assertIn("'20261111165330'",self.text)
        self.assertIn("payment-module-finalization",self.text)
        self.assertIn("Supabase CLI 3.0.0 required",self.text)
    def test_backup_runs_before_history_fetch(self):
        schema=self.text.index("'export private logical schema backup'")
        data=self.text.index("'export private logical data backup'")
        fetch=self.text.index("'fetch 82 applied migrations")
        self.assertLess(schema,data)
        self.assertLess(data,fetch)
        self.assertIn("'public,auth,storage,supabase_migrations'",self.text)
        self.assertIn("'--data-only'",self.text)
        self.assertIn("Get-FileHash -Algorithm SHA256",self.text)
    def test_unlinked_temp_workspace_outside_git(self):
        self.assertIn("$env:LOCALAPPDATA",self.text)
        self.assertIn("NewGuid()",self.text)
        self.assertIn("'unlinked-cli'",self.text)
        self.assertIn("'init','--yes'",self.text)
        self.assertIn("'migration','fetch'",self.text)
        self.assertNotIn("'link'",self.text)
        self.assertIn("local Git working tree must be clean",self.text)
    def test_strict_fetched_and_staged_history_checks(self):
        self.assertIn("ag34_h3_operator_workspace_gate.py",self.text)
        self.assertIn("--phase fetched",self.text)
        self.assertIn("--phase staged",self.text)
        self.assertIn("'migration','list'",self.text)
        self.assertIn("exactly-one pending migration check failed",self.text)
        self.assertTrue(H3_GATE.is_file() and MIGRATION.is_file())
    def test_ends_with_stop_no_automatic_deploy(self):
        self.assertIn("NO HOSTED DDL EXECUTED",self.text)
        self.assertIn("Do not retry or apply migration",self.text)
        self.assertIn("Never share backup contents",self.text)
        self.assertIn("Do not",self.text)
    def test_cli_arguments_are_explicit_array(self):
        self.assertIn("param([string]$Label,[string[]]$CliArgs)",self.text)
        self.assertIn("& supabase @CliArgs",self.text)
        self.assertIn("Invoke-Checked -Label",self.text)

if __name__=="__main__":
    unittest.main()
