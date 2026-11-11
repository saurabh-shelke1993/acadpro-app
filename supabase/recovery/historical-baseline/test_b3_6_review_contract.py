"""Pure B3.6 fail-closed review tests; no migration SQL or database connection."""
import copy
from pathlib import Path
import unittest
from b3_6_review_contract import load,inspect,validate,N,P,C,S
ROOT=Path(__file__).resolve().parents[3]
class TestB36(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a=load(ROOT,N);cls.b=load(ROOT,P);cls.c=load(ROOT,C);cls.d=load(ROOT,S)
    def check(self,a=None,b=None):
        return inspect(a if a is not None else self.a,b if b is not None else self.b,self.c,self.d)
    def test_plan_valid_blocked(self):
        self.assertEqual(validate(ROOT)["planned_tests"],35)
        self.assertIs(validate(ROOT)["replay_approved"],False)
    def test_approval_block(self):
        x=copy.deepcopy(self.a);x["guards"]["ready_for_production"]=True
        with self.assertRaises(ValueError):self.check(x)
    def test_live_write_block(self):
        x=copy.deepcopy(self.a);x["prohibitions"]["live_data_changed"]=True
        with self.assertRaises(ValueError):self.check(x)
    def test_original_missing(self):
        x=copy.deepcopy(self.a);x["ordered_versions"].pop()
        with self.assertRaises(ValueError):self.check(x)
    def test_source_drift(self):
        x=copy.deepcopy(self.a);x["ordered_versions"][0]["source_match"]="byte-exact"
        with self.assertRaises(ValueError):self.check(x)
    def test_quarantine_approval(self):
        x=copy.deepcopy(self.a);x["quarantine_decisions"][0]["approved"]=True
        with self.assertRaises(ValueError):self.check(x)
    def test_historical_helper_timing(self):
        x=copy.deepcopy(self.a);x["dependency_anchors"]["parents_user_id"]="20260908062059"
        with self.assertRaises(ValueError):self.check(x)
    def test_negative_test_missing(self):
        x=copy.deepcopy(self.a);x["negative_test_matrix"].pop()
        with self.assertRaises(ValueError):self.check(x)
    def test_tests_not_falsely_passed(self):
        x=copy.deepcopy(self.a);x["negative_test_matrix"][0]["passed"]=True
        with self.assertRaises(ValueError):self.check(x)
    def test_statement_count_drift(self):
        x=copy.deepcopy(self.b);x["remote_rows"][0]["remote_statement_count"]+=1
        with self.assertRaises(ValueError):self.check(b=x)
    def test_no_embedded_original_sql(self):
        import json,re
        s=json.dumps(self.a)
        self.assertNotIn("CREATE TABLE public.",s)
        self.assertNotIn("UPDATE public.",s)
        self.assertIsNone(re.search(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",s,re.I))
if __name__=="__main__":unittest.main()
