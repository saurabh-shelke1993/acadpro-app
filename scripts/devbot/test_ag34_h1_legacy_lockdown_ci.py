"""AG34-H1 pure security contract tests. Never connects to Supabase."""
import sys
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ag34_h1_legacy_lockdown_ci as h
import ag3_4b_live_mapping_ci as b


class LegacyMappingLockdownSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = h.PROPOSAL.read_text(encoding="utf-8")
        cls.runner = Path(h.__file__).read_text(encoding="utf-8")
        cls.old_runner = Path(b.__file__).read_text(encoding="utf-8")
        cls.workflow = (h.ROOT / ".github/workflows/security-ag34-h1-legacy-coach-lockdown.yml").read_text()

    def test_noncanonical_proposal_and_no_live_side_effects(self):
        self.assertNotIn("supabase/migrations/", str(h.PROPOSAL))
        self.assertIn("NOT A CANONICAL MIGRATION", self.sql)
        for forbidden in ("DROP TABLE", "DELETE FROM public.coach_batches",
                          "CREATE OR REPLACE FUNCTION", "supabase db push",
                          "ALTER TABLE public.coach_batch_assignments"):
            self.assertNotIn(forbidden, self.sql)

    def test_fail_closed_zero_rows_and_exact_four_live_policy_hashes(self):
        self.assertIn("(SELECT count(*) FROM public.coach_batches)<>0", self.sql)
        self.assertIn("tablename='coach_batches')<>4", self.sql)
        for digest in ("cd4193d15352dcfb25a4b3835e8850a4",
                       "957ab744836d9772e4258c85504827c0",
                       "7a3ff298bc791c74727729a21549b844",
                       "f82e68e0224f4417a0e0e7a0897be20e"):
            self.assertIn(digest, self.sql)

    def test_revoke_all_clients_and_restrictive_policy(self):
        for wanted in ("REVOKE ALL PRIVILEGES ON TABLE public.coach_batches",
                       "FROM PUBLIC, anon, authenticated",
                       "CREATE POLICY coach_batches_legacy_closed",
                       "AS RESTRICTIVE", "FOR ALL TO authenticated",
                       "USING (false) WITH CHECK (false)",
                       "NOTIFY pgrst, 'reload schema'",
                       "AG34-H1 LEGACY COACH MAPPING CLIENT LOCKDOWN VERIFIED"):
            self.assertIn(wanted, self.sql)
        self.assertIn("tablename='coach_batches')<>5", self.sql)
        self.assertIn("has_table_privilege('authenticated','public.coach_batches','DELETE')", self.sql)

    def test_no_role_exemptions_to_legacy_client_access(self):
        for forbidden in ("GRANT SELECT", "GRANT INSERT", "GRANT UPDATE",
                          "GRANT DELETE", "TO service_role",
                          "private.is_academy_owner()", "private.is_super_admin()"):
            self.assertNotIn(forbidden, self.sql)

    def test_original_ag34b_candidate_test_remains_default(self):
        self.assertIn("def main(on_live_snapshot=None)", self.old_runner)
        self.assertIn("if on_live_snapshot is not None:", self.old_runner)
        self.assertIn('checkpoint="install proposed fix inside scratch only"', self.old_runner)
        self.assertIn("sys.exit(b.main(on_live_snapshot=lock_under_real_jwts))",
                      self.runner)

    def test_scratch_guard_and_genuine_jwt_role_matrix(self):
        self.assertIn('b.db_counts() != "9|8|3|4|11"', self.runner)
        self.assertIn("set(ids.splitlines()) != EXPECTED_IDS", self.runner)
        self.assertEqual(len(h.ROLE_NAMES), 8)
        for role in ("parent_a1", "parent_a2", "coach_a", "coach_b", "owner_a",
                     "owner_b", "super_admin"):
            self.assertIn(role, h.ROLE_NAMES)
        for wanted in ("on_live_snapshot", "b.rest(key, token", "method=method",
                       "assert_no_client_privileges()"):
            self.assertIn(wanted, self.runner)

    def test_denied_get_cannot_consider_empty_success_a_pass(self):
        with mock.patch.object(b, "rest", return_value=(200, [])):
            with self.assertRaises(b.SecurityMismatch):
                h.must_get_denied("key", "jwt")
        with mock.patch.object(b, "rest", return_value=(403, None)):
            h.must_get_denied("key", "jwt")

    def test_denied_mutation_cannot_consider_empty_success_a_pass(self):
        with mock.patch.object(b, "rest", return_value=(200, [])):
            with self.assertRaises(b.SecurityMismatch):
                h.must_write_denied("key", "jwt", "DELETE")
        with mock.patch.object(b, "rest", return_value=(403, None)):
            h.must_write_denied("key", "jwt", "POST")

    def test_sql_access_postflight_fails_closed(self):
        with mock.patch.object(b, "sql", return_value="t|f|f|f|f|f|1|0|3"):
            with self.assertRaises(b.SecurityMismatch):
                h.assert_no_client_privileges()
        with mock.patch.object(b, "sql", return_value="f|f|f|f|f|f|1|0|3"):
            h.assert_no_client_privileges()

    def test_defense_in_depth_regrant_and_existing_scope_regression(self):
        self.assertIn("GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_batches", self.runner)
        self.assertIn("REVOKE ALL PRIVILEGES ON public.coach_batches", self.runner)
        self.assertIn("Restrictive", self.runner.replace("restrictive", "Restrictive"))
        self.assertIn("ag32.read_scoped", self.runner)
        self.assertIn("public.coach_batch_assignments", self.runner)

    def test_native_workflow_requires_unlinked_runner(self):
        for wanted in ("supabase init --yes", "project-ref", "supabase stop --no-backup",
                       "SUPABASE_DB_URL", "SUPABASE_ACCESS_TOKEN",
                       "test_ag34_h1_legacy_lockdown_ci.py",
                       "ag34_h1_legacy_lockdown_ci.py"):
            self.assertIn(wanted, self.workflow)
        self.assertNotIn("supabase db push", self.workflow)
        self.assertNotIn("supabase link ", self.workflow)


if __name__ == "__main__":
    unittest.main()
