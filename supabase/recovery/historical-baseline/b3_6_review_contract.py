#!/usr/bin/env python3
"""Fail-closed B3.6 metadata validator; does not execute SQL or access any database."""
import json
from pathlib import Path
import sys

D=Path("supabase/recovery/historical-baseline")
N=D/"b3_6_disposable_plan_20261111.json"
P=D/"parity-fingerprints-readonly-20261109.json"
C=D/"b3_5c_technical_dispositions_20261111.json"
S=D/"b3_2_six_divergences_review_20261111.json"

def load(root,path):
    return json.loads((Path(root)/path).read_text(encoding="utf-8"))

def inspect(a,b,c,d):
    if a.get("schema")!="kheltriva-b3-6-review-only-v1" or a.get("mode")!="NON_EXECUTABLE_NO_DB_OR_SQL":
        raise ValueError("Executable mode prohibited")
    if any(x.get("project_id")!=a.get("project_id") for x in (b,c,d)):
        raise ValueError("Project drift")
    if any(v is not False for v in a["guards"].values()) or any(
            v is not False for v in a["prohibitions"].values()):
        raise ValueError("Unexpected approval")
    hist=a["ordered_versions"];src=b["remote_rows"];old=c["cases"]
    if len(hist)!=82 or len(src)!=82 or len(old)!=14 or len(a["quarantine_decisions"])!=14:
        raise ValueError("Migration coverage drift")
    if a["source_version_count"]!=82 or a["source_element_count"]!=168 or sum(
            r["remote_statement_count"] for r in src)!=168:
        raise ValueError("Historical statement count drift")
    risks={x["version"]:x for x in old}
    for x,r in zip(hist,src):
        if (x["version"]!=r["remote_version"] or x["elements"]!=r["remote_statement_count"]
                or x["source_match"]!=r["content_status"] or
                x["quarantined"] is not (x["version"] in risks) or x["approved"] is not False):
            raise ValueError("Version/order/source approval drift")
    if len({x["version"] for x in hist})!=82:
        raise ValueError("Duplicate version")
    if (a["source_counts"]!={"strict_links":25,"divergent":6,"no_content_match":51}
            or b["summary"]["total_strict_content_links"]!=25 or
            b["summary"]["same_version_content_divergence"]!=6 or
            b["summary"]["no_content_match"]!=51):
        raise ValueError("Source classification drift")
    if len(a["source_divergences"])!=6 or [
            (x["version"],x["category"]) for x in a["source_divergences"]] != [
            (x["version"],x["review_category"]) for x in d["cases"]]:
        raise ValueError("Divergence drift")
    if any(x["approved"] is not False for x in a["source_divergences"]):
        raise ValueError("Divergence approved without evidence")
    if [x["version"] for x in a["quarantine_decisions"]] != [x["version"] for x in old]:
        raise ValueError("Quarantine coverage drift")
    for x in a["quarantine_decisions"]:
        y=risks[x["version"]]
        if (x["data_action"]!=y["data_disposition"] or
                x["ddl_security_action"]!=y["essential_schema_security_disposition"] or
                x["approved"] is not False):
            raise ValueError("Quarantine approval drift")
    expected={"base":"20260823093317","first_helper_reference":"20260903173804",
              "historical_parent_helper":"20260908062059","parents_user_id":"20260912142706",
              "financial_foundation":"20260926081053","generated_column_fix":"20260926094904",
              "financial_role_restriction":"20260926111113","local_duplicate":"20260926133000",
              "local_irregular":"202610210001"}
    if a["dependency_anchors"]!=expected:
        raise ValueError("Chronology drift")
    stages=a["ordered_stages"]
    if len(stages)!=9 or [x["position"] for x in stages]!=list(range(1,10)) or any(
            x["status"]!="PENDING" or x["executed"] is not False or x["approved"] is not False
            for x in stages):
        raise ValueError("Stage prematurely executed")
    tests=a["negative_test_matrix"]
    if len(tests)!=35 or len({x["id"] for x in tests})!=35:
        raise ValueError("Negative test coverage drift")
    if {x["domain"] for x in tests}!={"AUTH","RBAC","STORAGE","FINANCE",
            "PARENT_INTEGRITY","PLAYER_MAPPING","ATTENDANCE","ENQUIRIES"}:
        raise ValueError("Test domains missing")
    if not {"parent","coach","academy_owner","super_admin","anonymous"}.issubset(
            {x["principal"] for x in tests}):
        raise ValueError("Test roles missing")
    if not {"DENY","DENY_ROLLBACK","ROLLBACK_ALL"}.issubset(
            {x["expected"] for x in tests}):
        raise ValueError("Negative tests missing")
    if any(x["status"]!="NOT_RUN" or x["passed"] is not False for x in tests):
        raise ValueError("Test falsely passed")
    if c["ready_for_disposable_replay"] is not False:
        raise ValueError("Prior B3.5C gate invalid")
    return {"historical_versions":82,"quarantines":14,"planned_tests":35,
            "executed_tests":0,"replay_approved":False}

def validate(root):
    return inspect(load(root,N),load(root,P),load(root,C),load(root,S))

if __name__=="__main__":
    try:
        print(json.dumps(validate(Path(sys.argv[1] if len(sys.argv)>1 else ".")),indent=2))
    except (OSError,KeyError,ValueError,TypeError,json.JSONDecodeError) as e:
        print("B3.6 blocked: "+str(e),file=sys.stderr)
        sys.exit(1)
