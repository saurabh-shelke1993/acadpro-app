"""B4 readiness must remain fail-closed until B3 Auth/RLS/finance parity is proven."""
import copy,json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[3]
BASE=ROOT/"supabase/recovery/historical-baseline"
def check(r,b36,a,b):
    if r["schema"]!="kheltriva-b4-readiness-assessment-v1" or r["project_id"]!=b36["project_id"] or r["project_id"]!=a["project_id"] or r["project_id"]!=b["project_id"]:
        raise ValueError("Project/source drift")
    if r["assessment"]!="NO_GO" or r["mode"]!="READ_ONLY_CURRENT_STATE_AND_REPOSITORY_METADATA":
        raise ValueError("B4 incorrectly approved")
    if len(a["helpers"])!=11 or b["subscription_b4_integrated"] or b36["source_version_count"]!=82:
        raise ValueError("Upstream replay prerequisite drift")
    if (r["historical_source_versions"]!=82 or r["original_elements"]!=168 or
        r["quarantined_migrations_pending_signoff"]!=14 or r["same_version_divergences_pending_signoff"]!=6 or
        r["b3_actual_runtime_tests_executed"]!=0 or r["b3_6_planned_runtime_tests"]!=35):
        raise ValueError("B3 readiness evidence mismatch")
    live=r["live_schema"]
    if any(live.values()) or r["disposable_supabase_branches_available"]!=0:
        raise ValueError("Live implementation/environment claim changed")
    refs=r["historical_live_reference"]
    if refs["agreements"]!=22 or refs["active_agreements"]!=22 or refs["academy_mismatched_agreements"]!=3 or refs["no_end_date"]!=22:
        raise ValueError("Legacy snapshot evidence drift")
    for flag in ["proposed_ps_l2_3_applied_to_live","legacy_agreements_owner_reconciled",
                 "legacy_renewal_activation_authorized","supabase_role_negative_tests_passed",
                 "full_historical_reconstruction_accepted","manual_owner_release_accepted",
                 "ready_for_b4_integration","live_data_modified","db_migrations_modified",
                 "executable_sql_generated","contains_customer_identifiers",
                 "contains_private_original_sql","contains_credentials"]:
        if r[flag] is not False:
            raise ValueError("Premature authorization or data exposure")
    if b36["guards"]["ready_for_disposable_replay"] is not False:
        raise ValueError("B3.6 unexpectedly approved")
    return True
class TestB4Readiness(unittest.TestCase):
    def setUp(self):
        self.r=json.loads((BASE/"b4_readiness_review_20261111.json").read_text())
        self.b36=json.loads((BASE/"b3_6_disposable_plan_20261111.json").read_text())
        self.a=json.loads((BASE/"b3_7a_helper_history_20261111.json").read_text())
        self.b=json.loads((BASE/"b3_7b_dependency_review_20261111.json").read_text())
    def test_existing_no_go(self):self.assertTrue(check(self.r,self.b36,self.a,self.b))
    def test_fabricated_b4_approval(self):
        r=copy.deepcopy(self.r);r["ready_for_b4_integration"]=True
        with self.assertRaises(ValueError):check(r,self.b36,self.a,self.b)
    def test_no_disposable_replay(self):
        r=copy.deepcopy(self.r);r["b3_actual_runtime_tests_executed"]=35
        with self.assertRaises(ValueError):check(r,self.b36,self.a,self.b)
    def test_no_live_schema_claim(self):
        r=copy.deepcopy(self.r);r["live_schema"]["subscription_periods"]=True
        with self.assertRaises(ValueError):check(r,self.b36,self.a,self.b)
    def test_no_legacy_approval(self):
        r=copy.deepcopy(self.r);r["legacy_agreements_owner_reconciled"]=True
        with self.assertRaises(ValueError):check(r,self.b36,self.a,self.b)
    def test_no_executed_sql(self):
        r=copy.deepcopy(self.r);r["executable_sql_generated"]=True
        with self.assertRaises(ValueError):check(r,self.b36,self.a,self.b)
if __name__=="__main__":unittest.main()
