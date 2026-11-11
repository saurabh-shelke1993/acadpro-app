#!/usr/bin/env python3
"""AG3.4B: exact live coach_batches predicates, real JWT negative testing.

Only GitHub scratch Supabase. NEVER test against actual hosted academy records.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import ag2_real_auth_ci as ag2
import ag3_real_jwt_rls_ci as ag3
import ag3_2_coach_jwt_rls_ci as ag32
import ag3_3_parent_sa_jwt_rls_ci as ag33

PROJECT = "kheltriva-ag34b-ci"
CONTAINER = "supabase_db_" + PROJECT
FIXTURE_DIR = Path(__file__).resolve().parents[2] / "supabase/tests/security"
LIVE_SQL = "ag34b_live_coach_batches_policy_snapshot.sql"
CANDIDATE_SQL = "ag34b_scratch_role_gated_candidate.sql"
LINKED = "f0000000-0000-4000-8000-000000000001"
INACTIVE = "f0000000-0000-4000-8000-000000000002"
FOREIGN = "f0000000-0000-4000-8000-000000000003"
PROBE = "f0000000-0000-4000-8000-000000000099"
CROSS_COACH = "e0000000-0000-4000-8000-000000000002"

class SecurityMismatch(Exception):
    """No sensitive data in failures."""


def safe(args: list[str], *, marker: str | None = None) -> str:
    c = subprocess.run(args, capture_output=True, text=True, timeout=90, check=False)
    if c.returncode:
        for known in ("AG3.4B live predicate checksum parity mismatch",
                      "AG3.4B live Coach dependency checksum mismatch",
                      "AG3.4B live predicate clone is inconsistent",
                      "AG3.4B requires disposable AG3.3 baseline",
                      "AG3.4B remediation target is not isolated fixture",
                      "AG3.4B candidate policy count changed"):
            if known in c.stderr:
                raise SecurityMismatch(known)
        raise SecurityMismatch("Disposable SQL/Docker command failed")
    if marker and marker not in c.stdout:
        raise SecurityMismatch("SQL guard marker missing")
    return c.stdout.strip()


def sql(*args: str, marker: str | None = None) -> str:
    return safe(["docker","exec",CONTAINER,"psql","-U","postgres","-d","postgres",
                 "-X","-v","ON_ERROR_STOP=1",*args],marker=marker)


def stage() -> None:
    for filename in (*ag2.FIXTURES, ag3.POLICY_FILE,
                     ag32.POLICY_FILE, ag33.POLICY_FILE):
        source=ag2.FIXTURE_PATH/filename
        if not source.is_file():
            raise SecurityMismatch("Missing pinned AG3 fixture")
        safe(["docker","cp",str(source),CONTAINER+":/tmp/"+filename])
    for filename in (LIVE_SQL,CANDIDATE_SQL):
        source=FIXTURE_DIR/filename
        if not source.is_file():
            raise SecurityMismatch("Missing security-policy fixture")
        safe(["docker","cp",str(source),CONTAINER+":/tmp/"+filename])


def rest(key: str, token: str | None, *, method: str="GET",
         id_filter: str | None=None, payload: dict | None=None,
         headers_extra: dict | None=None) -> tuple[int, object]:
    if method not in ("GET","POST","PATCH","DELETE"):
        raise ValueError("Unsupported method")
    query={"select":"id,batch_id,coach_id"}
    if id_filter:
        query["id"]="eq."+id_filter
    headers={"apikey":key,"Accept":"application/json","Prefer":"return=representation"}
    if token is not None:
        headers["Authorization"]="Bearer "+token
    if headers_extra:
        for name in ("x-academy-id","x-user-id"):
            if name in headers_extra:
                headers[name]=headers_extra[name]
    data=None
    if method in ("POST","PATCH"):
        if payload is None:
            raise ValueError("payload required")
        data=json.dumps(payload).encode()
        headers["Content-Type"]="application/json"
    req=Request(ag3.API_URL+"/rest/v1/coach_batches?"+urlencode(query),
                data=data,headers=headers,method=method)
    try:
        with urlopen(req,timeout=20) as resp:
            raw=resp.read()
            return resp.status,(json.loads(raw) if raw else None)
    except HTTPError as err:
        return err.code,None
    except (URLError,TimeoutError):
        raise SecurityMismatch("Local PostgREST unavailable") from None


def expect_ids(key: str, token: str, ids: set[str], *, id_filter: str | None=None,
               forged: dict | None=None) -> None:
    code,rows=rest(key,token,id_filter=id_filter,headers_extra=forged)
    if code!=200 or not isinstance(rows,list):
        raise SecurityMismatch("Unexpected mapping SELECT response")
    if len(rows)!=len(ids) or {x.get("id") for x in rows}!=ids:
        raise SecurityMismatch("Mapping visibility differs from tested contract")


def must_deny_write(key: str, token: str, method: str, *,
                    payload: dict | None=None, id_filter: str | None=None) -> None:
    status,rows=rest(key,token,method=method,payload=payload,id_filter=id_filter)
    # UPDATE/DELETE with no visible row legitimately return no affected rows.
    if status in (401,403):
        return
    if method in ("PATCH","DELETE") and status in (200,204) and rows in ([],None):
        return
    raise SecurityMismatch("Unauthorized mapping write was not denied")


def post(key: str, token: str, obj: dict) -> int:
    code,rows=rest(key,token,method="POST",payload=obj)
    if code==201 and isinstance(rows,list) and len(rows)==1 and rows[0]["id"]==obj["id"]:
        return code
    if code in (401,403):
        return code
    raise SecurityMismatch("Unexpected mapping INSERT outcome")


def delete_exact(key: str, token: str, id: str) -> None:
    code,rows=rest(key,token,method="DELETE",id_filter=id)
    if code!=200 or not isinstance(rows,list) or len(rows)!=1 or rows[0].get("id")!=id:
        raise SecurityMismatch("Expected scratch-only mapping deletion failed")


def db_counts() -> str:
    return sql("-At","-c",'''SELECT
       (SELECT count(*) FROM auth.users),
       (SELECT count(*) FROM public.users),
       (SELECT count(*) FROM public.coach_batches),
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='coach_batches'),
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n
         ON p.pronamespace=n.oid WHERE n.nspname='private');''')


def report(items: list[tuple[str,str]], result: bool) -> None:
    lines=["## AG3.4B — live Coach mapping policy replay against real local JWTs",
           "", "**"+("PASS" if result else "FAIL")+"**","",
           "| Checkpoint | Outcome |","| --- | --- |"]
    lines.extend("| "+x+" | "+y+" |" for x,y in items)
    lines += ["","Source is the exact deployed `coach_batches` policy predicates",
              "captured through read-only `pg_policies` on 11 November 2026.",
              "Findings prove behavior only in this minimal FK and RLS reconstruction.",
              "The role-gated candidate is test-only, NOT deployed.",
              "No original migration replay, hosted credentials or real user writes.",""]
    dest=os.environ.get("GITHUB_STEP_SUMMARY")
    if dest:
        with open(dest,"a",encoding="utf-8") as o:
            o.write("\n".join(lines))
    else:
        print("\n".join(lines))


def main() -> int:
    outcome=[]
    checkpoint="disposable Supabase preflight"
    try:
        directory=Path(os.environ.get("RUNNER_TEMP","/non-ci"))/PROJECT
        if (os.environ.get("GITHUB_ACTIONS")!="true"
            or os.environ.get("GITHUB_REPOSITORY")!="saurabh-shelke1993/acadpro-app"
            or os.environ.get("SUPABASE_ACCESS_TOKEN")
            or os.environ.get("SUPABASE_DB_URL")
            or Path.cwd().resolve()!=directory.resolve()
            or not (directory/"supabase/config.toml").is_file()
            or (directory/"supabase/migrations").exists()
            or (directory/"supabase/.temp/project-ref").exists()):
            raise SecurityMismatch("Refusing non-disposable Supabase")
        if safe(["docker","inspect","-f","{{.State.Health.Status}}",CONTAINER])!="healthy":
            raise SecurityMismatch("Scratch database unhealthy")
        result=subprocess.run(["supabase","status","-o","env"],capture_output=True,text=True,timeout=25)
        if result.returncode:
            raise SecurityMismatch("Native CLI status failure")
        key=ag2.local_status(result.stdout)
        stage()
        outcome.append(("Unlinked native Auth/PostgREST and pinned sources","PASS"))

        checkpoint="bootstrap AG3.1/AG3.2/AG3.3 synthetic roles"
        sql("-f","/tmp/"+ag2.FIXTURES[0],marker="COMMIT")
        sql("--single-transaction","-f","/tmp/"+ag2.FIXTURES[1],
            "-f","/tmp/"+ag2.FIXTURES[2],"-f","/tmp/"+ag2.FIXTURES[3],
            marker="C3.3B CURRENT HELPERS VERIFIED")
        smoke,smoke_token=ag3.signup_with_token(key,"c34a")
        owner_a,owner_a_token=ag3.signup_with_token(key,"c34b1-ao-a")
        sql("--single-transaction","-v","owner_uuid="+owner_a,
            "-f","/tmp/"+ag2.FIXTURES[4],marker="B2.9-C3.4B1 OWNER A MAPPING VERIFIED")
        owner_b,owner_b_token=ag3.signup_with_token(key,"c34b2-ao-b")
        sql("--single-transaction","-v","owner_uuid="+owner_b,
            "-f","/tmp/"+ag2.FIXTURES[5],marker="B2.9-C3.4B2 OWNER B MAPPING VERIFIED")
        if sql("-At","-c",ag2.STATE_SQL)!=ag2.EXPECTED:
            raise SecurityMismatch("AG2 source baseline changed")
        sql("--single-transaction","-f","/tmp/"+ag3.POLICY_FILE,
            marker="AG3 SYNTHETIC OWNER RLS POLICY VERIFIED")
        coach_a,coach_a_token=ag3.signup_with_token(key,"ag32-coach-a")
        coach_b,coach_b_token=ag3.signup_with_token(key,"ag32-coach-b")
        sql("--single-transaction","-v","coach_a_uuid="+coach_a,
            "-v","coach_b_uuid="+coach_b,
            "-f","/tmp/"+ag32.POLICY_FILE,
            marker="AG3.2 SYNTHETIC COACH SCOPE VERIFIED")
        parent_a1,token_a1=ag3.signup_with_token(key,"ag33-parent-a1")
        parent_a2,token_a2=ag3.signup_with_token(key,"ag33-parent-a2")
        parent_b,token_b=ag3.signup_with_token(key,"ag33-parent-b")
        sa,token_sa=ag3.signup_with_token(key,"ag33-super-admin")
        sql("--single-transaction","-v","parent_a1_uuid="+parent_a1,
            "-v","parent_a2_uuid="+parent_a2,"-v","parent_b_uuid="+parent_b,
            "-v","super_admin_uuid="+sa,"-f","/tmp/"+ag33.POLICY_FILE,
            marker="AG3.3 SYNTHETIC PARENT AND SUPER ADMIN SCOPE VERIFIED")
        if sql("-At","-c",ag33.POST_STATE_SQL)!=ag33.EXPECTED_POST_STATE:
            raise SecurityMismatch("AG3.3 baseline postconditions changed")
        if len({smoke,owner_a,owner_b,coach_a,coach_b,parent_a1,parent_a2,parent_b,sa})!=9:
            raise SecurityMismatch("Duplicate real GoTrue identity")
        outcome.append(("Nine genuine JWT roles with Parent linked batches","PASS"))

        checkpoint="install exact deployed legacy policy snapshot"
        sql("-f","/tmp/"+LIVE_SQL,marker="AG3.4B LIVE POLICY PREDICATES INSTALLED IN SCRATCH")
        if db_counts()!="9|8|3|4|11":
            raise SecurityMismatch("Live policy fixture unexpectedly changed")
        # PostgREST cache refresh, never retry failed authorization assertions.
        for _ in range(12):
            code,_=rest(key,owner_a_token)
            if code==200:
                break
            if code not in (404,503):
                raise SecurityMismatch("Unexpected PostgREST cache status "+str(code))
            time.sleep(1)
        else:
            raise SecurityMismatch("PostgREST legacy mapping cache not refreshed")
        outcome.append(("Four source-matched live RLS predicates and table grants","PASS"))

        checkpoint="legacy policy same-academy read behavior"
        expect_ids(key,token_a1,{LINKED,INACTIVE})
        expect_ids(key,token_a2,{LINKED,INACTIVE})
        expect_ids(key,token_b,{FOREIGN})
        expect_ids(key,coach_a_token,{LINKED,INACTIVE})
        expect_ids(key,owner_a_token,{LINKED,INACTIVE})
        expect_ids(key,token_sa,{LINKED,INACTIVE,FOREIGN})
        expect_ids(key,token_a1,set(),id_filter=FOREIGN)
        outcome.append(("LIVE PREDICATE: Parent reads other-parent and inactive mapping in own academy","CONFIRMED IN SCRATCH"))

        checkpoint="legacy mapping unauthorized write probe"
        probe={"id":PROBE,"coach_id":CROSS_COACH,"batch_id":ag3.BATCH_A}
        status=post(key,token_a1,probe)
        print("AG3.4B PARENT_MAPPING_INSERT "+("ALLOWED_IN_SCRATCH" if status==201 else "DENIED_IN_SCRATCH"),flush=True)
        if status==201:
            expect_ids(key,token_a1,{PROBE},id_filter=PROBE)
            delete_exact(key,token_a1,PROBE)
            outcome.append(("LIVE PREDICATE: Parent inserted and deleted cross-academy Coach mapping","CONFIRMED IN SCRATCH"))
        else:
            outcome.append(("LIVE PREDICATE: Parent malicious INSERT blocked by nested RLS","DENIED"))
        if db_counts()!="9|8|3|4|11":
            raise SecurityMismatch("Unauthorized write probe did not restore row count")
        # A Coach with an active A1 assignment can also reach the A1 batch
        # in the original deployed EXISTS predicate.
        status=post(key,coach_a_token,probe)
        print("AG3.4B COACH_MAPPING_INSERT "+("ALLOWED_IN_SCRATCH" if status==201 else "DENIED_IN_SCRATCH"),flush=True)
        if status==201:
            delete_exact(key,coach_a_token,PROBE)
            outcome.append(("LIVE PREDICATE: Coach inserted/deleted cross-academy Coach link","CONFIRMED IN SCRATCH"))
        else:
            outcome.append(("LIVE PREDICATE: Coach INSERT blocked by nested RLS","DENIED"))

        checkpoint="install proposed fix inside scratch only"
        if db_counts()!="9|8|3|4|11":
            raise SecurityMismatch("Probe left an unexpected legacy mapping")
        sql("-f","/tmp/"+CANDIDATE_SQL,
            marker="AG3.4B SCRATCH ROLE-GATED CANDIDATE INSTALLED")
        expect_ids(key,token_a1,set())
        expect_ids(key,token_a2,set())
        expect_ids(key,token_b,set())
        expect_ids(key,coach_a_token,{LINKED})
        expect_ids(key,coach_b_token,{FOREIGN})
        expect_ids(key,owner_a_token,{LINKED,INACTIVE})
        expect_ids(key,token_sa,{LINKED,INACTIVE,FOREIGN})
        outcome.append(("TEST-ONLY CANDIDATE: Parent denied, Coach only active own mapping","PASS"))

        checkpoint="candidate denies writes, preserves Owner and SA rights"
        for token in (token_a1,token_a2,token_b,coach_a_token,coach_b_token):
            must_deny_write(key,token,"POST",payload=probe)
            must_deny_write(key,token,"DELETE",id_filter=LINKED)
            must_deny_write(key,token,"PATCH",id_filter=LINKED,
                            payload={"coach_id":CROSS_COACH})
        must_deny_write(key,owner_a_token,"POST",payload=probe)
        # Owner A may manage same-academy rows. Delete/reinsert one existing row.
        delete_exact(key,owner_a_token,INACTIVE)
        restored={"id":INACTIVE,"coach_id":ag32.COACH_A_ID,"batch_id":ag32.BATCH_INACTIVE_A}
        if post(key,owner_a_token,restored)!=201:
            raise SecurityMismatch("Owner A scoped restore denied")
        # SA may write cross academy in this synthetic contract.
        delete_exact(key,token_sa,FOREIGN)
        if post(key,token_sa,{"id":FOREIGN,"coach_id":ag32.COACH_B_ID,
                              "batch_id":ag3.BATCH_B})!=201:
            raise SecurityMismatch("SA scope restore denied")
        outcome.append(("TEST-ONLY CANDIDATE: all non-Owner/SA writes denied; Owner/SA permitted","PASS"))

        checkpoint="postflight role and data integrity"
        if db_counts()!="9|8|3|4|11":
            raise SecurityMismatch("Postflight changed synthetic mapping state")
        ag32.read_scoped(key,coach_a_token,[{"id":ag3.BATCH_A,"academy_id":ag3.ACADEMY_A}])
        ag32.read_scoped(key,owner_b_token,[{"id":ag3.BATCH_B,"academy_id":ag3.ACADEMY_B}])
        expect_ids(key,token_sa,{LINKED,INACTIVE,FOREIGN})
        code,rows=rest(key,None)
        if code not in (200,401,403) or (code==200 and rows!=[]):
            raise SecurityMismatch("Anonymous RLS mapping rows visible")
        outcome.append(("Fresh SQL count, Owner/Coach regression and anonymous denial","PASS"))
        report(outcome,True)
        print("AG3.4B PASS: live legacy predicate risk reproduced and candidate isolation verified",flush=True)
        return 0
    except (SecurityMismatch,ag2.Ag2Error,ag3.Ag3Failure,ag32.Ag32Failure,
            ag33.Ag33Failure,OSError,subprocess.TimeoutExpired,KeyError,TypeError,ValueError) as exc:
        outcome.append((checkpoint,"FAIL"))
        report(outcome,False)
        reason = str(exc) if isinstance(exc, SecurityMismatch) else "sensitive diagnostics withheld"
        print("AG3.4B FAIL at "+checkpoint+"; "+reason,flush=True)
        return 1


if __name__=="__main__":
    sys.exit(main())
