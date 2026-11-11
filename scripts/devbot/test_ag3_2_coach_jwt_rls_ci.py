"""AG3.2 pure fail-closed regression guards: no Docker or Supabase network."""
from __future__ import annotations

import os
from pathlib import Path
import sys
import unittest
from unittest import mock
from urllib.error import HTTPError

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ag3_2_coach_jwt_rls_ci as ag32
import ag3_real_jwt_rls_ci as ag3


class Ag32Safety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = Path(ag32.__file__).read_text(encoding="utf-8")
        cls.sql = (HERE.parents[1] / "supabase/tests/subscriptions" /
                   ag32.POLICY_FILE).read_text(encoding="utf-8")

    def test_exact_unlinked_disposable_target(self):
        self.assertEqual(ag32.PROJECT, "kheltriva-ag32-ci")
        self.assertEqual(ag32.CONTAINER, "supabase_db_kheltriva-ag32-ci")
        for guard in ("GITHUB_ACTIONS", "GITHUB_REPOSITORY",
                      ".temp", "project-ref", "migrations"):
            self.assertIn(guard, self.source)

    def test_policy_uses_live_pinned_active_helper_and_role(self):
        self.assertIn("private.is_coach_assigned_to_batch(id)", self.sql)
        self.assertIn("(SELECT private.is_coach())", self.sql)
        self.assertIn("(SELECT private.current_academy_id())", self.sql)
        self.assertIn("FOR SELECT TO authenticated", self.sql)
        self.assertIn("ag3_synthetic_owner_batch_read", self.sql)
        self.assertIn("NOTIFY pgrst, 'reload schema'", self.sql)
        self.assertNotIn("private.can_access_batch(id)", self.sql)

    def test_policy_is_scratch_only_and_no_client_grants(self):
        for forbidden in ("DROP TABLE", "ALTER TABLE auth.users",
                          "INSERT INTO auth.users", "GRANT ALL",
                          "GRANT SELECT ON public.coach", "GRANT UPDATE",
                          "GRANT INSERT", "GRANT DELETE",
                          "CREATE OR REPLACE FUNCTION", "auth.jwt()",
                          "supabase db push", "supabase link"):
            self.assertNotIn(forbidden, self.sql)
        self.assertIn("current_database()<>'postgres'", self.sql)
        self.assertIn("to_regclass('public.players') IS NOT NULL", self.sql)
        self.assertIn("to_regclass('public.payment_dues') IS NOT NULL", self.sql)

    def test_real_coach_jwt_and_mapping_required(self):
        self.assertIn("ag3.signup_with_token(key, \"ag32-coach-a\")", self.source)
        self.assertIn("ag3.signup_with_token(key, \"ag32-coach-b\")", self.source)
        self.assertIn("coach_a_uuid=", self.source)
        self.assertIn("coach_b_uuid=", self.source)
        self.assertIn("ag3.rest(key, token", self.source)

    def test_inactive_same_academy_and_foreign_ids_exercised(self):
        self.assertIn("BATCH_INACTIVE_A", self.source)
        self.assertIn("row_filter=BATCH_INACTIVE_A", self.source)
        self.assertIn("row_filter=batch", self.source)
        self.assertIn("own_a + inactive_a", self.source)
        self.assertIn("is_active", self.sql)
        self.assertIn("false", self.sql)
        self.assertIn("true", self.sql)

    def test_read_scope_rejects_foreign_row(self):
        with mock.patch.object(ag3, "rest", return_value=(
             200, [{"id": ag3.BATCH_B, "academy_id": ag3.ACADEMY_B}])):
            with self.assertRaises(ag32.Ag32Failure):
                ag32.read_scoped("key", "token", [
                    {"id": ag3.BATCH_A, "academy_id": ag3.ACADEMY_A}])

    def test_read_scope_rejects_duplicates_and_extra_fields(self):
        a = {"id": ag3.BATCH_A, "academy_id": ag3.ACADEMY_A}
        with mock.patch.object(ag3, "rest", return_value=(200, [a, a])):
            with self.assertRaises(ag32.Ag32Failure):
                ag32.read_scoped("key", "token", [a])
        with mock.patch.object(ag3, "rest", return_value=(200, [
              dict(a, private_data="unexpected")])):
            with self.assertRaises(ag32.Ag32Failure):
                ag32.read_scoped("key", "token", [a])

    def test_read_scope_is_order_independent(self):
        a = {"id": ag3.BATCH_A, "academy_id": ag3.ACADEMY_A}
        b = {"id": ag32.BATCH_INACTIVE_A, "academy_id": ag3.ACADEMY_A}
        with mock.patch.object(ag3, "rest", return_value=(200, [b, a])):
            ag32.read_scoped("key", "owner_token", [a, b])

    def test_unauthorized_mapping_endpoint_rejected(self):
        with self.assertRaises(ValueError):
            ag32.deny_ungranted_table("key", "token", "payment_dues")
        reply = mock.MagicMock()
        reply.__enter__.return_value.status = 200
        with mock.patch.object(ag32, "urlopen", return_value=reply):
            with self.assertRaises(ag32.Ag32Failure):
                ag32.deny_ungranted_table("key", "token", "coach_batches")
        denied = HTTPError("local", 403, "forbidden", {}, None)
        with mock.patch.object(ag32, "urlopen", side_effect=denied):
            ag32.deny_ungranted_table("key", "token", "coach_batches")

    def test_sql_and_http_invocation_no_shell(self):
        ret = mock.Mock(returncode=0, stdout="MARKER")
        with mock.patch.object(ag32.subprocess, "run", return_value=ret) as run:
            ag32.psql("-At", "-c", "SELECT 1")
        args = run.call_args.args[0]
        self.assertEqual(args[:6], ["docker", "exec", ag32.CONTAINER,
                                   "psql", "-U", "postgres"])
        self.assertFalse(run.call_args.kwargs.get("shell", False))

    def test_mutation_and_header_denials_exist(self):
        for phrase in ('method="POST"', 'method="PATCH"', 'method="DELETE"',
                       "x-academy-id", "x-user-id", "invalid.ag32.bearer",
                       'deny_ungranted_table(key, token_coach_a, name)'):
            self.assertIn(phrase, self.source)

    def test_no_production_equivalence_claim(self):
        with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": ""}):
            with mock.patch("builtins.print") as output:
                ag32.record_summary([("scope", "PASS")], True)
        report = output.call_args.args[0]
        self.assertIn("Not certified", report)
        self.assertIn("Hosted policies", report)
        self.assertIn("no canonical migration", report)


if __name__ == "__main__":
    unittest.main()
