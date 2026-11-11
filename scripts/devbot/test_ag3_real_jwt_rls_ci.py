"""AG3.1 pure scope/safety tests; no Docker, GoTrue or SQL is executed."""
import os
import sys
import unittest
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError

DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(DIR))
import ag3_real_jwt_rls_ci as ag3


class Ag3Safety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.src = Path(ag3.__file__).read_text(encoding="utf-8")
        cls.sql = (DIR.parents[1] / "supabase/tests/subscriptions" /
                   ag3.POLICY_FILE).read_text(encoding="utf-8")

    def test_exact_local_target(self):
        self.assertEqual(ag3.PROJECT, "kheltriva-ag3-ci")
        self.assertEqual(ag3.API_URL, "http://127.0.0.1:54321")
        self.assertEqual(ag3.CONTAINER, "supabase_db_kheltriva-ag3-ci")

    def test_policy_only_allows_read_for_authenticated(self):
        for term in ("FOR SELECT TO authenticated", "GRANT SELECT ON TABLE public.batches TO authenticated",
                     "(SELECT private.is_academy_owner())",
                     "(SELECT private.current_academy_id())", "NOTIFY pgrst"):
            self.assertIn(term, self.sql)
        self.assertNotIn("TO anon;", self.sql)
        self.assertNotIn("GRANT UPDATE", self.sql)
        self.assertNotIn("GRANT INSERT", self.sql)
        self.assertNotIn("GRANT DELETE", self.sql)
        self.assertNotIn("auth.jwt()", self.sql)

    def test_no_auth_or_historical_writes(self):
        for forbidden in ("DROP TABLE", "ALTER TABLE public.users",
                          "CREATE OR REPLACE FUNCTION", "INSERT INTO auth.users",
                          "supabase link", "supabase db push", "SUPABASE_ACCESS_TOKEN"):
            self.assertNotIn(forbidden, self.sql)
        self.assertIn("current_database() <> 'postgres'", self.sql)

    def test_postgrest_user_jwt_and_http_denials(self):
        self.assertIn("ag2.auth_json(\"/auth/v1/signup\"", self.src)
        self.assertIn("ag2.auth_json(\"/auth/v1/user\"", self.src)
        self.assertIn("Bearer \" + token", self.src)
        for method in ('"POST"', '"PATCH"', '"DELETE"'):
            self.assertIn(method, self.src)
        for term in ("smoke_token", "token_a", "token_b", "x-academy-id", "x-user-id"):
            self.assertIn(term, self.src)

    def test_http_methods_reject_arbitrary_values(self):
        with self.assertRaises(ValueError):
            ag3.rest("key", "token", method="TRUNCATE")

    def test_denial_rejects_success(self):
        with mock.patch.object(ag3, "rest", return_value=(200, [])):
            with self.assertRaises(ag3.Ag3Failure):
                ag3.deny_http("key", "token")
        with mock.patch.object(ag3, "rest", return_value=(403, None)):
            ag3.deny_http("key", "token")

    def test_cross_academy_scope_assertion(self):
        with mock.patch.object(ag3, "rest", return_value=(200, [{"id":ag3.BATCH_B,"academy_id":ag3.ACADEMY_B}])):
            with self.assertRaises(ag3.Ag3Failure):
                ag3.expected_rows("key", "token", [{"id":ag3.BATCH_A,"academy_id":ag3.ACADEMY_A}])

    def test_only_local_sql_exec_no_shell(self):
        result = mock.Mock(returncode=0, stdout="OK")
        with mock.patch.object(ag3.subprocess, "run", return_value=result) as runner:
            ag3.psql("-At", "-c", "SELECT 1")
        args = runner.call_args.args[0]
        self.assertEqual(args[:6], ["docker","exec",ag3.CONTAINER,"psql","-U","postgres"])
        self.assertFalse(runner.call_args.kwargs.get("shell", False))

    def test_summary_admits_not_production_equivalence(self):
        with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": ""}):
            with mock.patch("builtins.print") as write:
                ag3.summary([("demo","PASS")], True)
        self.assertIn("not production-schema policy equivalence", write.call_args.args[0])

if __name__ == "__main__":
    unittest.main()
