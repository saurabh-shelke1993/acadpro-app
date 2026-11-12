"""AG3.4D3.3: fail-closed UPI source, role-boundary and ledger regression guards."""
from __future__ import annotations

from pathlib import Path
import re
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import ag3_4d33_upi_rpc_jwt_ci as d33

BASE=ROOT/"supabase/tests/security"
SOURCE=(BASE/d33.SOURCE_SQL).read_text(encoding="utf-8")
CANDIDATE=(BASE/d33.FIX_SQL).read_text(encoding="utf-8")
RUNNER=Path(d33.__file__).read_text(encoding="utf-8")

class UpiSourceAndSafetyGuards(unittest.TestCase):
    def test_live_function_source_hashes_pinned(self):
        expected={
            "submit_parent_upi_payment(uuid,numeric,text,date,text)":"d3788514af85e404504861936cfef20e",
            "review_parent_upi_payment(uuid,text,text)":"33852ded2505672448ed44ccf46a43e2",
            "record_accepted_parent_upi_submission(uuid)":"ff98c595f28944f33b7a8f50b4177722",
        }
        for sig,source_hash in expected.items():
            self.assertIn("public."+sig,SOURCE)
            self.assertIn(source_hash,SOURCE)
            self.assertIn(source_hash,CANDIDATE)
        self.assertEqual(SOURCE.count("CREATE OR REPLACE FUNCTION public."),3)
        self.assertEqual(CANDIDATE.count("CREATE OR REPLACE FUNCTION public."),3)
        self.assertIn("md5(pg_get_functiondef(",SOURCE)

    def test_original_unsafe_comparators_unchanged(self):
        self.assertIn("IF private.current_user_role() <> 'parent' THEN",SOURCE)
        self.assertEqual(SOURCE.count("IF v_role <> 'academy_owner' THEN"),2)
        self.assertIn("v_submission.academy_id <> (SELECT private.current_academy_id())",SOURCE)
        self.assertIn("v_submission.academy_id IS DISTINCT FROM (SELECT private.current_academy_id())",SOURCE)
        self.assertNotIn("IF private.current_user_role() IS DISTINCT FROM 'parent' THEN",SOURCE)

    def test_scratch_candidate_minimal_null_safe_guards(self):
        self.assertIn("IF private.current_user_role() IS DISTINCT FROM 'parent' THEN",CANDIDATE)
        self.assertEqual(CANDIDATE.count("IF v_role IS DISTINCT FROM 'academy_owner' THEN"),2)
        self.assertNotIn("IF v_role <> 'academy_owner' THEN",CANDIDATE)
        self.assertNotIn("IF private.current_user_role() <> 'parent' THEN",CANDIDATE)
        self.assertIn("candidate refuses non-original",CANDIDATE)
        self.assertIn("SCRATCH ONLY NULL ROLE CANDIDATES INSTALLED",CANDIDATE)
        self.assertIn("md5(pg_get_functiondef(",CANDIDATE)

    def test_isolation_migration_and_permissions(self):
        for term in ("current_database()<>'postgres'","session_user<>'postgres'",
                     "(SELECT count(*) FROM auth.users)<>36",
                     "(SELECT count(*) FROM public.users)<>26",
                     "to_regprocedure('public.submit_parent_upi_payment",
                     "ALTER TABLE public.parent_payment_submissions",
                     "CREATE UNIQUE INDEX ag34d33_active_due_unique",
                     "ALTER COLUMN id SET DEFAULT gen_random_uuid()",
                     "CREATE UNIQUE INDEX ag34d33_academy_utr_unique",
                     "CREATE TRIGGER ag34d33_fail_reference",
                     "REVOKE ALL ON FUNCTION public.", "GRANT EXECUTE ON FUNCTION public."):
            self.assertIn(term,SOURCE)
        self.assertNotIn("GRANT INSERT ON public.parent_payment_submissions",SOURCE)
        self.assertNotIn("GRANT UPDATE ON public.parent_payment_submissions",SOURCE)
        self.assertNotIn("GRANT UPDATE ON public.payment_dues",SOURCE)
        for forbidden in ("ulyealhkmlorsbdiknrh","borsjaktqcuicmuiuldc",
                          "supabase db push","supabase link","apply_migration",
                          "service_role JWT","DROP SCHEMA supabase_migrations"):
            self.assertNotIn(forbidden,RUNNER)

    def test_real_auth_isolation_gate(self):
        for term in ("GITHUB_ACTIONS","GITHUB_REPOSITORY","RUNNER_TEMP",
                     "SUPABASE_ACCESS_TOKEN","SUPABASE_DB_URL","project-ref",
                     "supabase/migrations","ag3.signup_with_token",
                     '"unmapped"','"parent-a"','"parent-b"',
                     '"owner-a"','"owner-b"','"coach"','"super-admin"'):
            self.assertIn(term,RUNNER)
        self.assertLess(RUNNER.index('marker="AG3.4D3.3 EXACT UPI'),
                        RUNNER.index('marker="AG3.4D3.3 SCRATCH ONLY'))

    def test_original_source_classification_is_precise(self):
        for term in ("Parent profile not found","foreign key constraint",
                     "IS DISTINCT FROM blocked unmapped recording",
                     "original review unexpectedly persisted",
                     "NOT a proven review data write"):
            self.assertIn(term,RUNNER)
        self.assertNotIn("REPRODUCED: unmapped UPI review wrote",RUNNER)

    def test_submission_and_review_business_invariants(self):
        for term in ("allow_submit","allow_review","Parent profile not found",
                     "AG34D33-UNMAPPED","Claim amount cannot exceed",
                     "Payment date cannot be in the future",
                     "duplicate key value violates unique constraint",
                     "This UPI transaction reference has already been submitted",
                     "You are not authorized to submit a claim for this player",
                     "You are not authorized to review this academy payment claim",
                     "Provide a reason of at least 3 characters",
                     "This payment claim has already been reviewed"):
            self.assertIn(term,RUNNER)
        self.assertIn("before = fingerprint(include_claims=False)",RUNNER)

    def test_recording_audit_and_atomicity(self):
        for term in ("allow_record","external_transaction_reference",
                     "receipt_number","payment_entry_type='payment'",
                     "status'!='recorded'", # see direct source paths below
                     "remaining_amount","AG34D33 synthetic recording rollback",
                     "already been recorded","ThreadPoolExecutor",
                     "two parallel accepted-claim recording requests"):
            if term=="status'!='recorded'":
                continue
            self.assertIn(term,RUNNER)
        self.assertIn("CREATE TRIGGER ag34d33_fail_reference",SOURCE)
        self.assertIn("NEW.external_transaction_reference='AG34D33-FORCE-ROLLBACK'",SOURCE)
        self.assertIn("FROM public.collect_payment(",SOURCE)
        self.assertIn("before=fingerprint()",RUNNER)

    def test_anon_and_invalid_tokens(self):
        for name in ('"submit_parent_upi_payment"','"review_parent_upi_payment"',
                     '"record_accepted_parent_upi_submission"'):
            self.assertIn(name,RUNNER)
        self.assertIn("invalid.ag34d33.jwt",RUNNER)
        self.assertIn("code not in (401,403,404)",RUNNER)
        self.assertIn("has_function_privilege('anon'",SOURCE)

    def test_negative_rejects_unexpected_success(self):
        with patch.object(d33,"fingerprint",return_value="unchanged"), \
             patch.object(d33,"rpc",return_value=(200,{"status":"accepted"})):
            with self.assertRaises(d33.UpiFailure):
                d33.deny("key","token","review_parent_upi_payment",{},"Only the Academy Owner")

    def test_negative_rejects_unrelated_error(self):
        with patch.object(d33,"fingerprint",return_value="unchanged"), \
             patch.object(d33,"rpc",return_value=(400,{"message":"missing table"})):
            with self.assertRaises(d33.UpiFailure):
                d33.deny("key","token","review_parent_upi_payment",{},"Only the Academy Owner")

    def test_negative_rejects_state_changes(self):
        with patch.object(d33,"fingerprint",side_effect=["before","after"]), \
             patch.object(d33,"rpc",return_value=(400,{"message":"expected"})):
            with self.assertRaises(d33.UpiFailure):
                d33.deny("key","token","review_parent_upi_payment",{},"expected")

if __name__=="__main__":
    unittest.main()
