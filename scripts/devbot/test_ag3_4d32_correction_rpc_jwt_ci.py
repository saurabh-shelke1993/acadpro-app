"""AG3.4D3.2 security source and fail-closed correction RPC runner regression tests."""
from __future__ import annotations
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import ag3_4d32_correction_rpc_jwt_ci as d32

BASE=ROOT/"supabase/tests/security"
SOURCE=(BASE/d32.SOURCE_SQL).read_text(encoding="utf-8")
CANDIDATE=(BASE/d32.FIX_SQL).read_text(encoding="utf-8")
RUNNER=Path(d32.__file__).read_text(encoding="utf-8")

class CorrectionSourceGuards(unittest.TestCase):
    def test_original_function_sources_pinned(self):
        for sig,hashstr in {
            "request_payment_correction(uuid,numeric,text)":"9e2900dd0a7c960554896e0e51b23075",
            "approve_payment_correction(uuid)":"adfb6a80c05255e6d250207ae1e3ae1d",
            "reject_payment_correction(uuid,text)":"c21c953c1ac3e9afa201e5ec7c28c4e5",
        }.items():
            self.assertIn(hashstr,SOURCE)
            self.assertIn(hashstr,CANDIDATE)
            self.assertIn("public."+sig,SOURCE)
        self.assertEqual(SOURCE.count("CREATE OR REPLACE FUNCTION public."),3)
        self.assertIn("md5(pg_get_functiondef(",SOURCE)
        self.assertEqual(SOURCE.count("if v_role not in ('super_admin', 'academy_owner') then"),3)

    def test_candidate_isolated_and_always_null_safe(self):
        self.assertEqual(CANDIDATE.count("CREATE OR REPLACE FUNCTION public."),3)
        self.assertEqual(sum(1 for line in CANDIDATE.splitlines() if line.strip().startswith("if v_role is null or v_role not in")),3)
        self.assertIn("md5(pg_get_functiondef(",CANDIDATE)
        self.assertIn("current_database()<>'postgres'",CANDIDATE)
        self.assertIn("(SELECT count(*) FROM auth.users)<>29",CANDIDATE)

    def test_disposable_guards_and_existing_baseline(self):
        for flag in ("RUNNER_TEMP","GITHUB_ACTIONS","GITHUB_REPOSITORY",
                     "SUPABASE_ACCESS_TOKEN","SUPABASE_DB_URL","project-ref",
                     "migrations","d1.sql","23","21"):
            self.assertIn(flag,RUNNER)
        for sql in ("current_database()<>'postgres'","session_user<>'postgres'",
                    "(SELECT count(*) FROM auth.users)<>29",
                    "to_regclass('public.payment_corrections') IS NOT NULL"):
            self.assertIn(sql,SOURCE)

    def test_no_live_or_direct_table_access(self):
        for forbidden in ("ulyealhkmlorsbdiknrh","borsjaktqcuicmuiuldc",
                          "supabase link","supabase db push","apply_migration"):
            self.assertNotIn(forbidden,RUNNER)
        self.assertIn("ALTER TABLE public.payment_corrections ENABLE ROW LEVEL SECURITY",SOURCE)
        self.assertIn("REVOKE ALL ON public.payment_corrections FROM PUBLIC,anon,authenticated",SOURCE)
        self.assertNotIn("GRANT INSERT ON public.payment_corrections",SOURCE)
        self.assertNotIn("GRANT UPDATE ON public.payment_dues",SOURCE)
        self.assertIn("REVOKE ALL ON FUNCTION public.",SOURCE)

    def test_real_jwt_roles_reproduction_and_negative_bounds(self):
        for term in ('"owner-a"','"owner-b"','"coach"','"parent"',
                     '"super-admin"','"unmapped"',
                     "AG34-HIGH-002 D3.2 REPRODUCED",
                     "allow_approve","allow_reject",
                     "Corrected amount must be greater than zero",
                     "Correction would overpay the payment due",
                     "Correction would make paid amount negative",
                     "A correction is already pending",
                     "AG34D32 synthetic adjustment rollback"):
            self.assertIn(term,RUNNER)

    def test_all_three_exact_rpc_exposure_and_anonymous_denial(self):
        self.assertIn('"request_payment_correction"',RUNNER)
        self.assertIn('"approve_payment_correction"',RUNNER)
        self.assertIn('"reject_payment_correction"',RUNNER)
        self.assertEqual(SOURCE.count("GRANT EXECUTE ON FUNCTION public."),3)
        self.assertEqual(SOURCE.count("REVOKE ALL ON FUNCTION public."),3)
        self.assertIn("has_function_privilege('anon'",SOURCE)

    def test_late_adjustment_failure_checks_atomicity(self):
        self.assertIn("CREATE TRIGGER ag34d32_fail_adjustment",SOURCE)
        self.assertIn("NEW.payment_entry_type='adjustment'",SOURCE)
        self.assertIn("AG34D32 synthetic adjustment rollback",SOURCE)
        self.assertIn("snapshot()",RUNNER)
        self.assertIn("SET enabled=true",RUNNER)
        self.assertIn("SET enabled=false",RUNNER)

    def test_source_declared_separately_from_candidate(self):
        self.assertNotIn("if v_role is null or v_role not in",SOURCE)
        self.assertIn("if v_role is null or v_role not in",CANDIDATE)
        self.assertIn("AG3.4D3.2 ORIGINAL CORRECTION RPCS SOURCE MATCHED IN SCRATCH",SOURCE)
        self.assertIn("AG34-HIGH-002 SCRATCH CORRECTION NULL ROLE CANDIDATE INSTALLED",CANDIDATE)

    def test_denial_fails_closed_on_unexpected_success(self):
        with patch.object(d32,"snapshot",return_value="unchanged"), \
             patch.object(d32,"rpc",return_value=(200,{"id":"not-denied"})):
            with self.assertRaises(d32.CorrectionFailure):
                d32.deny("key","token","request_payment_correction",{}, "Only Academy Owner")

    def test_denial_fails_closed_on_unrelated_error_or_mutation(self):
        with patch.object(d32,"snapshot",return_value="unchanged"), \
             patch.object(d32,"rpc",return_value=(400,{"message":"missing schema"})):
            with self.assertRaises(d32.CorrectionFailure):
                d32.deny("key","token","request_payment_correction",{},"Only Academy Owner")
        with patch.object(d32,"snapshot",side_effect=["before","after"]), \
             patch.object(d32,"rpc",return_value=(400,{"message":"expected guard"})):
            with self.assertRaises(d32.CorrectionFailure):
                d32.deny("key","token","request_payment_correction",{},"expected guard")

if __name__=="__main__":
    unittest.main()
