"""AG3 CI-only RLS test guards; never starts Docker, Supabase or live HTTP."""
import re
import sys
from pathlib import Path
from unittest import TestCase, mock
from urllib.error import HTTPError

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ag3_real_rls_ci as ag3


class Ag3Guards(TestCase):
    def test_postgrest_uses_loopback_only(self):
        self.assertEqual(ag3.API_URL, "http://127.0.0.1:54321")
        self.assertEqual(ag3.PROJECT, "kheltriva-ag2-ci")
        self.assertEqual(ag3.BATCH_A, "b0000000-0000-4000-8000-000000000001")
        self.assertEqual(ag3.BATCH_B, "b0000000-0000-4000-8000-000000000002")

    def test_owner_a_and_b_have_distinct_scope(self):
        self.assertNotEqual(ag3.BATCH_A, ag3.BATCH_B)
        self.assertNotEqual(ag3.ACADEMY_A, ag3.ACADEMY_B)
        self.assertEqual(len(ag3.ALLOWED_RLS_FIXTURES), 1)

    def test_http_result_sanitizes_errors(self):
        e = HTTPError(ag3.API_URL, 403, "forbidden", {}, None)
        with mock.patch.object(ag3, "urlopen", side_effect=e):
            code, result = ag3.postgrest("sb_publishable_local", "/rest/v1/batches?select=id")
            self.assertEqual(code, 403)
            self.assertIsNone(result)
        with mock.patch.object(ag3, "urlopen", side_effect=OSError("private secret")):
            with self.assertRaises(ag3.Ag3Error) as captured:
                ag3.postgrest("sb_publishable_local", "/rest/v1/batches?select=id")
        self.assertNotIn("private secret", str(captured.exception))

    def test_claimed_identity_must_be_go_true_verified(self):
        source = (HERE / "ag3_real_rls_ci.py").read_text(encoding="utf-8")
        self.assertIn('ag2.auth_json("/auth/v1/user"', source)
        self.assertIn('ag2.auth_json("/auth/v1/signup"', source)
        self.assertNotIn("set_config('request.jwt", source)
        self.assertNotIn("SET request.jwt", source)
        self.assertNotIn("service_role", source.lower())

    def test_sql_is_scratch_only_and_read_only_grants(self):
        source = (HERE.parent.parent / "supabase/tests/subscriptions/ps_l2_3_b2_9_ag3_owner_rls.sql").read_text()
        self.assertEqual(len(re.findall(r"(?m)^CREATE POLICY ", source)), 1)
        self.assertEqual(len(re.findall(r"(?m)^GRANT SELECT ON TABLE ", source)), 1)
        self.assertIn("TO authenticated", source)
        self.assertIn("private.current_academy_id()", source)
        self.assertIn("private.is_academy_owner()", source)
        for bad in ("GRANT ALL", "TO anon;", "TO PUBLIC;", "DISABLE ROW LEVEL SECURITY",
                    "supabase link", "DROP TABLE", "INSERT INTO auth.users"):
            self.assertNotIn(bad, source)
        self.assertIn("NOTIFY pgrst, 'reload schema'", source)

    def test_no_sql_or_hosted_mutation(self):
        source = (HERE / "ag3_real_rls_ci.py").read_text(encoding="utf-8")
        for bad in ("supabase db push", "supabase link", "supabase.co",
                    "SUPABASE_SERVICE_ROLE_KEY", "requests.post("):
            self.assertNotIn(bad, source)
        self.assertIn("EXPECTED_STATE", source)


if __name__ == "__main__":
    import unittest
    unittest.main()
