"""Static checks for read-only Windows local preflight. No shell or SQL execution."""
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "supabase/recovery/historical-baseline/b2_9_c2_local_preflight.ps1"

class LocalPreflightGuard(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = SCRIPT.read_text(encoding="utf-8")

    def test_read_only_boundaries(self):
        self.assertIn("READ-ONLY local Supabase environment preflight", self.source)
        self.assertIn('Get-Content -LiteralPath $planFile -Raw', self.source)
        self.assertIn("Test-Path -LiteralPath $protected", self.source)
        for forbidden in ("supabase db push", "supabase db reset", "supabase link",
                          "supabase start", "supabase db start",
                          "docker run", "docker compose up", "Invoke-Sqlcmd",
                          "psql -", "ALTER TABLE public.", "CREATE TABLE public."):
            self.assertNotIn(forbidden, self.source)

    def test_source_provenance_and_gates(self):
        for token in ("live-current-state-not-historical", "authoritative_historical_provenance",
                      "production_replay_approved", "ready_for_disposable_replay",
                      "ready_for_production", "nonhistorical_helper_count"):
            self.assertIn(token, self.source)

    def test_does_not_emit_archive_contents(self):
        self.assertIn("private_archive_folder_present", self.source)
        self.assertNotIn("Get-Content -LiteralPath $protected", self.source)
        self.assertNotIn("ReadAllText($protected)", self.source)

    def test_never_indicates_replay_approval(self):
        self.assertIn("runnable_history_approved = $false", self.source)
        self.assertIn("full_supabase_replay_completed = $false", self.source)
        self.assertIn("production_changes_authorized = $false", self.source)

if __name__ == "__main__":
    unittest.main()
