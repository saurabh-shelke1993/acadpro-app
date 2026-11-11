#!/usr/bin/env python3
"""AG3.4E: development-source security release evidence gate (offline, fail closed).

This is *not* a production deploy protection until independently wired into
a dedicated production workflow. Never treats merged PRs as release readiness.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys

LEDGER=Path(__file__).resolve().parents[2]/"frontend/docs/AG3_4E_SECURITY_RELEASE_GATE.json"
REQUIREMENTS={
    "coach_mapping_production_policy_remediation_verified",
    "production_authorization_policy_parity_full",
    "all_14_authenticated_rpc_negative_jwt_mutation_invariant_tests",
    "all_16_storage_policy_object_level_auth_tests",
    "82_migration_version_source_provenance_resolved",
    "B3_disposable_historical_replay_verified",
    "B4_billing_release_acceptance",
    "parent_owner_coach_super_admin_browser_manual_regression",
    "windows_C3_4B2_persistence_check",
    "production_deployment_and_rollback_plan_approved",
    "explicit_product_owner_production_release_approval",
    "frontend_all_jest_and_build_green",
}
REQUIRED_FINDINGS={
    "AG34-HIGH-001","AG34-GATE-002","AG34-GATE-003",
    "AG34-GATE-004","AG34-GATE-005","AG34-GATE-006",
}
REQUIRED_PHASES={"AG3.4A","AG3.4B","AG3.4C1","AG3.4C2","AG3.4D1","AG3.4D2"}

class GateContractError(ValueError):
    pass

def evaluate(data:dict)->tuple[str,list[str]]:
    if not isinstance(data,dict) or data.get("schema_version")!=1:
        raise GateContractError("Unknown security gate schema")
    if data.get("production_branch")!="main" or data.get("target_branch")!="payment-module-finalization":
        raise GateContractError("Unapproved branch routing")
    checks=data.get("production_release_requirements")
    if not isinstance(checks,dict) or set(checks)!=REQUIREMENTS:
        raise GateContractError("Incomplete security release checklist")
    if any(type(x) is not bool for x in checks.values()):
        raise GateContractError("Security requirements must be explicit booleans")
    findings=data.get("blocking_findings")
    if not isinstance(findings,list) or {f.get("id") for f in findings}!=REQUIRED_FINDINGS:
        raise GateContractError("A required known blocker was dropped")
    for finding in findings:
        if (finding.get("status") not in ("open","resolved")
            or finding.get("severity") not in ("HIGH","RELEASE_BLOCKER")
            or not isinstance(finding.get("subject"),str)
            or not isinstance(finding.get("mitigation"),str)):
            raise GateContractError("Malformed blocker or resolution")
    phases=data.get("last_verified_phase_evidence")
    if not isinstance(phases,list) or {p.get("phase") for p in phases}!=REQUIRED_PHASES:
        raise GateContractError("Required evidence phase missing")
    for phase in phases:
        if not str(phase.get("url","")).startswith("https://github.com/saurabh-shelke1993/acadpro-app"):
            raise GateContractError("Missing fixed-source phase evidence URL")
        if not isinstance(phase.get("state"),str) or not isinstance(phase.get("mode"),str):
            raise GateContractError("Evidence mode/state missing")
    failed=[name for name,passed in checks.items() if not passed]
    opened=[f["id"] for f in findings if f["status"]=="open"]
    # FAIL CLOSED: unresolved known HIGH risk or ANY missing hard release evidence
    # is a NO_GO. No 'override' switch or PR merge can substitute.
    result="NO_GO" if failed or opened else "GO_CANDIDATE_NEEDS_FRESH_OWNER_APPROVAL"
    if result=="GO_CANDIDATE_NEEDS_FRESH_OWNER_APPROVAL":
        # Never approve deployment solely from this repo JSON.
        result="NO_GO"
        opened.append("AG34-RELEASE-OWNER-MANUAL-GATE")
    if data.get("production_decision")!=result:
        raise GateContractError("Declared production decision disagrees with actual blockers")
    return result,sorted(failed)+sorted(opened)

def main(argv:list[str]|None=None)->int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--require-production-go",action="store_true",
                        help="Exit nonzero unless production release is actually approved")
    parser.add_argument("--check-no-go",action="store_true",
                        help="CI: ensure expected NO_GO decision is still enforced")
    args=parser.parse_args(argv)
    if args.require_production_go and args.check_no_go:
        parser.error("Specify one gate mode")
    try:
        data=json.loads(LEDGER.read_text(encoding="utf-8"))
        decision,reasons=evaluate(data)
    except (OSError,ValueError,TypeError,KeyError) as exc:
        print("AG3.4E FAIL: security evidence invalid or incomplete ("+
              type(exc).__name__+")")
        return 3
    print("AG3.4E PRODUCTION RELEASE: "+decision)
    print("AG3.4E open required controls: "+str(len(reasons)))
    for name in reasons:
        print("  "+name)
    print("AG3.4E development PR approval is NOT a hosted policy or production release approval")
    if args.require_production_go:
        return 2
    if args.check_no_go:
        return 0 if decision=="NO_GO" and len(reasons)>0 else 3
    return 0

if __name__=="__main__":
    sys.exit(main())
