"""AG3.3 pure safety tests. No Docker, database writes, or network."""
from __future__ import annotations

import os
from pathlib import Path
import sys
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ag3_3_parent_sa_jwt_rls_ci as ag33
import ag3_real_jwt_rls_ci as ag3


class Ag33Safety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.src = Path(ag33.__file__).read_text(encoding="utf-8")
        cls.sql = (HERE.parents[1] / "supabase/tests/subscriptions" /
                   ag33.POLICY_FILE).read_text(encoding="utf-8")

    def test_local_native_ci_only(self):
        self.assertEqual(ag33.PROJECT, "kheltriva-ag33-ci")
        self.assertEqual(ag33.CONTAINER, "supabase_db_kheltriva-ag33-ci")
        for term in ("GITHUB_ACTIONS", "GITHUB_REPOSITORY",
                     "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_URL",
                     "project-ref", "migrations"):
            self.assertIn(term, self.src)

    def test_pinned_nonhistorical_schema_safeguards(self):
        for term in ("current_database()<>'postgres'",
                     "current_user<>'postgres'",
                     "session_user<>'postgres'",
                     "to_regclass('public.parents') IS NOT NULL",
                     "to_regclass('public.players') IS NOT NULL",
                     "to_regclass('public.payment_dues') IS NOT NULL",
                     "to_regclass('public.subscription_periods') IS NOT NULL"):
            self.assertIn(term, self.sql)
        for forbidden in ("DROP TABLE", "DELETE FROM auth.users",
                          "CREATE OR REPLACE FUNCTION", "GRANT ALL",
                          "GRANT SELECT TO anon", "supabase db push",
                          "supabase link", "auth.jwt()"):
            self.assertNotIn(forbidden, self.sql)

    def test_expected_live_fk_relationships_in_scratch(self):
        for term in ("user_id uuid NOT NULL UNIQUE REFERENCES public.users(id)",
                     "parent_id uuid NOT NULL REFERENCES public.parents(id)",
                     "batch_id uuid NOT NULL REFERENCES public.batches(id)",
                     "ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY",
                     "ALTER TABLE public.players ENABLE ROW LEVEL SECURITY"):
            self.assertIn(term, self.sql)

    def test_parent_read_requires_actual_auth_link_and_role(self):
        for term in ("private.current_user_role())='parent'",
                     "pr.user_id=(SELECT auth.uid())",
                     "pr.id=players.parent_id",
                     "p.batch_id=batches.id",
                     "ag33_synthetic_parent_batch_read",
                     "ag33_synthetic_linked_player_read",
                     "ag33_synthetic_parent_record_read"):
            self.assertIn(term, self.sql)

    def test_super_admin_read_and_write_always_check_role(self):
        for term in ("ag33_synthetic_super_admin_batch_read",
                     "ag33_synthetic_super_admin_batch_insert",
                     "ag33_synthetic_super_admin_batch_update",
                     "ag33_synthetic_super_admin_batch_delete",
                     "WITH CHECK ((SELECT private.is_super_admin()))",
                     "USING ((SELECT private.is_super_admin()))"):
            self.assertIn(term, self.sql)
        self.assertIn("GRANT INSERT,UPDATE,DELETE ON TABLE public.batches TO authenticated", self.sql)
        self.assertNotIn("GRANT INSERT,UPDATE,DELETE ON TABLE public.players", self.sql)

    def test_keeps_previous_ag3_policies_and_helpers(self):
        self.assertIn("ag3_synthetic_owner_batch_read", self.sql)
        self.assertIn("ag32_synthetic_coach_batch_read", self.sql)
        self.assertIn("helper_count<>11", self.sql)
        self.assertIn("NOTIFY pgrst, 'reload schema'", self.sql)

    def test_four_genuine_new_auth_sessions(self):
        for label in ("ag33-parent-a1", "ag33-parent-a2", "ag33-parent-b",
                      "ag33-super-admin"):
            self.assertIn('ag3.signup_with_token(key, "' + label + '")', self.src)
        for name in ("parent_a1_uuid", "parent_a2_uuid",
                     "parent_b_uuid", "super_admin_uuid"):
            self.assertIn(name + "=", self.src)

    def test_same_academy_and_foreign_negative_checks(self):
        for label in ("PARENT_A1_ID", "PARENT_A2_ID", "PARENT_B_ID",
                      "PLAYER_A1", "PLAYER_A2", "PLAYER_B",
                      "ag32.BATCH_INACTIVE_A"):
            self.assertIn(label, self.src)
        self.assertIn("if player != own_player", self.src)
        self.assertIn("if parent != own_parent", self.src)
        self.assertIn("if batch != own_batch", self.src)

    def test_read_validation_fail_closed(self):
        row = {"id": ag33.PLAYER_A1, "parent_id": ag33.PARENT_A1_ID,
               "batch_id": ag3.BATCH_A, "academy_id": ag3.ACADEMY_A}
        with mock.patch.object(ag33, "request_table", return_value=(200, [row, row])):
            with self.assertRaises(ag33.Ag33Failure):
                ag33.expect_rows("key", "token", "players", [row])
        with mock.patch.object(ag33, "request_table", return_value=(
                200, [dict(row, unexpected="secret")])):
            with self.assertRaises(ag33.Ag33Failure):
                ag33.expect_rows("key", "token", "players", [row])
        with mock.patch.object(ag33, "request_table", return_value=(200, [row])):
            ag33.expect_rows("key", "token", "players", [row])

    def test_non_sa_mutation_denial_fail_closed(self):
        for method in ("POST", "PATCH", "DELETE"):
            with mock.patch.object(ag33, "request_table", return_value=(200, [
                    {"id": ag33.NEW_BATCH, "academy_id": ag3.ACADEMY_A}])):
                with self.assertRaises(ag33.Ag33Failure):
                    ag33.deny_mutation("key", "token", method,
                                       payload={} if method != "DELETE" else None)
        with mock.patch.object(ag33, "request_table", return_value=(200, [])):
            ag33.deny_mutation("key", "token", "PATCH", payload={})
        with mock.patch.object(ag33, "request_table", return_value=(403, None)):
            ag33.deny_mutation("key", "token", "POST", payload={})

    def test_reject_arbitrary_table_or_method(self):
        with self.assertRaises(ValueError):
            ag33.request_table("key", "token", "payments")
        with self.assertRaises(ValueError):
            ag33.request_table("key", "token", "players", method="TRUNCATE")
        with self.assertRaises(ValueError):
            ag33.request_table("key", "token", "batches", method="POST")

    def test_anon_and_invalid_jwt_denial_check_is_strict(self):
        with mock.patch.object(ag33, "request_table", return_value=(200, [])):
            with self.assertRaises(ag33.Ag33Failure):
                ag33.expect_denial("key", None, "players")
        with mock.patch.object(ag33, "request_table", return_value=(403, None)):
            ag33.expect_denial("key", "invalid", "players")

    def test_only_docker_exec_without_shell(self):
        result = mock.Mock(returncode=0, stdout="MARKER")
        with mock.patch.object(ag33.subprocess, "run", return_value=result) as run:
            ag33.psql("-At", "-c", "SELECT 1")
        self.assertEqual(run.call_args.args[0][:6],
                         ["docker", "exec", ag33.CONTAINER, "psql", "-U", "postgres"])
        self.assertFalse(run.call_args.kwargs.get("shell", False))

    def test_summary_honestly_limits_scope(self):
        with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": ""}):
            with mock.patch("builtins.print") as write:
                ag33.report([("test", "PASS")], True)
        report = write.call_args.args[0]
        self.assertIn("Not genuine hosted policy-text parity", report)
        self.assertIn("No full Parent Portal", report)
        self.assertIn("no hosted supabase", report.lower())


if __name__ == "__main__":
    unittest.main()
