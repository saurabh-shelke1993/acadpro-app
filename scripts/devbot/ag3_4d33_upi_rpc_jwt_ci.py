#!/usr/bin/env python3
"""AG3.4D3.3: real signed-JWT UPI submission/review/recording on disposable fixtures.

Requires C2/D1/D3.1/D3.2 in the SAME isolated native Supabase before this runner.
Original live sources and matching ACLs are installed before any test-only fixes.
No hosted Supabase, real claims, customer ledger or canonical migrations.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal
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
import ag3_4d32_correction_rpc_jwt_ci as d32

PROJECT = c2.PROJECT
CONTAINER = c2.CONTAINER
FIXTURES = Path(__file__).resolve().parents[2] / "supabase/tests/security"
SOURCE_SQL = "ag34d33_live_upi_rpcs_scratch.sql"
FIX_SQL = "ag34d33_null_role_scratch_candidate.sql"
RPCS = ("submit_parent_upi_payment", "review_parent_upi_payment",
        "record_accepted_parent_upi_submission")
DUE_A = "d2000000-0000-4000-8000-000000000031"
DUE_SECOND = "d2000000-0000-4000-8000-000000000032"
DUE_B = "d2000000-0000-4000-8000-000000000033"
DUE_STALE = "d2000000-0000-4000-8000-000000000034"
DUE_ROLLBACK = "d2000000-0000-4000-8000-000000000035"
DUE_RACE = "d2000000-0000-4000-8000-000000000036"
DUE_OTHER_PARENT = "d2000000-0000-4000-8000-000000000037"
DUE_B_REJECT = "d2000000-0000-4000-8000-000000000038"
REF_A = "AG34D33-PARENT-A"
REF_B = "AG34D33-PARENT-B"
SUBMIT_ERROR = "Only a parent can submit a UPI payment claim"
REVIEW_ERROR = "Only the Academy Owner can review UPI payment claims"
RECORD_ERROR = "Only the Academy Owner can record an accepted parent UPI claim"

class UpiFailure(Exception):
    pass

def uuid_ok(s: str) -> bool:
    return bool(re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", s))

def rpc(key: str, token: str | None, name: str, args: dict) -> tuple[int, object]:
    if name not in RPCS:
        raise ValueError("Unexpected UPI RPC name")
    headers = {"apikey":key, "Accept":"application/json",
               "Content-Type":"application/json"}
    if token is not None:
        headers["Authorization"] = "Bearer " + token
    req = Request(ag3.API_URL + "/rest/v1/rpc/" + name,
                  headers=headers, data=json.dumps(args).encode(), method="POST")
    try:
        with urlopen(req, timeout=30) as response:
            payload = response.read()
            return response.status, json.loads(payload) if payload else None
    except HTTPError as error:
        try:
            result = json.loads(error.read())
        except (ValueError, TypeError):
            result = {}
        return error.code, result if isinstance(result,dict) else {}
    except (URLError, TimeoutError):
        raise UpiFailure("Disposable PostgREST unavailable") from None

def submit_args(due: str, ref: str, amount: int = 30,
                *, payment_date: str | None = None) -> dict:
    return {"p_due_id":due, "p_amount":amount,
            "p_transaction_reference":ref,
            "p_payment_date": payment_date if payment_date is not None else date.today().isoformat(),
            "p_parent_note":"Invented CI-only claim"}

def review_args(claim: str, decision: str = "accepted", note: str = "Tested reference") -> dict:
    return {"p_submission_id":claim, "p_decision":decision, "p_review_note":note}

def record_args(claim: str) -> dict:
    return {"p_submission_id":claim}

def sqlscalar(expression: str) -> str:
    return d1.sql("-At","-c",expression)

def fingerprint(*, include_claims: bool = True) -> str:
    """Synthetic state only. Negative calls must not change ANY tracked rows/counters."""
    claim = """coalesce((SELECT string_agg(
          id::text||':'||status||':'||coalesce(payment_id::text,'')||':'||
          coalesce(reviewed_by_user_id::text,'')||':'||coalesce(recorded_by_user_id::text,''),
          ';' ORDER BY id) FROM public.parent_payment_submissions),'')"""
    due = """coalesce((SELECT string_agg(id::text||':'||paid_amount::text||':'||due_status,
          ';' ORDER BY id) FROM public.payment_dues),'')"""
    pay = """coalesce((SELECT string_agg(id::text||':'||coalesce(receipt_number,'')||':'||
          coalesce(external_transaction_reference,'')||':'||amount_paid::text,
          ';' ORDER BY id) FROM public.payments),'')"""
    counter = "(SELECT coalesce(sum(next_value),0)::text FROM public.payment_number_counters)"
    return sqlscalar("SELECT " + ("("+claim+")||'|'||" if include_claims else "")+
                     "("+due+")||'|'||("+pay+")||'|'||"+counter)

def claim_state(claim: str) -> str:
    if not uuid_ok(claim):
        raise UpiFailure("Invalid synthetic claim id")
    return sqlscalar("SELECT status||'|'||coalesce(payment_id::text,'') FROM "+
                     "public.parent_payment_submissions WHERE id='"+claim+"'::uuid")

def due_state(due: str) -> str:
    return d31.due_state(due)

def deny(key: str, token: str | None, name: str, args: dict, expected: str,
         *, statuses: tuple[int,...] = (400,401,403,409)) -> None:
    before = fingerprint()
    code, body = rpc(key,token,name,args)
    if code not in statuses or not isinstance(body,dict):
        raise UpiFailure("UPI negative RPC unexpectedly succeeded or returned unknown response")
    if expected not in str(body.get("message","")):
        raise UpiFailure("UPI denial failed to reach expected role, tenant or invariant")
    if fingerprint() != before:
        raise UpiFailure("UPI negative RPC mutated a claim, due, payment or counter")

def allow_submit(key: str, token: str, due: str, ref: str, amount: int = 30) -> str:
    before = fingerprint(include_claims=False)
    code, body = rpc(key,token,"submit_parent_upi_payment",submit_args(due,ref,amount))
    if (code!=200 or not isinstance(body,dict)
        or not uuid_ok(str(body.get("id","")))
        or body.get("due_id")!=due or body.get("status")!="pending"
        or Decimal(str(body.get("amount",0)))!=Decimal(amount)
        or body.get("transaction_reference")!=ref):
        raise UpiFailure("Legitimate Parent submission response/state differs")
    if before!=fingerprint(include_claims=False):
        raise UpiFailure("UPI submission unexpectedly modified financial ledger")
    return body["id"]

def allow_review(key: str, token: str, claim: str, decision: str,
                 *, note: str = "Reviewed synthetic UPI claim") -> None:
    before = fingerprint(include_claims=False)
    code, body = rpc(key,token,"review_parent_upi_payment",review_args(claim,decision,note))
    if (code!=200 or not isinstance(body,dict)
        or body.get("id")!=claim or body.get("status")!=decision
        or not uuid_ok(str(body.get("reviewed_by_user_id","")))
        or not body.get("reviewed_at")):
        raise UpiFailure("Legitimate Owner review result violates audit contract")
    if before!=fingerprint(include_claims=False):
        raise UpiFailure("Accept/reject changed payment ledger before recording")

def allow_record(key: str, token: str, claim: str, due: str,
                 ref: str, amount: int, remaining: int) -> None:
    before_count = sqlscalar("SELECT count(*) FROM public.payments WHERE due_id='"+
                             due+"'::uuid")
    code, body=rpc(key,token,"record_accepted_parent_upi_submission",record_args(claim))
    expected_status="paid" if remaining==0 else "partial"
    if (code!=200 or not isinstance(body,dict)
        or body.get("submission_id")!=claim or body.get("status")!="recorded"
        or body.get("external_transaction_reference")!=ref
        or Decimal(str(body.get("amount_paid",-1)))!=Decimal(amount)
        or Decimal(str(body.get("remaining_amount",-1)))!=Decimal(remaining)
        or body.get("due_status")!=expected_status
        or not uuid_ok(str(body.get("payment_id","")))
        or not str(body.get("receipt_number","")).startswith("RCPT-")
        or not str(body.get("transaction_reference","")).startswith("TXN-")):
        raise UpiFailure("Recorded UPI response violates payment/receipt contract")
    if due_state(due)!=f"{100-remaining}|{expected_status}":
        raise UpiFailure("Recorded UPI due balance/status mismatch")
    if claim_state(claim)!=f"recorded|{body['payment_id']}":
        raise UpiFailure("UPI claim ledger link or status missing")
    row=sqlscalar("SELECT count(*) FROM public.payments WHERE id='"+
                  body["payment_id"]+"'::uuid AND due_id='"+due+"'::uuid "+
                  "AND payment_mode='upi' AND payment_entry_type='payment' "+
                  "AND external_transaction_reference='"+ref+"' "+
                  "AND receipt_number='"+body["receipt_number"]+"'")
    if row!="1" or int(sqlscalar("SELECT count(*) FROM public.payments WHERE due_id='"+
                               due+"'::uuid")) != int(before_count)+1:
        raise UpiFailure("Recorded UPI was not exactly one ledger entry")

def must_be_disposable() -> str:
    root=Path(os.environ.get("RUNNER_TEMP","/not-github-actions"))/PROJECT
    if (os.environ.get("GITHUB_ACTIONS")!="true"
        or os.environ.get("GITHUB_REPOSITORY")!="saurabh-shelke1993/acadpro-app"
        or os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_DB_URL")
        or Path.cwd().resolve()!=root.resolve()
        or not (root/"supabase/config.toml").is_file()
        or (root/"supabase/migrations").exists()
        or (root/"supabase/.temp/project-ref").exists()
        or sqlscalar("SELECT count(*) FROM auth.users")!="29"
        or sqlscalar("SELECT count(*) FROM public.users")!="26"
        or sqlscalar("SELECT count(*) FROM public.parents")!="3"
        or sqlscalar("SELECT count(*) FROM public.parent_payment_submissions")!="3"
        or sqlscalar("SELECT count(*) FROM public.payment_dues")!="5"
        or sqlscalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private'")!="21"
        or any(not (FIXTURES/f).is_file() for f in (SOURCE_SQL,FIX_SQL))):
        raise UpiFailure("AG3.4D3.3 requires exact unlinked D3.2 scratch baseline")
    status=subprocess.run(["supabase","status","-o","env"],capture_output=True,
                          text=True,timeout=30,check=False)
    if status.returncode:
        raise UpiFailure("Disposable Supabase not healthy")
    return ag2.local_status(status.stdout)

def main() -> int:
    step="preflight"
    ag34b.CONTAINER=CONTAINER
    try:
        key=must_be_disposable()
        step="new signed identities for all UPI roles"
        labels=("owner-a","owner-b","coach","parent-a","parent-b","super-admin","unmapped")
        users={label:ag3.signup_with_token(key,"ag34d33-"+label) for label in labels}
        if len({item[0] for item in users.values()})!=len(labels):
            raise UpiFailure("Scratch Auth identity collision")
        step="source-attested original UPI functions and minimal claims schema"
        ag34b.safe(["docker","cp",str(FIXTURES/SOURCE_SQL),CONTAINER+":/tmp/"+SOURCE_SQL])
        psql_vars=[]
        for label,var in (("owner-a","owner_a"),("owner-b","owner_b"),
                          ("coach","coach"),("parent-a","parent_a"),
                          ("parent-b","parent_b"),("super-admin","super_admin")):
            psql_vars+=["-v",var+"_uuid="+users[label][0]]
        d1.sql("--single-transaction",*psql_vars,"-f","/tmp/"+SOURCE_SQL,
               marker="AG3.4D3.3 EXACT UPI ORIGINAL RPC SOURCES MATCHED IN SCRATCH")
        tokens={label:item[1] for label,item in users.items()}
        print("AG3.4D3.3 PASS: original deployed three UPI source hashes and ACLs",flush=True)

        step="PostgREST schema cache readiness for UPI RPC signatures"
        ready=False
        for _ in range(26):
            code,body=rpc(key,tokens["parent-a"],"submit_parent_upi_payment",
                          submit_args(None, "AG34D33-READY"))
            if code==400 and "Select a fee due" in str(getattr(body,"get",lambda _: "")("message")):
                ready=True
                break
            time.sleep(0.5)
        if not ready:
            raise UpiFailure("Original submission function schema/guard unavailable")

        step="original source: legitimate Parent submit and unsafe NULL comparison observation"
        claim_a=allow_submit(key,tokens["parent-a"],DUE_A,REF_A)
        deny(key,tokens["unmapped"],"submit_parent_upi_payment",
             submit_args(DUE_SECOND,"AG34D33-UNMAPPED"),
             "Parent profile not found")
        # No public.users row means no parents.user_id FK target; original role comparison
        # falls through but parent-profile lookup still denies without any mutation.
        print("AG3.4D3.3 ORIGINAL: unmapped submit reached parent-profile guard, no claim write",flush=True)

        step="original source: unmapped claim review reaches independent audit FK"
        deny(key,tokens["unmapped"],"review_parent_upi_payment",
             review_args(claim_a),"foreign key constraint",statuses=(400,409))
        # This is NOT a proven review data write: the live-style reviewed_by FK stops it.
        if claim_state(claim_a)!="pending|":
            raise UpiFailure("Unmapped original review unexpectedly persisted")
        print("AG3.4D3.3 ORIGINAL: NULL role bypassed review IF but audited FK denied update",flush=True)

        step="original source: Owner acceptance changes no financial ledger"
        allow_review(key,tokens["owner-a"],claim_a,"accepted")
        step="original source: UPI recording has independent NULL-safe academy predicate"
        deny(key,tokens["unmapped"],"record_accepted_parent_upi_submission",
             record_args(claim_a),"You are not authorized to record this academy payment claim")
        print("AG3.4D3.3 ORIGINAL: IS DISTINCT FROM blocked unmapped recording before ledger",flush=True)

        step="install NULL-safe scratch-only UPI role guards"
        ag34b.safe(["docker","cp",str(FIXTURES/FIX_SQL),CONTAINER+":/tmp/"+FIX_SQL])
        d1.sql("--single-transaction","-f","/tmp/"+FIX_SQL,
               marker="AG3.4D3.3 SCRATCH ONLY NULL ROLE CANDIDATES INSTALLED")
        for fn,args,expected in (
            ("submit_parent_upi_payment",submit_args(DUE_SECOND,"AG34D33-CANDIDATE"),SUBMIT_ERROR),
            ("review_parent_upi_payment",review_args(claim_a),REVIEW_ERROR),
            ("record_accepted_parent_upi_submission",record_args(claim_a),RECORD_ERROR)):
            deny(key,tokens["unmapped"],fn,args,expected)
        print("AG3.4D3.3 PASS: all three candidates reject unmapped JWT at role guard",flush=True)

        step="wrong-role, parent linkage and cross-academy denial"
        for label in ("owner-a","owner-b","coach","super-admin"):
            deny(key,tokens[label],"submit_parent_upi_payment",
                 submit_args(DUE_SECOND,"AG34D33-BADROLE"),SUBMIT_ERROR)
        for role,due in (("parent-a",DUE_B),("parent-a",DUE_OTHER_PARENT),
                         ("parent-b",DUE_SECOND)):
            deny(key,tokens[role],"submit_parent_upi_payment",
                 submit_args(due,"AG34D33-FOREIGN"),
                 "You are not authorized to submit a claim for this player")
        for label in ("coach","parent-a","parent-b","super-admin"):
            deny(key,tokens[label],"review_parent_upi_payment",
                 review_args(claim_a),REVIEW_ERROR)
            deny(key,tokens[label],"record_accepted_parent_upi_submission",
                 record_args(claim_a),RECORD_ERROR)
        deny(key,tokens["owner-b"],"review_parent_upi_payment",review_args(claim_a),
             "You are not authorized to review this academy payment claim")
        deny(key,tokens["owner-b"],"record_accepted_parent_upi_submission",
             record_args(claim_a),"You are not authorized to record this academy payment claim")
        print("AG3.4D3.3 PASS: Parent/Coach/SA and foreign Owner boundaries",flush=True)

        step="input validation, active due and UTR uniqueness"
        deny(key,tokens["parent-a"],"submit_parent_upi_payment",
             submit_args(DUE_SECOND,"AG34D33-ZERO",0),
             "Enter a valid payment amount")
        deny(key,tokens["parent-a"],"submit_parent_upi_payment",
             submit_args(DUE_SECOND,"AG34D33-OVER",101),
             "Claim amount cannot exceed the remaining due")
        deny(key,tokens["parent-a"],"submit_parent_upi_payment",
             submit_args(DUE_SECOND,"a"),"Enter a valid UPI transaction reference")
        deny(key,tokens["parent-a"],"submit_parent_upi_payment",
             submit_args(DUE_SECOND,"AG34D33-TOMORROW",30,
                         payment_date=(date.today()+timedelta(days=2)).isoformat()),
             "Payment date cannot be in the future")
        deny(key,tokens["parent-a"],"submit_parent_upi_payment",
             submit_args(DUE_SECOND,REF_A),"This UPI transaction reference has already been submitted")
        claim_second=allow_submit(key,tokens["parent-a"],DUE_SECOND,"AG34D33-SECOND")
        deny(key,tokens["parent-a"],"submit_parent_upi_payment",
             submit_args(DUE_SECOND,"AG34D33-SECOND-AGAIN"),
             "duplicate key value violates unique constraint",statuses=(400,409))
        deny(key,tokens["owner-a"],"record_accepted_parent_upi_submission",
             record_args(claim_second),"Only accepted payment claims can be recorded")
        deny(key,tokens["owner-a"],"review_parent_upi_payment",
             review_args(claim_second,"rejected","no"),
             "Provide a reason of at least 3 characters")
        print("AG3.4D3.3 PASS: input, UTR and active due uniqueness; no premature recording",flush=True)

        step="anonymous and invalid signed bearer denial for all UPI mutations"
        for fn,args in (("submit_parent_upi_payment",submit_args(DUE_SECOND,"AG34D33-ANON")),
                        ("review_parent_upi_payment",review_args(claim_second)),
                        ("record_accepted_parent_upi_submission",record_args(claim_a))):
            for bearer in (None,"invalid.ag34d33.jwt"):
                before=fingerprint()
                code,_=rpc(key,bearer,fn,args)
                if code not in (401,403,404) or fingerprint()!=before:
                    raise UpiFailure("Anon/invalid JWT UPI mutation succeeded or changed state")
        print("AG3.4D3.3 PASS: anon/forged JWT denied for three RPCs",flush=True)

        step="positive Owner A accepted collection and exactly-once receipt"
        allow_record(key,tokens["owner-a"],claim_a,DUE_A,REF_A,30,70)
        deny(key,tokens["owner-a"],"record_accepted_parent_upi_submission",
             record_args(claim_a),"This payment claim has already been recorded")
        deny(key,tokens["owner-a"],"review_parent_upi_payment",
             review_args(claim_a),"This payment claim has already been reviewed")
        print("AG3.4D3.3 PASS: accepted claim => one payment/UTR/receipt and paid balance",flush=True)

        step="positive Owner B review and ledger recording"
        claim_b=allow_submit(key,tokens["parent-b"],DUE_B,REF_B,50)
        allow_review(key,tokens["owner-b"],claim_b,"accepted")
        allow_record(key,tokens["owner-b"],claim_b,DUE_B,REF_B,50,50)
        print("AG3.4D3.3 PASS: second academy legitimate independent payment",flush=True)

        step="negative Owner reject; irreversible review state"
        rejected=allow_submit(key,tokens["parent-b"],DUE_B_REJECT,"AG34D33-B-REJECT",25)
        allow_review(key,tokens["owner-b"],rejected,"rejected",note="Not in bank records")
        deny(key,tokens["owner-b"],"record_accepted_parent_upi_submission",
             record_args(rejected),"Only accepted payment claims can be recorded")
        deny(key,tokens["owner-b"],"review_parent_upi_payment",
             review_args(rejected),"This payment claim has already been reviewed")

        step="stale due revalidation after independent manual payment"
        stale=allow_submit(key,tokens["parent-a"],DUE_STALE,"AG34D33-STALE",90)
        allow_review(key,tokens["owner-a"],stale,"accepted")
        code,_=d31.collect(key,tokens["owner-a"],DUE_STALE,20)
        if code!=200 or due_state(DUE_STALE)!="20|partial":
            raise UpiFailure("Synthetic independent manual collection failed")
        deny(key,tokens["owner-a"],"record_accepted_parent_upi_submission",
             record_args(stale),"The claim cannot be recorded because the current remaining due is")
        print("AG3.4D3.3 PASS: stale accepted claim cannot overpay",flush=True)

        step="late recording failure rolls back payment/receipt/counter/claim"
        rollback=allow_submit(key,tokens["parent-a"],DUE_ROLLBACK,
                              "AG34D33-FORCE-ROLLBACK",45)
        allow_review(key,tokens["owner-a"],rollback,"accepted")
        deny(key,tokens["owner-a"],"record_accepted_parent_upi_submission",
             record_args(rollback),"AG34D33 synthetic recording rollback")
        if claim_state(rollback)!="accepted|" or due_state(DUE_ROLLBACK)!="0|pending":
            raise UpiFailure("Rolled-back recording left changed claim or due")
        print("AG3.4D3.3 PASS: forced post-number rollback across ledger and UPI audit",flush=True)

        step="two parallel accepted-claim recording requests are serialized"
        race=allow_submit(key,tokens["parent-a"],DUE_RACE,"AG34D33-RACE",60)
        allow_review(key,tokens["owner-a"],race,"accepted")
        with ThreadPoolExecutor(max_workers=2) as executor:
            pending=[executor.submit(rpc,key,tokens["owner-a"],
                        "record_accepted_parent_upi_submission",record_args(race))
                     for _ in range(2)]
            outcomes=[future.result(timeout=50) for future in pending]
        successes=[v for v in outcomes if v[0]==200]
        rejects=[v for v in outcomes if v[0] in (400,409)]
        if (len(successes)!=1 or len(rejects)!=1
            or "already been recorded" not in str(rejects[0][1].get("message",""))
            or claim_state(race).split("|")[0]!="recorded"
            or due_state(DUE_RACE)!="60|partial"
            or sqlscalar("SELECT count(*) FROM public.payments WHERE due_id='"+DUE_RACE+"'::uuid")!="1"):
            raise UpiFailure("Concurrent accepted recording violated exactly-once invariant")
        print("AG3.4D3.3 PASS: concurrent calls commit exactly one payment and receipt",flush=True)

        step="final disposable only audit"
        if (sqlscalar("SELECT count(*) FROM auth.users")!="36"
            or sqlscalar("SELECT count(*) FROM public.users")!="32"
            or sqlscalar("SELECT count(*) FROM public.payment_dues")!="13"):
            raise UpiFailure("Scratch identities or dues drifted after UPI tests")
        print("AG3.4D3.3 LIMIT: original review unsafe IF reached FK denial; "+
              "scratch NULL-safe candidates passed. Hosted unchanged; AG3.4E NO_GO.",flush=True)
        return 0
    except (UpiFailure,d32.CorrectionFailure,d31.RpcFailure,d1.FinanceFailure,
            ag34b.SecurityMismatch,ag3.Ag3Failure,ag2.Ag2Error,
            ValueError,TypeError,KeyError,OSError,subprocess.TimeoutExpired):
        print("AG3.4D3.3 FAIL at: "+step+"; JWTs and SQL response bodies withheld",flush=True)
        return 1

if __name__=="__main__":
    sys.exit(main())
