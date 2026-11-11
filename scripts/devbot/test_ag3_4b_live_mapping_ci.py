"""AG3.4B pure guard/semantic tests; no Supabase, Docker or network."""
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import ag3_4b_live_mapping_ci as b

class Ag34BSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner=Path(b.__file__).read_text(encoding="utf-8")
        cls.orig=(b.FIXTURE_DIR/b.LIVE_SQL).read_text(encoding="utf-8")
        cls.fixed=(b.FIXTURE_DIR/b.CANDIDATE_SQL).read_text(encoding="utf-8")

    def test_only_disposable_ci_target(self):
        self.assertEqual(b.PROJECT,"kheltriva-ag34b-ci")
        self.assertEqual(b.CONTAINER,"supabase_db_kheltriva-ag34b-ci")
        for x in ("GITHUB_ACTIONS","GITHUB_REPOSITORY","SUPABASE_DB_URL",
                  "SUPABASE_ACCESS_TOKEN","project-ref","migrations"):
            self.assertIn(x,self.runner)

    def test_live_four_policy_predicates_and_md5_guard(self):
        for n in ("coach_batches_insert","coach_batches_update",
                  "coach_batches_delete","coach_batches_select"):
            self.assertIn("CREATE POLICY "+n,self.orig)
        for h in ("cd4193d15352dcfb25a4b3835e8850a4",
                  "957ab744836d9772e4258c85504827c0",
                  "7a3ff298bc791c74727729a21549b844",
                  "f82e68e0224f4417a0e0e7a0897be20e"):
            self.assertIn(h,self.orig)
        self.assertIn("authenticated",self.orig)

    def test_parent_read_and_nested_rls_probes(self):
        for x in ("token_a1,{LINKED,INACTIVE}","token_a2,{LINKED,INACTIVE}",
                  "coach_a_token,{LINKED,INACTIVE}","parent malicious INSERT",
                  "LIVE PREDICATE","status=post(key,token_a1,probe)",
                  "status=post(key,coach_a_token,probe)"):
            self.assertIn(x,self.runner)

    def test_candidate_roles_and_active_coach_scope(self):
        for x in ("private.is_academy_owner()","private.is_coach()",
                  "private.is_coach_assigned_to_batch(batch_id)",
                  "u.academy_id=private.current_academy_id()",
                  "WITH CHECK","TO authenticated"):
            self.assertIn(x,self.fixed)
        for x in ("token_a1,set()","token_a2,set()",
                  "coach_a_token,{LINKED}","owner_a_token,{LINKED,INACTIVE}"):
            self.assertIn(x,self.runner)

    def test_anti_ddl_and_historical_guard(self):
        for sql in (self.orig,self.fixed):
            self.assertIn("current_database()<>'postgres'",sql)
            self.assertIn("to_regclass('public.payment_dues') IS NOT NULL",sql)
            for ban in ("INSERT INTO auth.users","CREATE OR REPLACE FUNCTION",
                        "DROP TABLE","supabase db push","supabase link"):
                self.assertNotIn(ban,sql)
        self.assertIn("not deployed",self.fixed.lower())

    def test_rest_injection_methods_denied(self):
        with self.assertRaises(ValueError):
            b.rest("key","jwt",method="TRUNCATE")
        with self.assertRaises(ValueError):
            b.rest("key","jwt",method="POST")

    def test_exact_scope_requires_matching_ids(self):
        with mock.patch.object(b,"rest",return_value=(200,[
             {"id":"foreign","batch_id":"x","coach_id":"y"}])):
            with self.assertRaises(b.SecurityMismatch):
                b.expect_ids("key","token",{b.LINKED})
        with mock.patch.object(b,"rest",return_value=(200,[])):
            b.expect_ids("key","token",set())

    def test_denial_check_does_not_treat_modified_row_as_denied(self):
        with mock.patch.object(b,"rest",return_value=(200,[{"id":"x"}])):
            with self.assertRaises(b.SecurityMismatch):
                b.must_deny_write("key","token","PATCH",payload={"coach_id":"z"})
        with mock.patch.object(b,"rest",return_value=(200,[])):
            b.must_deny_write("key","token","DELETE",id_filter="x")
        with mock.patch.object(b,"rest",return_value=(403,None)):
            b.must_deny_write("key","token","POST",payload={})

    def test_sql_command_does_not_use_shell(self):
        fake=mock.Mock(returncode=0,stdout="pass")
        with mock.patch.object(b.subprocess,"run",return_value=fake) as run:
            b.sql("-At","-c","SELECT 1")
        self.assertEqual(run.call_args.args[0][:6],
                         ["docker","exec",b.CONTAINER,"psql","-U","postgres"])
        self.assertFalse(run.call_args.kwargs.get("shell",False))

    def test_summary_remains_scoped_not_live(self):
        with mock.patch.dict(os.environ,{"GITHUB_STEP_SUMMARY":""}):
            with mock.patch("builtins.print") as write:
                b.report([("sample","PASS")],True)
        output=write.call_args.args[0]
        self.assertIn("NOT deployed",output)
        self.assertIn("minimal FK",output)

if __name__=="__main__":
    unittest.main()
