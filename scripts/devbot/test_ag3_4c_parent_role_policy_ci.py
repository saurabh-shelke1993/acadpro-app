"""AG3.4C pure safety/source checks: no database and no network."""
import os
import sys
import unittest
from pathlib import Path
from unittest import mock
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import ag3_4c_parent_role_policy_ci as c

class Ag34CSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.src=Path(c.__file__).read_text(encoding="utf-8")
        cls.policy=c.SOURCE.read_text(encoding="utf-8")

    def test_unlinked_ephemeral_only(self):
        self.assertEqual(c.PROJECT,"kheltriva-ag34c-ci")
        self.assertEqual(c.CONTAINER,"supabase_db_kheltriva-ag34c-ci")
        for term in ("GITHUB_ACTIONS","GITHUB_REPOSITORY",
                     "SUPABASE_ACCESS_TOKEN","SUPABASE_DB_URL",
                     "project-ref","migrations"):
            self.assertIn(term,self.src)

    def test_parent_helper_is_exact_current_live_source(self):
        for term in ("private.current_parent_id()",
                     "p.is_active = true",
                     "lower(coalesce(u.role, '')) = 'parent'",
                     "p.user_id = auth.uid()",
                     "STABLE SECURITY DEFINER",
                     "search_path TO 'public', 'private', 'pg_catalog'",
                     "5cd00d89a1a947ad5b9ee315bba211e2"):
            self.assertIn(term,self.policy)

    def test_five_production_select_policy_digests(self):
        expected={
            "batches_parent_select":"7fa1a5d0550c9c2ffa87a02fb037fbd6",
            "parents_parent_select":"b865353d9d2219422abfc5728d5c96d5",
            "parents_select":"373e2e1995e7ab9e1b3500ed71da9e26",
            "players_parent_select":"4727910545b4a4237a003ba156af09de",
            "players_select":"0a877b1bd82f622f005c45fd9fd98cf5"
        }
        for name,digest in expected.items():
            self.assertIn("CREATE POLICY "+name+" ON public.",self.policy)
            self.assertIn(digest,self.policy)
        self.assertIn("AG3.4C exact deployed Parent policy checksum mismatch",self.policy)

    def test_only_own_synthetic_policies_replaced(self):
        for name in ("ag33_synthetic_parent_record_read",
                     "ag33_synthetic_linked_player_read",
                     "ag33_synthetic_parent_batch_read"):
            self.assertIn("DROP POLICY "+name,self.policy)
        for forbidden in ("DROP TABLE","INSERT INTO auth.users",
                          "GRANT EXECUTE ON FUNCTION private.current_parent_id() TO anon",
                          "supabase link","supabase db push"):
            self.assertNotIn(forbidden,self.policy)

    def test_anti_hosted_and_role_risk_probes(self):
        for term in ("to_regclass('public.payment_dues') IS NOT NULL",
                     "current_database()<>'postgres'",
                     "to_regprocedure('private.current_parent_id()') IS NOT NULL",
                     "ALTER TABLE public.parents ADD COLUMN is_active",
                     "NOTIFY pgrst"):
            self.assertIn(term,self.policy)
        for term in ("set_parent_active(ag33.PARENT_A1_ID,False)",
                     "set_parent_active(ag33.PARENT_A1_ID,True)",
                     'set_app_role(parent_a1,"coach")',
                     'set_app_role(parent_a1,"parent")',
                     "coach_a_token", "coach_b_token", "token_sa",
                     "invalid.ag34c.bearer","x-user-id"):
            self.assertIn(term,self.src)

    def test_refuse_unapproved_synthetic_changes(self):
        with self.assertRaises(ValueError):
            c.set_parent_active("1234",False)
        with self.assertRaises(ValueError):
            c.set_app_role("fake","super_admin")

    def test_psql_call_not_shell(self):
        fake=mock.Mock(returncode=0,stdout="OK")
        with mock.patch.object(c.subprocess,"run",return_value=fake) as m:
            c.sql("-At","-c","SELECT 1")
        self.assertEqual(m.call_args.args[0][:6],
                         ["docker","exec",c.CONTAINER,"psql","-U","postgres"])
        self.assertFalse(m.call_args.kwargs.get("shell",False))

    def test_report_does_not_certify_all_policies(self):
        with mock.patch.dict(os.environ,{"GITHUB_STEP_SUMMARY":""}):
            with mock.patch("builtins.print") as out:
                c.report([("proof","PASS")],True)
        self.assertIn("Only the verified Parent/Player/Batch SELECT subset",out.call_args.args[0])

if __name__=="__main__":
    unittest.main()
