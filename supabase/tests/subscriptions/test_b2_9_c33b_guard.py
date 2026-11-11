"""Static tests for C3.3B atomic local-only helper installation."""
import json
from pathlib import Path
import re
import unittest
ROOT=Path(__file__).resolve().parents[3]
DIR=ROOT/"supabase/tests/subscriptions"
class TestC33B(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pre=(DIR/"ps_l2_3_b2_9_c33b_precheck.sql").read_text()
        cls.post=(DIR/"ps_l2_3_b2_9_c33b_postcheck.sql").read_text()
        cls.m=json.loads((DIR/"ps_l2_3_b2_9_live_helper_snapshot_manifest.json").read_text())
        cls.workflow=(ROOT/".github/workflows/subscriptions-ps-l2-3-b2-9-authorized-rls.yml").read_text()
    def test_all_eleven_hashes_pinned(self):
        self.assertEqual(len(self.m["functions"]),11)
        for fn in self.m["functions"]:
            self.assertIn(fn["sha256_pg_get_functiondef"],self.post)
            self.assertIn("'"+fn["helper"]+"'",self.post)
            self.assertIn(fn["search_path"][0],self.post)
    def test_reject_nonempty_and_wrong_environment(self):
        for s in ("current_database()<>'postgres'","session_user<>'postgres'",
                  "to_regnamespace('private') IS NOT NULL",
                  "SELECT 1 FROM auth.users","public.payment_dues",
                  "n<>5"):
            self.assertIn(s,self.pre)
    def test_native_auth_oid_and_hash_preservation(self):
        self.assertIn("ON COMMIT DROP",self.pre)
        self.assertIn("b29_native_auth_guard",self.post)
        self.assertIn("pg_catalog.sha256",self.post)
    def test_no_auth_function_recreation_or_historical_replay(self):
        for txt in (self.pre,self.post):
            self.assertNotRegex(txt,re.compile(r"(?im)^\s*(?:CREATE|DROP|ALTER)\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|TABLE|SCHEMA|ROLE)\s+auth\."))
            self.assertNotIn("supabase_migrations.schema_migrations",txt)
            self.assertNotIn("CREATE TABLE public.players",txt)
            self.assertNotIn("ps_l2_3_foundation.sql",txt)
    def test_acl_and_missing_jwt_guards(self):
        for s in ("has_function_privilege('anon'",
                  "has_function_privilege('service_role'",
                  "has_schema_privilege('anon'",
                  "p.prosecdef","p.proconfig","SET ROLE authenticated",
                  "auth.uid() IS NOT NULL"):
            self.assertIn(s,self.post)
    def test_atomicity_required_in_documentation(self):
        self.assertIn("--single-transaction",self.workflow)
        self.assertIn("ON_ERROR_STOP=1",self.workflow)
if __name__=="__main__":
    unittest.main()
