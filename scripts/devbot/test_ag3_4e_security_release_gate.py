"""Fail-closed AG3.4E release gating tests. No external systems used."""
from __future__ import annotations
import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import ag3_4e_security_release_gate as gate

class ReleaseGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads(gate.LEDGER.read_text(encoding="utf-8"))

    def test_default_is_no_go_with_known_high_risk(self):
        decision,reasons=gate.evaluate(copy.deepcopy(self.data))
        self.assertEqual(decision,"NO_GO")
        self.assertIn("AG34-HIGH-001",reasons)
        self.assertIn("coach_mapping_production_policy_remediation_verified",reasons)

    def test_complete_release_checklist_is_required(self):
        d=copy.deepcopy(self.data)
        del d["production_release_requirements"]["all_14_authenticated_rpc_negative_jwt_mutation_invariant_tests"]
        with self.assertRaises(gate.GateContractError):
            gate.evaluate(d)

    def test_release_evidence_checks_are_boolean_not_strings(self):
        d=copy.deepcopy(self.data)
        d["production_release_requirements"]["all_16_storage_policy_object_level_auth_tests"]="PASS"
        with self.assertRaises(gate.GateContractError):
            gate.evaluate(d)

    def test_open_high_risk_blocks_even_when_checklist_green(self):
        d=copy.deepcopy(self.data)
        for name in d["production_release_requirements"]:
            d["production_release_requirements"][name]=True
        decision,reasons=gate.evaluate(d)
        self.assertEqual(decision,"NO_GO")
        self.assertIn("AG34-HIGH-001",reasons)

    def test_no_automatic_go_from_editing_blockers_to_resolved(self):
        d=copy.deepcopy(self.data)
        for n in d["production_release_requirements"]:
            d["production_release_requirements"][n]=True
        for f in d["blocking_findings"]:
            f["status"]="resolved"
        d["production_decision"]="GO"
        with self.assertRaises(gate.GateContractError):
            gate.evaluate(d)

    def test_missing_high_blocker_is_rejected(self):
        d=copy.deepcopy(self.data)
        d["blocking_findings"]=[f for f in d["blocking_findings"] if f["id"]!="AG34-HIGH-001"]
        with self.assertRaises(gate.GateContractError):
            gate.evaluate(d)

    def test_all_phases_must_be_present(self):
        d=copy.deepcopy(self.data)
        d["last_verified_phase_evidence"].pop()
        with self.assertRaises(gate.GateContractError):
            gate.evaluate(d)

    def test_standing_approval_does_not_touch_main(self):
        self.assertEqual(self.data["target_branch"],"payment-module-finalization")
        self.assertEqual(self.data["production_branch"],"main")
        self.assertIn("Does not authorize hosted Supabase",
                      self.data["product_owner_instruction"])
        self.assertNotIn("GO",self.data["dev_pr_merge_status"][:2])

    def test_expect_no_go_validation_passes(self):
        self.assertEqual(gate.main(["--check-no-go"]),0)

    def test_require_production_go_rejects_current_state(self):
        self.assertEqual(gate.main(["--require-production-go"]),2)


if __name__=="__main__":
    unittest.main()
