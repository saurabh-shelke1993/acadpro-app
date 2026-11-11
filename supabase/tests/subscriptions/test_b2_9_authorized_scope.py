"""B2.9 authorization boundaries and synthetic RLS source guards. No hosted connections."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = ROOT / "supabase/tests/subscriptions/ps_l2_3_b2_9_authorized_rls_assertions.sql"
SNAPSHOT = ROOT / "supabase/tests/subscriptions/ps_l2_3_b2_9_live_helper_snapshot_manifest.json"
WORKFLOW = ROOT / ".github/workflows/subscriptions-ps-l2-3-b2-9-authorized-rls.yml"

class AuthorizedScope(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = FIXTURE.read_text(encoding="utf-8")
        cls.wf = WORKFLOW.read_text(encoding="utf-8")
        cls.manifest = json.loads(SNAPSHOT.read_text(encoding="utf-8"))

    def test_authorization_is_disposable_and_nonhistorical(self):
        self.assertEqual(self.manifest["source_type"], "live-current-state-not-historical")
        self.assertFalse(self.manifest["authoritative_historical_provenance"])
        self.assertFalse(self.manifest["production_replay_approved"])
        self.assertIn("NEVER apply to hosted Supabase", self.text)

    def test_constructed_policy_enables_rls_and_cross_scope_guards(self):
        self.assertIn("ENABLE ROW LEVEL SECURITY", self.text)
        self.assertIn("FOR SELECT TO authenticated", self.text)
        for name in ("private.is_super_admin()", "private.is_academy_owner()",
                     "private.current_academy_id()", "private.is_coach()",
                     "private.is_coach_assigned_to_batch(batch_id)",
                     "private.batch_academy_id(batch_id)"):
            self.assertIn(name, self.text)
        self.assertIn("GRANT SELECT ON TABLE public.b29_synthetic_batch_roster TO authenticated", self.text)

    def test_all_five_actor_contexts_and_inactive_mapping(self):
        for suffix in ("000000000001", "000000000002", "000000000003",
                       "000000000004", "000000000005"):
            self.assertIn(suffix, self.text)
        for expected in ("Inactive Coach unexpectedly", "Parent unexpectedly",
                         "Missing synthetic identity", "Academy Owner crossed",
                         "Anonymous SQL role"):
            self.assertIn(expected, self.text)

    def test_read_only_fixture_grants(self):
        self.assertNotRegex(self.text, r"\bGRANT\s+(?:ALL|INSERT|UPDATE|DELETE|TRUNCATE)\b")
        self.assertNotRegex(self.text, r"\b(?:DROP|ALTER)\s+ROLE\b")
        self.assertNotIn("supabase_migrations.schema_migrations", self.text)

    def test_isolated_runner_and_no_remote_commands(self):
        self.assertIn("postgres:17", self.wf)
        self.assertIn("ps_l2_3_b2_9_live_helper_snapshot.sql", self.wf)
        self.assertIn("ps_l2_3_b2_9_authorized_rls_assertions.sql", self.wf)
        self.assertIn("ON_ERROR_STOP=1", self.wf)
        for blocked in ("supabase db push", "supabase link", "--linked",
                        "supabase migration up", "SUPABASE_ACCESS_TOKEN",
                        "SUPABASE_SERVICE_ROLE_KEY", "ps_l2_3_foundation.sql"):
            self.assertNotIn(blocked, self.wf)
        self.assertNotIn("ps_l2_3_local_private_baseline.sql", self.wf)

    def test_distinguishes_spoofable_test_double_from_supabase_auth(self):
        self.assertIn("spoofable synthetic GUC-based TEST DOUBLE", self.text)
        self.assertIn("DO NOT prove real Supabase Auth/JWT", self.text)

if __name__ == "__main__":
    unittest.main()
