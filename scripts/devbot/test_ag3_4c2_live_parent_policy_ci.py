"""AG3.4C2 disposable policy + runner safety assertions, no network/Docker."""
from __future__ import annotations
from pathlib import Path
import re
import unittest
from unittest import mock
import sys

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import ag3_4c2_live_parent_policy_ci as c2
import ag3_4b_live_mapping_ci as ag34b

SQL=ROOT/"supabase/tests/security/ag34c2_live_parent_coach_sa_select.sql"

class C2SourceSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql=SQL.read_text(encoding="utf-8")
        cls.script=Path(c2.__file__).read_text(encoding="utf-8")

    def test_disposable_only_and_no_historical_sql(self):
        for expected in ("current_database()<>'postgres'","session_user<>'postgres'",
                         "to_regclass('public.payment_dues') IS NOT NULL",
                         "to_regclass('public.subscription_periods') IS NOT NULL",
                         "count(*) FROM auth.users)<>9"):
            self.assertIn(expected,self.sql)
        for forbidden in ("DROP TABLE ","DELETE FROM auth.users","TRUNCATE ",
                          "supabase db push","supabase link","CREATE ROLE "):
            self.assertNotIn(forbidden,self.sql)

    def test_exact_six_role_policies(self):
        for name in ("batches_select","batches_parent_select","parents_select",
                     "parents_parent_select","players_select","players_parent_select"):
            self.assertRegex(self.sql,r"CREATE POLICY "+name+r" ON public.")
        self.assertEqual(self.sql.count("CREATE POLICY "),6)
        self.assertIn("actual_count<>6",self.sql)

    def test_all_synthetic_read_policies_removed(self):
        for name,table in (
            ("ag3_synthetic_owner_batch_read","batches"),
            ("ag32_synthetic_coach_batch_read","batches"),
            ("ag33_synthetic_parent_batch_read","batches"),
            ("ag33_synthetic_super_admin_batch_read","batches"),
            ("ag33_synthetic_parent_record_read","parents"),
            ("ag33_synthetic_linked_player_read","players")):
            self.assertIn("DROP POLICY "+name+" ON public."+table+";",self.sql)

    def test_exact_current_parent_helper_has_role_and_active(self):
        for clause in ("p.user_id = auth.uid()",
                       "lower(coalesce(u.role, '')) = 'parent'",
                       "p.is_active = true","STABLE SECURITY DEFINER",
                       "md5(pg_get_functiondef('private.current_parent_id()'::regprocedure))",
                       "5cd00d89a1a947ad5b9ee315bba211e2"):
            self.assertIn(clause,self.sql)
        self.assertIn("$function$;\n",self.sql)

    def test_sql_guard_and_checksum_fail_closed(self):
        self.assertEqual(self.sql.count("AS expected(tablename,policyname,predicate_md5)"),1)
        self.assertIn("md5(coalesce(p.qual,'')||chr(31)||coalesce(p.with_check,''))",self.sql)
        self.assertIn("has_table_privilege('anon','public.parents','SELECT')",self.sql)

    def test_runner_never_connects_to_hosted(self):
        self.assertEqual(c2.CONTAINER,"supabase_db_kheltriva-ag34c2-ci")
        for word in ("SUPABASE_ACCESS_TOKEN","SUPABASE_DB_URL",
                     "project-ref","GITHUB_ACTIONS","GITHUB_REPOSITORY",
                     "ag3.signup_with_token","ag34b.CONTAINER=CONTAINER"):
            self.assertIn(word,self.script)

    def test_roles_include_inactive_parent_and_regression(self):
        for word in ("parent_a1,token_a1","parent_a2,token_a2",
                     "coach_a,token_ca","sa,token_sa",
                     "is_active=false","is_active=true",
                     "ag33.expect_denial","ag32.read_scoped",
                     "ag33.expect_rows"):
            self.assertIn(word,self.script)

    def test_no_broad_production_actions(self):
        for forbidden in ("supabase link","supabase db push","apply_migration",
                          "service_role","postgresql://","ulyealhkmlorsbdiknrh"):
            self.assertNotIn(forbidden,self.script)

    def test_probe_runner_is_fail_closed(self):
        with mock.patch.object(ag34b,"sql",return_value="wrong"):
            self.assertNotEqual(c2.counts(),c2.EXPECTED_COUNTS)
        self.assertEqual(c2.EXPECTED_COUNTS.split("|"),["9","8","3","3","3","5","2","2","12"])


if __name__=="__main__":
    unittest.main()
