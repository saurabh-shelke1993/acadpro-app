#!/usr/bin/env python3
"""AG3.4D offline, read-only *catalog snapshot* integrity audit.

No database/network connections; does not certify RPC/Storage authorization.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys

INVENTORY=Path(__file__).resolve().parents[2]/"supabase/tests/security/ag34d_live_rpc_storage_inventory.json"
PUBLIC_BUCKETS={"academy-logos","academy-upi-qr","coach-photos"}
PRIVATE_BUCKET="player-photos"
EXPECTED_RPCS={
    "approve_payment_correction","collect_payment","create_inquiry",
    "delete_inquiry","get_parent_child_coaches","get_parent_coach_profiles",
    "record_accepted_parent_upi_submission","record_inquiry_conversion",
    "reject_payment_correction","request_payment_correction",
    "review_parent_upi_payment","submit_parent_upi_payment",
    "update_inquiry","update_my_coach_profile"
}

class InventoryError(Exception):
    """No credentials or response bodies in errors."""


def review(snapshot: dict) -> list[tuple[str,str]]:
    if snapshot.get("project_id")!="ulyealhkmlorsbdiknrh":
        raise InventoryError("Snapshot project identity changed")
    if snapshot.get("environment")!="hosted-read-only-inventory":
        raise InventoryError("Non-read-only source label")
    if snapshot.get("snapshot_date")!="2026-11-11":
        raise InventoryError("Unapproved observation date")
    rpcs=snapshot.get("security_definer_rpcs")
    storage=snapshot.get("storage_object_policies")
    buckets=snapshot.get("storage_buckets")
    if not isinstance(rpcs,list) or len(rpcs)!=14:
        raise InventoryError("Must inventory exactly 14 observed RPCs")
    if not isinstance(storage,list) or len(storage)!=16:
        raise InventoryError("Expected 16 observed Storage object policies")
    if not isinstance(buckets,list) or len(buckets)!=4:
        raise InventoryError("Expected four observed buckets")
    names={r["signature"].split("(",1)[0] for r in rpcs}
    if names!=EXPECTED_RPCS:
        raise InventoryError("Public SECURITY DEFINER inventory has drifted")
    if len({r["signature"] for r in rpcs})!=14:
        raise InventoryError("Duplicate function signature")
    for fn in rpcs:
        digest=fn.get("definition_md5","")
        if not isinstance(digest,str) or len(digest)!=32 or any(c not in "0123456789abcdef" for c in digest):
            raise InventoryError("Invalid function definition fingerprint")
        if fn.get("security_definer") is not True:
            raise InventoryError("Unexpected function definer mode")
        if fn.get("config")!='search_path=""':
            raise InventoryError("Unreviewed function search_path")
        if fn.get("authenticated_exec") is not True:
            raise InventoryError("Expected authenticated RPC grant changed")
        if fn.get("anon_exec") is not False:
            raise InventoryError("Anonymous function execution exposed")
        if not any(fn.get(x) for x in ("checks_role_helper","checks_parent_helper","uses_auth_uid")):
            raise InventoryError("Function lacks source-derived identity helper hint")
    table={row["id"]:row for row in buckets}
    if set(table)!=PUBLIC_BUCKETS|{PRIVATE_BUCKET}:
        raise InventoryError("Unreviewed Storage bucket added/removed")
    if any(table[b]["public_read"] is not True for b in PUBLIC_BUCKETS):
        raise InventoryError("Observed public bucket posture changed")
    if table[PRIVATE_BUCKET]["public_read"] is not False:
        raise InventoryError("Player photo private bucket became public")
    for b in buckets:
        if b.get("file_size_limit")!=2097152:
            raise InventoryError("File-size limit drift")
    names={p["policyname"] for p in storage}
    if len(names)!=16 or any(p.get("tablename")!="objects" for p in storage):
        raise InventoryError("Duplicate or unknown Storage policy")
    for p in storage:
        digest=p.get("predicate_md5","")
        if not isinstance(digest,str) or len(digest)!=32 or any(c not in "0123456789abcdef" for c in digest):
            raise InventoryError("Invalid Storage policy fingerprint")
        if p.get("roles")=="{public}":
            if p["cmd"]!="SELECT" or not p["policyname"].endswith("_public_read"):
                raise InventoryError("Public Storage write or unexpected public policy")
    for label in ("academy_logos_public_read","academy_upi_qr_public_read",
                  "coach_photos_public_read"):
        if label not in names:
            raise InventoryError("Intended public-read policy disappeared")
    if any(p["roles"]=="{public}" and "player_photos" in p["policyname"] for p in storage):
        raise InventoryError("Private player photos have public policy")
    if snapshot.get("live_migration_count")!=82 or snapshot.get("repo_migration_file_count")!=40:
        raise InventoryError("Historical migration discrepancy record changed")
    if snapshot.get("matching_version_prefixes")!=23:
        raise InventoryError("Migration provenance record changed")
    return [
        ("14 authenticated-callable DEFINER RPC fingerprints and grants","AUDITED"),
        ("Empty search_path and no anonymous EXEC on those 14 RPCs","AUDITED"),
        ("16 Storage policy digests and 4 bucket flags","AUDITED"),
        ("Player photo bucket private; public-read only approved buckets","AUDITED"),
        ("82 live / 40 repository migrations; 23 matching version prefixes","BLOCKED"),
        ("Actual RPC mutation/tenant denial with real JWTs","NOT TESTED"),
        ("Storage HTTP/signed URL/upload authorization with real JWTs","NOT TESTED")
    ]


def render(rows: list[tuple[str,str]],good: bool)->str:
    lines=["## AG3.4D — RPC/Storage catalog snapshot integrity",
           "", "**Static inventory: "+("PASS" if good else "FAIL")+"**", "",
           "| Area | Status |","| --- | --- |"]
    lines.extend("| "+name+" | "+status+" |" for name,status in rows)
    lines+=["","**IMPORTANT:** A static catalog snapshot is neither an executed",
            "multi-tenant RPC negative test nor an authenticated Storage API test.",
            "14 exposed SECURITY DEFINER RPCs remain to be dynamically verified.",
            "No migration replay, hosted mutation, production policy deployment",
            "or billing enablement was performed. Full AG3.4E release: NO-GO.", ""]
    return "\n".join(lines)


def main()->int:
    try:
        data=json.loads(INVENTORY.read_text(encoding="utf-8"))
        result=render(review(data),True)
        success=True
    except (OSError,ValueError,KeyError,TypeError,InventoryError):
        result=render([("Inventory integrity","FAIL")],False)
        success=False
    file=os.environ.get("GITHUB_STEP_SUMMARY")
    if file:
        with open(file,"a",encoding="utf-8") as out:
            out.write(result)
    else:
        print(result)
    print("AG3.4D STATIC INVENTORY "+("PASS" if success else "FAIL")+
          ": no external database/storage testing",flush=True)
    return 0 if success else 1


if __name__=="__main__":
    sys.exit(main())
