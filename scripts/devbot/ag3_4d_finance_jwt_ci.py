#!/usr/bin/env python3
"""AG3.4D1: genuine GoTrue signed-JWT finance read policy parity in scratch only.

Run AFTER a successful AG3.4C2 bootstrap in the SAME disposable instance.
This does NOT execute the 14 public SECURITY DEFINER RPCs or Storage requests.
"""
from __future__ import annotations
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from urllib.parse import urlencode
import ag2_real_auth_ci as ag2
import ag3_real_jwt_rls_ci as ag3
import ag3_4b_live_mapping_ci as ag34b
import ag3_4c2_live_parent_policy_ci as c2
import ag3_3_parent_sa_jwt_rls_ci as ag33

PROJECT=c2.PROJECT
CONTAINER=c2.CONTAINER
POLICY_FILE="ag34d1_live_finance_read_policies.sql"
SQL_ROOT=Path(__file__).resolve().parents[2]/"supabase/tests/security"
A="a0000000-0000-4000-8000-000000000001"
B="a0000000-0000-4000-8000-000000000002"
PARENT_IDS=("d0000000-0000-4000-8000-000000000011",
            "d0000000-0000-4000-8000-000000000012",
            "d0000000-0000-4000-8000-000000000013")
PLAYER_IDS=("f1000000-0000-4000-8000-000000000011",
            "f1000000-0000-4000-8000-000000000012",
            "f1000000-0000-4000-8000-000000000013")
DUE_IDS=("d2000000-0000-4000-8000-000000000011",
         "d2000000-0000-4000-8000-000000000012",
         "d2000000-0000-4000-8000-000000000013")
PAY_IDS=("d3000000-0000-4000-8000-000000000011",
         "d3000000-0000-4000-8000-000000000012",
         "d3000000-0000-4000-8000-000000000013")
SUB_IDS=("d4000000-0000-4000-8000-000000000011",
         "d4000000-0000-4000-8000-000000000012",
         "d4000000-0000-4000-8000-000000000013")

class FinanceFailure(Exception):
    pass

def sql(*args: str,marker: str|None=None)->str:
    command=["docker","exec",CONTAINER,"psql","-U","postgres","-d","postgres",
             "-X","-v","ON_ERROR_STOP=1",*args]
    result=subprocess.run(command,capture_output=True,text=True,timeout=90,check=False)
    if result.returncode:
        errors=[line.strip() for line in result.stderr.splitlines()
                if "ERROR:" in line or "FATAL:" in line]
        reason=errors[0] if errors else "psql returned nonzero without an ERROR line"
        reason=re.sub(r"(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
                      "<synthetic-uuid>",reason)
        reason=re.sub(r"(?i)[a-z0-9._%+-]+@[a-z0-9.-]+","<redacted-email>",reason)
        print("AG3.4D1 sanitized scratch SQL error: "+reason[:210],flush=True)
        raise FinanceFailure("Scratch SQL execution failed")
    if marker is not None and marker not in result.stdout:
        raise FinanceFailure("Scratch SQL checkpoint marker absent")
    return result.stdout.strip()

def rest(key: str,token: str|None,table: str,*,row_filter: str|None=None,
         method: str="GET",headers_extra: dict|None=None,payload: dict|None=None)->tuple[int,object]:
    fields={"payment_dues":"id,player_id","payments":"id,player_id",
            "parent_payment_submissions":"id,parent_id,academy_id"}
    if table not in fields or method not in ("GET","POST"):
        raise ValueError("Unapproved financial API test")
    query={"select":fields[table]}
    if row_filter is not None:
        query["id"]="eq."+row_filter
    headers={"apikey":key,"Accept":"application/json","Prefer":"return=representation"}
    if token:
        headers["Authorization"]="Bearer "+token
    if headers_extra:
        for k in ("x-user-id","x-academy-id"):
            if k in headers_extra:
                headers[k]=headers_extra[k]
    body=None
    if method=="POST":
        if payload is None:
            raise ValueError("POST requires synthetic object")
        body=json.dumps(payload).encode()
        headers["Content-Type"]="application/json"
    req=Request(ag3.API_URL+"/rest/v1/"+table+"?"+urlencode(query),
                data=body,headers=headers,method=method)
    try:
        with urlopen(req,timeout=20) as response:
            content=response.read()
            return response.status,json.loads(content) if content else None
    except HTTPError as error:
        return error.code,None
    except (URLError,TimeoutError):
        raise FinanceFailure("Native disposable PostgREST unavailable") from None

def expected_rows(key:str,token:str,table:str,rows:list[dict],*,
                  row_filter:str|None=None,forged:dict|None=None)->None:
    code,actual=rest(key,token,table,row_filter=row_filter,headers_extra=forged)
    if code!=200 or not isinstance(actual,list) or len(actual)!=len(rows):
        raise FinanceFailure("Finance real-JWT SELECT cardinality differs")
    def keyed(items):
        return {tuple(sorted(r.items())) for r in items}
    if keyed(actual)!=keyed(rows):
        raise FinanceFailure("Financial RLS leaked or hid unexpected rows")

def rows_of(table: str)->list[dict]:
    if table=="payment_dues":
        return [{"id":x,"player_id":p} for x,p in zip(DUE_IDS,PLAYER_IDS)]
    if table=="payments":
        return [{"id":x,"player_id":p} for x,p in zip(PAY_IDS,PLAYER_IDS)]
    if table=="parent_payment_submissions":
        return [{"id":x,"parent_id":p,"academy_id":A if i<2 else B}
                for i,(x,p) in enumerate(zip(SUB_IDS,PARENT_IDS))]
    raise ValueError("Unsupported financial table")

def totals()->str:
    return sql("-At","-c","""SELECT
      (SELECT count(*) FROM auth.users),
      (SELECT count(*) FROM public.users),
      (SELECT count(*) FROM public.parents WHERE is_active),
      (SELECT count(*) FROM public.payment_dues),
      (SELECT count(*) FROM public.payments),
      (SELECT count(*) FROM public.parent_payment_submissions),
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='private');""")

def main()->int:
    stage="disposable environment preflight"
    ag34b.CONTAINER=CONTAINER
    try:
        root=Path(os.environ.get("RUNNER_TEMP","/non-ci"))/PROJECT
        if (os.environ.get("GITHUB_ACTIONS")!="true"
            or os.environ.get("GITHUB_REPOSITORY")!="saurabh-shelke1993/acadpro-app"
            or os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_DB_URL")
            or Path.cwd().resolve()!=root.resolve()
            or not (root/"supabase/config.toml").is_file()
            or (root/"supabase/migrations").exists()
            or (root/"supabase/.temp/project-ref").exists()
            or c2.counts()!=c2.EXPECTED_COUNTS
            or sql("-At","-c","SELECT count(*) FROM auth.users")!="9"):
            raise FinanceFailure("AG3.4D1 requires successful fresh unlinked C2 baseline")
        result=subprocess.run(["supabase","status","-o","env"],
                              text=True,capture_output=True,timeout=30)
        if result.returncode:
            raise FinanceFailure("Supabase native CLI unavailable")
        key=ag2.local_status(result.stdout)
        path=SQL_ROOT/POLICY_FILE
        if not path.is_file():
            raise FinanceFailure("Source-attested finance SQL missing")
        ag34b.safe(["docker","cp",str(path),CONTAINER+":/tmp/"+POLICY_FILE])

        stage="real finance JWT role creation"
        labels=("parent-a1","parent-a2","parent-b","owner-a","owner-b",
                "coach-a","coach-b","super-admin")
        users={}
        for label in labels:
            users[label]=ag3.signup_with_token(key,"ag34d-"+label)
        if len({u for u,_ in users.values()})!=8:
            raise FinanceFailure("Finance GoTrue identity UUID collision")
        args=["--single-transaction"]
        for label,var in zip(labels,("parent_a1","parent_a2","parent_b","owner_a",
                                     "owner_b","coach_a","coach_b","super_admin")):
            args+=["-v",var+"_uuid="+users[label][0]]
        args+=["-f","/tmp/"+POLICY_FILE]
        sql(*args,marker="AG3.4D1 REAL FINANCE SELECT POLICY PARITY INSTALLED IN SCRATCH")
        if totals()!="17|16|3|3|3|3|18":
            raise FinanceFailure("Finance SQL/helper count mismatch")
        print("AG3.4D1 PASS: exact nine finance RLS policy hashes plus six helper hashes",flush=True)

        stage="Parent own due collection and UPI submission"
        for idx,label in enumerate(labels[:3]):
            token=users[label][1]
            for table in ("payment_dues","payments","parent_payment_submissions"):
                records=rows_of(table)
                expected_rows(key,token,table,[records[idx]])
                for j,record in enumerate(records):
                    if j!=idx:
                        expected_rows(key,token,table,[],row_filter=record["id"])
        print("AG3.4D1 PASS: three Parent accounts isolated, including same academy",flush=True)

        stage="Owner and Coach and Super Admin finance role boundary"
        for table in ("payment_dues","payments","parent_payment_submissions"):
            records=rows_of(table)
            expected_rows(key,users["owner-a"][1],table,records[:2])
            expected_rows(key,users["owner-b"][1],table,records[2:])
            expected_rows(key,users["coach-a"][1],table,[])
            expected_rows(key,users["coach-b"][1],table,[])
            expected_rows(key,users["super-admin"][1],table,records)
        print("AG3.4D1 PASS: Owner own academy, Coaches none, SA both academies",flush=True)

        stage="inactive Parent financial read denial"
        sql("-c","UPDATE public.parents SET is_active=false WHERE id='"+PARENT_IDS[1]+"'")
        for table in ("payment_dues","payments","parent_payment_submissions"):
            expected_rows(key,users["parent-a2"][1],table,[])
            expected_rows(key,users["parent-a1"][1],table,[rows_of(table)[0]])
            expected_rows(key,users["super-admin"][1],table,rows_of(table))
        sql("-c","UPDATE public.parents SET is_active=true WHERE id='"+PARENT_IDS[1]+"'")
        for table in ("payment_dues","payments","parent_payment_submissions"):
            expected_rows(key,users["parent-a2"][1],table,[rows_of(table)[1]])
        print("AG3.4D1 PASS: inactive Parent blocked on all three finance read surfaces",flush=True)

        stage="anonymous, spoofed bearer and unauthorized write denial"
        for table in ("payment_dues","payments","parent_payment_submissions"):
            for bearer in (None,"invalid.ag34d.bearer"):
                code,_=rest(key,bearer,table)
                if code not in (401,403):
                    raise FinanceFailure("No-token or forged-JWT finance access not denied")
            expected_rows(key,users["parent-a1"][1],table,[rows_of(table)[0]],
                          forged={"x-user-id":users["super-admin"][0],"x-academy-id":B})
        for table in ("payment_dues","payments","parent_payment_submissions"):
            for label in ("parent-a1","coach-a"):
                code,_=rest(key,users[label][1],table,method="POST",
                             payload=rows_of(table)[0])
                if code not in (401,403):
                    raise FinanceFailure("Unauthorized financial INSERT accepted")
        if totals()!="17|16|3|3|3|3|18":
            raise FinanceFailure("Finance postflight persisted unexpected changes")
        print("AG3.4D1 PASS: forged headers/bearers denied, write denial and row counts",flush=True)
        print("AG3.4D1 LIMIT: finance read SELECT only; NO deployed RPC mutations or Storage object requests",flush=True)
        return 0
    except (FinanceFailure,ag34b.SecurityMismatch,ag3.Ag3Failure,ag2.Ag2Error,
            ValueError,KeyError,TypeError,OSError,subprocess.TimeoutExpired):
        print("AG3.4D1 FAIL at "+stage+"; keys and JWTs withheld",flush=True)
        return 1

if __name__=="__main__":
    sys.exit(main())
