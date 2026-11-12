#!/usr/bin/env python3
"""AG3.4D3.2: source-attested correction RPCs against genuine disposable GoTrue JWTs.

Runs AFTER C2, D1 and D3.1 pass in the SAME scratch instance.
Original-source cross-academy bypass MUST be reproduced; candidate MUST close it.
Never call hosted Supabase, deploy migrations or touch customer payments.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import ag2_real_auth_ci as ag2
import ag3_real_jwt_rls_ci as ag3
import ag3_4b_live_mapping_ci as ag34b
import ag3_4c2_live_parent_policy_ci as c2
import ag3_4d_finance_jwt_ci as d1
import ag3_4d3_collect_payment_jwt_ci as d31

PROJECT = c2.PROJECT
CONTAINER = c2.CONTAINER
FIXTURES = Path(__file__).resolve().parents[2] / "supabase/tests/security"
SOURCE_SQL = "ag34d32_live_correction_rpcs_scratch.sql"
FIX_SQL = "ag34d32_correction_null_role_scratch_candidate.sql"
API_FUNCS = ("request_payment_correction", "approve_payment_correction",
             "reject_payment_correction")
DUE_A1, DUE_A2, DUE_B = d1.DUE_IDS
DUE_RACE = d31.DUE_RACE
ROLE_ERROR = {
    "request_payment_correction": "Only Academy Owner or Super Admin can request payment corrections",
    "approve_payment_correction": "Only Academy Owner or Super Admin can approve corrections",
    "reject_payment_correction": "Only Academy Owner or Super Admin can reject corrections",
}

class CorrectionFailure(Exception):
    pass

def is_uuid(s: str) -> bool:
    return bool(re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", s))

def rpc(key: str, token: str | None, function: str, payload: dict) -> tuple[int, object]:
    if function not in API_FUNCS:
        raise ValueError("Unapproved RPC target")
    req = Request(ag3.API_URL + "/rest/v1/rpc/" + function,
                  data=json.dumps(payload).encode(), method="POST",
                  headers={"apikey": key, "Accept": "application/json",
                           "Content-Type": "application/json",
                           **({"Authorization":"Bearer "+token} if token is not None else {})})
    try:
        with urlopen(req, timeout=30) as resp:
            raw=resp.read()
            return resp.status, json.loads(raw) if raw else None
    except HTTPError as err:
        try:
            body=json.loads(err.read())
        except (ValueError,TypeError):
            body={}
        return err.code, body if isinstance(body,dict) else {}
    except (URLError,TimeoutError):
        raise CorrectionFailure("Disposable PostgREST unavailable") from None

def request_args(payment_id: str, amount: int, reason: str = "AG34D32 synthetic reason") -> dict:
    return {"p_payment_id": payment_id, "p_corrected_amount": amount, "p_reason": reason}

def approve_args(correction_id: str) -> dict:
    return {"p_correction_id": correction_id}

def reject_args(correction_id: str) -> dict:
    return {"p_correction_id": correction_id, "p_rejection_reason": "AG34D32 synthetic rejection"}

def snapshot() -> str:
    """Exact invented ledger state and counters; no live customer information."""
    return d1.sql("-At","-c", """
    SELECT coalesce((SELECT string_agg(id::text||':'||paid_amount::text||':'||due_status,';' ORDER BY id)
                     FROM public.payment_dues),'')
    || '|' || (SELECT count(*) FROM public.payments)::text
    || '|' || (SELECT coalesce(sum(next_value),0) FROM public.payment_number_counters)::text
    || '|' || coalesce((SELECT string_agg(id::text||':'||status||':'||adjustment_amount::text,';' ORDER BY id)
                       FROM public.payment_corrections),'');
    """)

def payment_id(due: str, amount: int) -> str:
    rows=d1.sql("-At","-c",
                "SELECT id::text FROM public.payments WHERE due_id='"+
                due+"'::uuid AND payment_entry_type='payment' AND amount_paid="+
                str(amount)+" ORDER BY id LIMIT 1")
    if not is_uuid(rows):
        raise CorrectionFailure("Expected synthetic original payment missing")
    return rows

def correction_row(correction_id: str) -> str:
    if not is_uuid(correction_id):
        raise CorrectionFailure("Malformed synthetic correction ID")
    return d1.sql("-At","-c", "SELECT status||'|'||adjustment_amount::text "
                  "FROM public.payment_corrections WHERE id='"+correction_id+"'::uuid")

def seed_pending(payment: str, amount: int, requester: str) -> str:
    if not is_uuid(payment) or not is_uuid(requester):
        raise CorrectionFailure("Invalid synthetic fixture UUID")
    output=d1.sql("-At","-c",
                  "INSERT INTO public.payment_corrections (payment_id,due_id,player_id,"
                  "original_amount,corrected_amount,adjustment_amount,reason,status,requested_by) "
                  "SELECT p.id,p.due_id,p.player_id,p.amount_paid,"+str(amount)+
                  ","+str(amount)+"-p.amount_paid,'AG34D32 seeded pending',"
                  "'pending','"+requester+"'::uuid FROM public.payments p "
                  "WHERE p.id='"+payment+"'::uuid RETURNING id::text")
    candidate=output.splitlines()[0] if output else ""
    if not is_uuid(candidate):
        raise CorrectionFailure("Failed to stage scratch-only correction target")
    return candidate

def allow_request(key: str,token: str,payment: str,amount: int) -> str:
    code,body=rpc(key,token,"request_payment_correction",request_args(payment,amount))
    if (code!=200 or not isinstance(body,dict) or not is_uuid(str(body.get("id","")))
        or body.get("status")!="pending" or body.get("payment_id")!=payment
        or int(body.get("corrected_amount",-1))!=amount):
        raise CorrectionFailure("Authorized correction request did not match contract")
    return body["id"]

def allow_approve(key: str,token: str,correction: str,amount: int,status: str,
                  due: str) -> None:
    code,body=rpc(key,token,"approve_payment_correction",approve_args(correction))
    if code!=200 or not isinstance(body,list) or len(body)!=1:
        raise CorrectionFailure("Authorized approval RPC returned unexpected contract")
    row=body[0]
    if (row.get("correction_id")!=correction
        or int(row.get("adjustment_amount",999999))!=amount
        or row.get("due_status")!=status
        or not is_uuid(str(row.get("adjustment_payment_id","")))
        or not str(row.get("transaction_reference","")).startswith("TXN-")
        or not str(row.get("receipt_number","")).startswith("RCPT-")):
        raise CorrectionFailure("Approval receipt or ledger contract violated")
    if correction_row(correction).split("|")[0]!="approved":
        raise CorrectionFailure("Approved correction status not persisted")
    if d1.sql("-At","-c","SELECT count(*) FROM public.payments WHERE "
              "id='"+row["adjustment_payment_id"]+"'::uuid AND due_id='"+
              due+"'::uuid AND payment_entry_type='adjustment'")!="1":
        raise CorrectionFailure("Approved correction adjustment missing")

def allow_reject(key: str,token: str,correction: str) -> None:
    code,body=rpc(key,token,"reject_payment_correction",reject_args(correction))
    if (code!=200 or not isinstance(body,dict) or body.get("id")!=correction
        or body.get("status")!="rejected" or correction_row(correction).split("|")[0]!="rejected"):
        raise CorrectionFailure("Authorized correction rejection not persisted")

def deny(key: str,token: str,fn: str,args: dict,expected: str) -> None:
    before=snapshot()
    code,body=rpc(key,token,fn,args)
    if code not in (400,401,403) or not isinstance(body,dict):
        raise CorrectionFailure("Correction denial did not reach expected response")
    if expected not in str(body.get("message","")):
        raise CorrectionFailure("Correction denial did not reach expected role/tenant guard")
    if snapshot()!=before:
        raise CorrectionFailure("Rejected correction RPC mutated ledger/counters/status")

def assert_due(due: str,amount: int,status: str) -> None:
    if d31.due_state(due)!=f"{amount}|{status}":
        raise CorrectionFailure("Payment due diverged from expected correction accounting")

def must_be_disposable() -> str:
    root=Path(os.environ.get("RUNNER_TEMP","/not-github-actions"))/PROJECT
    if (os.environ.get("GITHUB_ACTIONS")!="true"
        or os.environ.get("GITHUB_REPOSITORY")!="saurabh-shelke1993/acadpro-app"
        or os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_DB_URL")
        or Path.cwd().resolve()!=root.resolve()
        or not (root/"supabase/config.toml").is_file()
        or (root/"supabase/migrations").exists()
        or (root/"supabase/.temp/project-ref").exists()
        or d1.sql("-At","-c","SELECT count(*) FROM auth.users")!="23"
        or d1.sql("-At","-c","SELECT count(*) FROM public.users")!="21"
        or d1.sql("-At","-c","SELECT count(*) FROM public.payment_dues")!="5"
        or d1.sql("-At","-c","SELECT count(*) FROM pg_proc p JOIN pg_namespace n "
                  "ON p.pronamespace=n.oid WHERE n.nspname='private'")!="20"
        or d1.sql("-At","-c","SELECT to_regclass('public.payment_corrections') IS NULL")!="t"
        or any(not (FIXTURES/name).is_file() for name in (SOURCE_SQL,FIX_SQL))):
        raise CorrectionFailure("Refusing non-disposable or incomplete original D3.1 context")
    cmd=subprocess.run(["supabase","status","-o","env"],
                       text=True,capture_output=True,timeout=30,check=False)
    if cmd.returncode:
        raise CorrectionFailure("Scratch native Supabase not ready")
    return ag2.local_status(cmd.stdout)

def main() -> int:
    stage="disposable preflight"
    ag34b.CONTAINER=CONTAINER
    try:
        key=must_be_disposable()
        stage="new GoTrue signed correction identities"
        labels=("owner-a","owner-b","coach","parent","super-admin","unmapped")
        users={name:ag3.signup_with_token(key,"ag34d32-"+name) for name in labels}
        if len({v[0] for v in users.values()})!=6:
            raise CorrectionFailure("Duplicate Auth UUIDs in fixture")
        stage="recreate three original deployed correction functions in scratch"
        ag34b.safe(["docker","cp",str(FIXTURES/SOURCE_SQL),CONTAINER+":/tmp/"+SOURCE_SQL])
        extra=[]
        for label,prefix in (("owner-a","owner_a"),("owner-b","owner_b"),
                             ("coach","coach"),("parent","parent"),("super-admin","super_admin")):
            extra+=["-v",prefix+"_uuid="+users[label][0]]
        d1.sql("--single-transaction",*extra,"-f","/tmp/"+SOURCE_SQL,
               marker="AG3.4D3.2 ORIGINAL CORRECTION RPCS SOURCE MATCHED IN SCRATCH")
        if d1.sql("-At","-c","SELECT count(*) FROM auth.users")!="29":
            raise CorrectionFailure("Original RPC fixture role count changed")
        tokens={name:v[1] for name,v in users.items()}
        print("AG3.4D3.2 PASS: deployed correction request/approve/reject source hashes and ACLs",flush=True)

        stage="PostgREST schema cache detects deployed correction signatures"
        a1=payment_id(DUE_A1,40)
        a2=payment_id(DUE_A2,100)
        b=payment_id(DUE_B,80)
        race=payment_id(DUE_RACE,70)
        ready=False
        for _ in range(26):
            code,body=rpc(key,tokens["owner-a"],"request_payment_correction",
                          request_args(a1,0))
            if (code==400 and isinstance(body,dict)
                and "Corrected amount must be greater than zero" in str(body.get("message",""))):
                ready=True
                break
            time.sleep(0.5)
        if not ready:
            raise CorrectionFailure("Original deployed RPC did not expose expected validation guard")

        stage="original source UNMAPPED JWT foreign-academy correction request"
        before=snapshot()
        code,body=rpc(key,tokens["unmapped"],"request_payment_correction",request_args(b,70))
        if (code!=200 or not isinstance(body,dict) or body.get("payment_id")!=b
            or body.get("status")!="pending" or not is_uuid(str(body.get("id","")))):
            raise CorrectionFailure("Expected original-source unmapped correction request not reproduced")
        original_id=body["id"]
        if snapshot()==before or correction_row(original_id)!="pending|-10":
            raise CorrectionFailure("Original-source unauthorized correction record was not inserted")
        print("AG34-HIGH-002 D3.2 REPRODUCED: unmapped signed JWT requested foreign correction",flush=True)

        stage="original source UNMAPPED JWT foreign-academy correction approval"
        code,body=rpc(key,tokens["unmapped"],"approve_payment_correction",approve_args(original_id))
        if code!=200 or not isinstance(body,list) or len(body)!=1:
            raise CorrectionFailure("Original-source correction approval bypass not reproduced")
        if (body[0].get("correction_id")!=original_id
            or correction_row(original_id)!="approved|-10"):
            raise CorrectionFailure("Unauthorized correction approval not recorded")
        assert_due(DUE_B,70,"partial")
        print("AG34-HIGH-002 D3.2 REPRODUCED: unmapped signed JWT approved foreign adjustment",flush=True)

        stage="original source UNMAPPED JWT foreign-academy correction rejection"
        reject_target=seed_pending(a2,90,users["owner-a"][0])
        code,body=rpc(key,tokens["unmapped"],"reject_payment_correction",
                      reject_args(reject_target))
        if (code!=200 or not isinstance(body,dict) or body.get("status")!="rejected"
            or correction_row(reject_target)!="rejected|-10"):
            raise CorrectionFailure("Original-source unauthorized rejection not reproduced")
        assert_due(DUE_A2,100,"paid")
        print("AG34-HIGH-002 D3.2 REPRODUCED: unmapped signed JWT rejected foreign correction",flush=True)

        stage="install scratch-only explicit NULL rejection in three correction functions"
        ag34b.safe(["docker","cp",str(FIXTURES/FIX_SQL),CONTAINER+":/tmp/"+FIX_SQL])
        d1.sql("--single-transaction","-f","/tmp/"+FIX_SQL,
               marker="AG34-HIGH-002 SCRATCH CORRECTION NULL ROLE CANDIDATE INSTALLED")
        print("AG3.4D3.2 PASS: scratch-only 3-function NULL-role candidate installed",flush=True)

        stage="negative role and foreign-tenant JWT correction regressions"
        for role in ("coach","parent","unmapped"):
            deny(key,tokens[role],"request_payment_correction",request_args(a1,30),
                 ROLE_ERROR["request_payment_correction"])
        deny(key,tokens["owner-b"],"request_payment_correction",request_args(a1,30),
             "You are not authorized to correct this payment")
        neg_approve=seed_pending(a2,95,users["owner-a"][0])
        neg_reject=seed_pending(b,75,users["owner-b"][0])
        for role in ("coach","parent","unmapped"):
            deny(key,tokens[role],"approve_payment_correction",approve_args(neg_approve),
                 ROLE_ERROR["approve_payment_correction"])
            deny(key,tokens[role],"reject_payment_correction",reject_args(neg_reject),
                 ROLE_ERROR["reject_payment_correction"])
        deny(key,tokens["owner-b"],"approve_payment_correction",approve_args(neg_approve),
             "You are not authorized to approve this correction")
        deny(key,tokens["owner-a"],"reject_payment_correction",reject_args(neg_reject),
             "You are not authorized to reject this correction")
        print("AG3.4D3.2 PASS: exact candidate blocks unmapped/Coach/Parent and foreign academy",flush=True)

        stage="anon and malformed bearer RPC denial"
        for fn,args in (("request_payment_correction",request_args(a1,30)),
                        ("approve_payment_correction",approve_args(neg_approve)),
                        ("reject_payment_correction",reject_args(neg_reject))):
            for token in (None,"invalid.ag34d32.signed.jwt"):
                code,_=rpc(key,token,fn,args)
                if code not in (401,403,404):
                    raise CorrectionFailure("Anon/forged bearer correction RPC unexpectedly accepted")
        print("AG3.4D3.2 PASS: anonymous and forged bearer denied on three functions",flush=True)

        stage="positive legitimate Owner/SA approval and rejection, duplicate pending prevention"
        before=snapshot()
        first=allow_request(key,tokens["owner-a"],a1,35)
        deny(key,tokens["owner-a"],"request_payment_correction",request_args(a1,30),
             "A correction is already pending")
        allow_reject(key,tokens["owner-a"],first)
        assert_due(DUE_A1,100,"paid")
        second=allow_request(key,tokens["owner-a"],a1,30)
        allow_approve(key,tokens["owner-a"],second,-10,"partial",DUE_A1)
        assert_due(DUE_A1,90,"partial")
        allow_approve(key,tokens["super-admin"],neg_approve,-5,"partial",DUE_A2)
        assert_due(DUE_A2,95,"partial")
        allow_reject(key,tokens["owner-b"],neg_reject)
        assert_due(DUE_B,70,"partial")
        print("AG3.4D3.2 PASS: Owner and SA approvals, duplicate pending denial, ledger and status",flush=True)

        stage="invalid adjustment negative/overpay rollbacks"
        too_low=allow_request(key,tokens["owner-b"],b,1)
        deny(key,tokens["owner-b"],"approve_payment_correction",approve_args(too_low),
             "Correction would make paid amount negative")
        allow_reject(key,tokens["owner-b"],too_low)
        too_high=allow_request(key,tokens["owner-b"],b,200)
        deny(key,tokens["owner-b"],"approve_payment_correction",approve_args(too_high),
             "Correction would overpay the payment due")
        allow_reject(key,tokens["owner-b"],too_high)
        assert_due(DUE_B,70,"partial")
        print("AG3.4D3.2 PASS: negative due and overpay correction invariants, no side effects",flush=True)

        stage="forced adjustment INSERT failure after sequence increments"
        late=allow_request(key,tokens["owner-a"],race,65)
        d1.sql("-c","UPDATE public.ag34d32_fault_switch SET enabled=true")
        try:
            deny(key,tokens["owner-a"],"approve_payment_correction",approve_args(late),
                 "AG34D32 synthetic adjustment rollback")
            assert_due(DUE_RACE,70,"partial")
        finally:
            d1.sql("-c","UPDATE public.ag34d32_fault_switch SET enabled=false")
        allow_approve(key,tokens["owner-a"],late,-5,"partial",DUE_RACE)
        assert_due(DUE_RACE,65,"partial")
        print("AG3.4D3.2 PASS: late transaction failure reverted counters, ledger, pending status",flush=True)

        if d1.sql("-At","-c","SELECT count(*) FROM auth.users")!="29":
            raise CorrectionFailure("Disposable identity postflight drift")
        print("AG3.4D3.2 LIMIT: all 3 original correction RPCs reproduced and scratch candidate tested; NOT deployed; UPI/other RPCs and Storage pending",flush=True)
        return 0
    except (CorrectionFailure,d31.RpcFailure,d1.FinanceFailure,
            ag34b.SecurityMismatch,ag3.Ag3Failure,ag2.Ag2Error,
            ValueError,KeyError,TypeError,OSError,subprocess.TimeoutExpired):
        print("AG3.4D3.2 FAIL at: "+stage+"; JWTs and database response bodies withheld",flush=True)
        return 1

if __name__=="__main__":
    sys.exit(main())
