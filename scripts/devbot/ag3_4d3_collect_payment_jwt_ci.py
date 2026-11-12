#!/usr/bin/env python3
"""AG3.4D3.1: original deployed collect_payment RPC under real scratch GoTrue JWTs.

Runs only after C2 + D1, in the same ephemeral unlinked local Supabase instance.
No hosted project, historical migration replay, production token or customer row.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import ag2_real_auth_ci as ag2
import ag3_real_jwt_rls_ci as ag3
import ag3_4d_finance_jwt_ci as d1
import ag3_4b_live_mapping_ci as ag34b
import ag3_4c2_live_parent_policy_ci as c2

PROJECT = c2.PROJECT
CONTAINER = c2.CONTAINER
SQL_FILE = "ag34d3_collect_payment_rpc_scratch.sql"
FIXTURE = Path(__file__).resolve().parents[2] / "supabase/tests/security" / SQL_FILE
DUE_A1, DUE_A2, DUE_B = d1.DUE_IDS
DUE_RACE = "d2000000-0000-4000-8000-000000000014"

class RpcFailure(Exception):
    pass

def snapshot() -> str:
    """Full payment state/counters fingerprint, only invented row values."""
    return d1.sql("-At", "-c", """
    SELECT coalesce((SELECT string_agg(id::text||':'||paid_amount::text||':'||due_status,';'
                                      ORDER BY id) FROM public.payment_dues),'')
       || '|' || (SELECT count(*) FROM public.payments WHERE due_id IS NOT NULL)::text
       || '|' || (SELECT coalesce(sum(next_value),0) FROM public.payment_number_counters)::text;
    """)

def due_state(due_id: str) -> str:
    return d1.sql("-At", "-c",
                  "SELECT paid_amount::text || '|' || due_status FROM public.payment_dues WHERE id='"
                  + due_id + "'::uuid")

def collect(key: str, token: str | None, due_id: str, amount: int,
            mode: str = "cash", remarks: str = "AG34D3 synthetic") -> tuple[int, object]:
    payload = {"p_due_id": due_id, "p_amount": amount,
               "p_payment_mode": mode, "p_remarks": remarks}
    headers = {"apikey": key, "Accept": "application/json",
               "Content-Type": "application/json"}
    if token is not None:
        headers["Authorization"] = "Bearer " + token
    req = Request(ag3.API_URL + "/rest/v1/rpc/collect_payment",
                  headers=headers, data=json.dumps(payload).encode(), method="POST")
    try:
        with urlopen(req, timeout=30) as response:
            content = response.read()
            return response.status, json.loads(content) if content else None
    except HTTPError as err:
        # Failure content is inspected for known, expected reasons but NEVER logged.
        try:
            body = json.loads(err.read())
        except (ValueError, TypeError):
            body = {}
        return err.code, body if isinstance(body, dict) else {}
    except (URLError, TimeoutError):
        raise RpcFailure("Disposable PostgREST unavailable") from None

def deny(key: str, token: str | None, due: str, amount: int,
         expected: str, *, mode: str = "cash", remarks: str = "AG34D3 synthetic") -> None:
    before = snapshot()
    code, body = collect(key, token, due, amount, mode=mode, remarks=remarks)
    if code not in (400, 401, 403) or not isinstance(body, dict):
        raise RpcFailure("Unauthorized or invalid RPC call was accepted")
    message = str(body.get("message", ""))
    if expected not in message:
        raise RpcFailure("RPC rejection did not reach expected authorization/invariant guard")
    if snapshot() != before:
        raise RpcFailure("Rejected RPC mutated financial state")

def allow(key: str, token: str, due: str, amount: int,
          remaining: int, status: str) -> None:
    code, result = collect(key, token, due, amount)
    if code != 200 or not isinstance(result, list) or len(result) != 1:
        raise RpcFailure("Authorized source-attested payment RPC did not succeed")
    row = result[0]
    if (row.get("due_id") != due or Decimal(str(row.get("amount_paid"))) != Decimal(amount)
        or Decimal(str(row.get("remaining_amount"))) != Decimal(remaining)
        or row.get("due_status") != status
        or not str(row.get("transaction_reference","")).startswith("TXN-")
        or not str(row.get("receipt_number","")).startswith("RCPT-")
        or not row.get("payment_id")):
        raise RpcFailure("RPC result violates financial contract")
    if due_state(due) != f"{100-remaining}|{status}":
        # For the two-step case amount is the newly paid amount, not cumulative.
        raise RpcFailure("RPC did not persist expected due balance and status")

def require_context() -> str:
    root = Path(os.environ.get("RUNNER_TEMP", "/non-ci")) / PROJECT
    if (os.environ.get("GITHUB_ACTIONS") != "true"
        or os.environ.get("GITHUB_REPOSITORY") != "saurabh-shelke1993/acadpro-app"
        or os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_DB_URL")
        or Path.cwd().resolve() != root.resolve()
        or not (root/"supabase/config.toml").is_file()
        or (root/"supabase/migrations").exists()
        or (root/"supabase/.temp/project-ref").exists()
        or d1.totals() != "17|16|3|3|3|3|18"
        or not FIXTURE.is_file()):
        raise RpcFailure("AG3.4D3 requires successful unlinked C2/D1 baseline")
    result = subprocess.run(["supabase","status","-o","env"],
                            capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RpcFailure("Scratch Supabase CLI not healthy")
    return ag2.local_status(result.stdout)

def main() -> int:
    step = "preflight"
    ag34b.CONTAINER = CONTAINER
    try:
        key = require_context()
        step = "new signed test JWT accounts"
        labels = ("owner-a","owner-b","coach","parent","super-admin","unmapped")
        sessions = {name:ag3.signup_with_token(key, "ag34d3-"+name)
                    for name in labels}
        if len({x[0] for x in sessions.values()}) != len(labels):
            raise RpcFailure("Scratch JWT identity collision")
        step = "install exact deployed functions and transaction-abort trigger"
        ag34b.safe(["docker","cp",str(FIXTURE),CONTAINER+":/tmp/"+SQL_FILE])
        vars = []
        for label,var in (("owner-a","owner_a"),("owner-b","owner_b"),
                          ("coach","coach"),("parent","parent"),
                          ("super-admin","super_admin")):
            vars.extend(["-v",var+"_uuid="+sessions[label][0]])
        d1.sql("--single-transaction",*vars,"-f","/tmp/"+SQL_FILE,
               marker="AG3.4D3 COLLECT PAYMENT SOURCE REPLAY INSTALLED ONLY IN SCRATCH")
        if d1.sql("-At","-c","SELECT count(*) FROM auth.users") != "23":
            raise RpcFailure("Real Auth identity cardinality drift")
        print("AG3.4D3 PASS: live function/number-helper MD5 matched and ACLs pinned",flush=True)
        tokens = {name: val[1] for name,val in sessions.items()}
        baseline = snapshot()
        step = "role/tenant/parameter guards"
        role_error = "Only Academy Owner or Super Admin can collect payments"
        for label in ("coach","parent","unmapped"):
            deny(key,tokens[label],DUE_A1,20,role_error)
        deny(key,tokens["owner-b"],DUE_A1,20,
             "You are not authorized to collect this payment")
        deny(key,tokens["owner-a"],DUE_A1,0,"Payment amount must be greater than zero")
        deny(key,tokens["owner-a"],DUE_A1,20,"Unsupported payment mode",mode="invalid")
        deny(key,tokens["owner-a"],DUE_A1,101,
             "Payment exceeds the remaining due amount")
        if snapshot()!=baseline:
            raise RpcFailure("Negative cases mutated balances, payments or counters")
        print("AG3.4D3 PASS: Coach/Parent/unmapped, foreign Owner, bad values denied",flush=True)

        step = "anonymous/forged JWT denial"
        for bearer in (None, "invalid.ag34d3.jwt"):
            code,_ = collect(key,bearer,DUE_A1,20)
            if code not in (401,403,404):
                raise RpcFailure("Anonymous or forged bearer accepted by RPC")
        if snapshot()!=baseline:
            raise RpcFailure("Anonymous/invalid bearer caused financial mutation")
        print("AG3.4D3 PASS: anon and invalid signed bearer blocked",flush=True)

        step = "positive partial/full payments and cross-academy SA"
        allow(key,tokens["owner-a"],DUE_A1,40,60,"partial")
        allow(key,tokens["owner-a"],DUE_A1,60,0,"paid")
        deny(key,tokens["owner-a"],DUE_A1,1,"already fully paid")
        allow(key,tokens["owner-b"],DUE_B,80,20,"partial")
        allow(key,tokens["super-admin"],DUE_A2,100,0,"paid")
        if d1.sql("-At","-c","SELECT count(*) FROM public.payments WHERE due_id IS NOT NULL")!="4":
            raise RpcFailure("Expected payment ledger row count differs")
        print("AG3.4D3 PASS: Owner A/B and SA collections, partial/full and duplicate denial",flush=True)

        step = "forced late failure rollback"
        before = snapshot()
        deny(key,tokens["owner-b"],DUE_B,10,
             "AG34D3 scratch transaction abort",remarks="AG34D3_ABORT")
        if snapshot()!=before:
            raise RpcFailure("Forced post-number-allocation failure changed counters")
        print("AG3.4D3 PASS: payment and number counter transaction rollback",flush=True)

        step = "row lock concurrent overpayment"
        d1.sql("-c","INSERT INTO public.payment_dues(id,player_id,total_amount) VALUES ('"
               +DUE_RACE+"'::uuid, '"+d1.PLAYER_IDS[0]+"'::uuid, 100)")
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs = [pool.submit(collect,key,tokens["owner-a"],DUE_RACE,70) for _ in range(2)]
            results = [j.result(timeout=50) for j in jobs]
        good = [(code,body) for code,body in results if code==200]
        bad = [(code,body) for code,body in results if code==400]
        if (len(good)!=1 or len(bad)!=1
            or "Payment exceeds the remaining due amount" not in str(bad[0][1].get("message",""))
            or due_state(DUE_RACE)!="70|partial"
            or d1.sql("-At","-c","SELECT count(*) FROM public.payments WHERE due_id='"
                      +DUE_RACE+"'::uuid")!="1"):
            raise RpcFailure("Concurrent calls violated row-lock/overpayment invariant")
        print("AG3.4D3 PASS: concurrent payment overage denied, one receipt committed",flush=True)
        print("AG3.4D3 LIMIT: one exact callable RPC, synthetic schema and injected trigger; 13 RPCs and Storage remain pending",flush=True)
        return 0
    except (RpcFailure,d1.FinanceFailure,ag34b.SecurityMismatch,
            ag3.Ag3Failure,ag2.Ag2Error,ValueError,TypeError,KeyError,
            OSError,subprocess.TimeoutExpired):
        print("AG3.4D3 FAIL at: "+step+"; sensitive errors and JWTs withheld",flush=True)
        return 1

if __name__=="__main__":
    sys.exit(main())
