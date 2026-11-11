"""AG3.4D source-attested finance SQL, RPC and Storage inventory safety tests."""
import json
from pathlib import Path
import re
import sys
import unittest
from unittest import mock

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import ag3_4d_finance_jwt_ci as d
HERE=ROOT/"supabase/tests/security"
D_SQL=HERE/"ag34d1_live_finance_read_policies.sql"
FINGERPRINTS=HERE/"ag34d2_live_rpc_storage_fingerprints.json"

class DGuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql=D_SQL.read_text(encoding="utf-8")
        cls.script=Path(d.__file__).read_text(encoding="utf-8")
        cls.snapshot=json.loads(FINGERPRINTS.read_text(encoding="utf-8"))

    def test_fresh_disposable_base_is_enforced(self):
        for x in ("current_database()<>'postgres'","session_user<>'postgres'",
                  "to_regclass('public.payment_dues') IS NOT NULL",
                  "to_regclass('public.parent_payment_submissions') IS NOT NULL",
                  "(SELECT count(*) FROM auth.users)<>17"):
            self.assertIn(x,self.sql)
        for x in ("GITHUB_ACTIONS","GITHUB_REPOSITORY",
                  "SUPABASE_ACCESS_TOKEN","SUPABASE_DB_URL",
                  "project-ref","c2.EXPECTED_COUNTS"):
            self.assertIn(x,self.script)

    def test_exact_nine_finance_source_predicates(self):
        for name in ("payment_dues_academy_owner_select","payment_dues_parent_select",
                     "payment_dues_super_admin_all","payments_academy_owner_select",
                     "payments_parent_select","payments_super_admin_select",
                     "parent_payment_submissions_select_academy_owner",
                     "parent_payment_submissions_select_parent",
                     "parent_payment_submissions_select_super_admin"):
            self.assertIn("CREATE POLICY "+name+" ON public.",self.sql)
        self.assertEqual(self.sql.count("CREATE POLICY "),9)
        self.assertIn("np<>9 OR nf<>6",self.sql)

    def test_finance_sources_are_scoped_to_select(self):
        self.assertIn("GRANT SELECT ON public.payment_dues,public.payments,public.parent_payment_submissions TO authenticated",self.sql)
        self.assertNotIn("GRANT INSERT",self.sql)
        self.assertNotIn("GRANT UPDATE",self.sql)
        self.assertNotIn("GRANT DELETE",self.sql)

    def test_signed_jwt_finance_scope_and_parent_inactive(self):
        for token in ("parent-a1","parent-a2","parent-b","owner-a","owner-b",
                      "coach-a","coach-b","super-admin"):
            self.assertIn('"'+token+'"',self.script)
        self.assertIn("is_active=false",self.script)
        self.assertIn("is_active=true",self.script)
        self.assertIn("invalid.ag34d.bearer",self.script)
        self.assertIn("x-user-id",self.script)
        self.assertIn("LIMIT: finance read SELECT only",self.script)

    def test_public_rpc_inventory_exact_and_no_anon(self):
        rpc=self.snapshot["rpc"]
        self.assertEqual(len(rpc),14)
        self.assertEqual(len({x["signature"] for x in rpc}),14)
        for x in rpc:
            self.assertTrue(re.fullmatch("[0-9a-f]{32}",x["source_md5"]))
            self.assertEqual(x["config"],'search_path=""')
            self.assertTrue(x["auth_exec"])
            self.assertFalse(x["anon_exec"])

    def test_storage_16_policies_and_bucket_visibility(self):
        policies=self.snapshot["storage_policies"]
        self.assertEqual(len(policies),16)
        self.assertEqual(len({(x["tablename"],x["policyname"]) for x in policies}),16)
        self.assertEqual({x["id"]:x["is_public"] for x in self.snapshot["buckets"]},
                         {"academy-logos":True,"academy-upi-qr":True,
                          "coach-photos":True,"player-photos":False})
        for p in policies:
            self.assertRegex(p["predicate_md5"],r"^[a-f0-9]{32}$")

    def test_snapshot_is_not_runtime_rpc_claim(self):
        self.assertIn("not a JWT RPC or Storage request test",self.snapshot["source"])
        self.assertIn("not role enforcement"," ".join(self.snapshot["assertions"]))
        self.assertIn("not deployed remediation"," ".join(self.snapshot["assertions"]))

    def test_no_live_access_or_migration(self):
        for text in ("ulyealhkmlorsbdiknrh","apply_migration",
                     "supabase link","supabase db push",
                     "DELETE FROM public.payments","service_role"):
            self.assertNotIn(text,self.script)
        self.assertNotIn("DROP TABLE",self.sql)

    def test_finance_read_check_fail_closed(self):
        one={"id":d.DUE_IDS[0],"player_id":d.PLAYER_IDS[0]}
        with mock.patch.object(d,"rest",return_value=(200,[one,one])):
            with self.assertRaises(d.FinanceFailure):
                d.expected_rows("key","jwt","payment_dues",[one])
        with mock.patch.object(d,"rest",return_value=(200,[one])):
            d.expected_rows("key","jwt","payment_dues",[one])


if __name__=="__main__":
    unittest.main()
