"""AG3.4D3.1 static safety and fail-closed payment RPC test harness checks."""
from pathlib import Path
import sys
import unittest
from unittest import mock

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import ag3_4d3_collect_payment_jwt_ci as d3

SQL=(ROOT/"supabase/tests/security/ag34d3_collect_payment_rpc_scratch.sql").read_text(encoding="utf-8")
CANDIDATE=(ROOT/"supabase/tests/security/ag34d3_scratch_null_role_candidate.sql").read_text(encoding="utf-8")
SRC=Path(d3.__file__).read_text(encoding="utf-8")

class CollectPaymentSafety(unittest.TestCase):
    def test_source_pins_actual_live_functions(self):
        self.assertIn("CREATE OR REPLACE FUNCTION public.collect_payment(",SQL)
        self.assertIn("CREATE OR REPLACE FUNCTION private.next_payment_number(",SQL)
        self.assertIn("fcc5610c509392caf81ffa99b82051a9",SQL)
        self.assertIn("b5b81f242c8378bf91cbbfcf458ce5cb",SQL)
        self.assertIn("md5(pg_get_functiondef(",SQL)
        self.assertIn("FOR UPDATE", SQL.lower().upper())

    def test_unlinked_scratch_is_explicit(self):
        for token in ("current_database()<>'postgres'","session_user<>'postgres'",
                      "(SELECT count(*) FROM auth.users)<>23","to_regclass('public.payment_number_counters') IS NOT NULL"):
            self.assertIn(token,SQL)
        for guard in ("RUNNER_TEMP","GITHUB_ACTIONS","GITHUB_REPOSITORY",
                      "SUPABASE_ACCESS_TOKEN","SUPABASE_DB_URL",
                      "project-ref","migrations","d1.totals()"):
            self.assertIn(guard,SRC)

    def test_no_live_ddl_or_direct_client_mutation_grants(self):
        for prohibited in ("ulyealhkmlorsbdiknrh","supabase link","supabase db push",
                           "apply_migration","service_role", "DELETE FROM public.payments"):
            self.assertNotIn(prohibited,SRC)
        self.assertIn("REVOKE ALL ON FUNCTION public.collect_payment",SQL)
        self.assertIn("GRANT EXECUTE ON FUNCTION public.collect_payment",SQL)
        self.assertNotIn("GRANT INSERT ON public.payments",SQL)
        self.assertNotIn("GRANT UPDATE ON public.payment_dues",SQL)

    def test_real_jwt_roles_and_critical_invariants(self):
        for token in ('"owner-a"','"owner-b"','"coach"','"parent"',
                      '"super-admin"','"unmapped"','DUE_RACE',
                      'ThreadPoolExecutor','AG34D3_ABORT','snapshot()!=before',
                      'already fully paid','remaining_amount'):
            self.assertIn(token,SRC)

    def test_deny_rejects_success_and_mutation(self):
        with mock.patch.object(d3,"snapshot",side_effect=["a","a"]), \
             mock.patch.object(d3,"collect",return_value=(200,[{}])):
            with self.assertRaises(d3.RpcFailure):
                d3.deny("key","token",d3.DUE_A1,10,"test")
        with mock.patch.object(d3,"snapshot",side_effect=["a","b"]), \
             mock.patch.object(d3,"collect",return_value=(400,{"message":"test"})):
            with self.assertRaises(d3.RpcFailure):
                d3.deny("key","token",d3.DUE_A1,10,"test")

    def test_denial_must_be_specific_expected_guard(self):
        with mock.patch.object(d3,"snapshot",return_value="same"), \
             mock.patch.object(d3,"collect",return_value=(400,{"message":"missing relation"})):
            with self.assertRaises(d3.RpcFailure):
                d3.deny("key","token",d3.DUE_A1,10,"Only Academy Owner")
        with mock.patch.object(d3,"snapshot",return_value="same"), \
             mock.patch.object(d3,"collect",return_value=(400,{"message":"expected"})):
            d3.deny("key","token",d3.DUE_A1,10,"expected")

    def test_confirm_real_source_null_role_bug_and_candidate(self):
        self.assertIn("if v_role not in (\'super_admin\', \'academy_owner\') then",SQL)
        self.assertIn("if v_role is null or v_role not in",CANDIDATE)
        self.assertIn("AG34-HIGH-002 REPRODUCED",SRC)
        self.assertIn("DUE_PROBE",SRC)
        self.assertIn("unmapped signed-JWT denied after candidate",SRC)
        self.assertIn("md5(pg_get_functiondef",CANDIDATE)

    def test_scratch_fault_is_after_number_allocation(self):
        self.assertLess(SQL.index("CREATE OR REPLACE FUNCTION public.collect_payment("),
                        SQL.index("CREATE TRIGGER ag34d3_abort_payment"))
        self.assertIn("NEW.remarks='AG34D3_ABORT'",SQL)
        self.assertIn("next_payment_number(",SQL)
        self.assertIn("payment_number_counters",SQL)

if __name__=="__main__":
    unittest.main()
