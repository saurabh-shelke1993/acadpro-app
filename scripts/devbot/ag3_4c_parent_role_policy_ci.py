#!/usr/bin/env python3
"""AG3.4C: exact deployed Parent SELECT policies and helper via genuine local JWT.

Never connects to the real Supabase project or replays historical migrations.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
import subprocess
import sys
from typing import Any

import ag2_real_auth_ci as ag2
import ag3_real_jwt_rls_ci as ag3
import ag3_2_coach_jwt_rls_ci as ag32
import ag3_3_parent_sa_jwt_rls_ci as ag33

PROJECT="kheltriva-ag34c-ci"
CONTAINER="supabase_db_"+PROJECT
FIXTURE="ag34c_live_parent_role_policy_snapshot.sql"
SOURCE=Path(__file__).resolve().parents[2]/"supabase/tests/security"/FIXTURE

class ParityFailure(Exception):
    pass

def command(args: list[str], marker: str | None=None)->str:
    result=subprocess.run(args,capture_output=True,text=True,timeout=90,check=False)
    if result.returncode:
        for known in ("AG3.4C exact deployed Parent policy checksum mismatch",
                      "AG3.4C current_parent_id source digest mismatch",
                      "AG3.4C parent policy grants/counts unexpected",
                      "AG3.4C requires clean disposable AG3.3 baseline"):
            if known in result.stderr:
                raise ParityFailure(known)
        # SQLSTATE only (no error response, SQL text, token or auth secret).
        found=re.search(r'ERROR:\\s*([0-9A-Z]{5})',result.stderr)
        state=found.group(1) if found else "UNKNOWN"
        raise ParityFailure("Disposable SQL/Docker failure SQLSTATE="+state)
    if marker and marker not in result.stdout:
        raise ParityFailure("Missing SQL checkpoint marker")
    return result.stdout.strip()

def sql(*args: str, marker: str | None=None)->str:
    return command(["docker","exec",CONTAINER,"psql","-U","postgres",
                    "-d","postgres","-X","-v","ON_ERROR_STOP=1",
                    "-v","VERBOSITY=sqlstate",*args],marker)

def stage():
    for name in (*ag2.FIXTURES,ag3.POLICY_FILE,
                 ag32.POLICY_FILE,ag33.POLICY_FILE):
        source=ag2.FIXTURE_PATH/name
        if not source.is_file():
            raise ParityFailure("Pinned fixture missing")
        command(["docker","cp",str(source),CONTAINER+":/tmp/"+name])
    if not SOURCE.is_file():
        raise ParityFailure("Live parent source snapshot missing")
    command(["docker","cp",str(SOURCE),CONTAINER+":/tmp/"+FIXTURE])

def parent(player_id: str,parent_id: str,batch_id: str,academy: str)->dict[str,str]:
    return {"id":player_id,"parent_id":parent_id,"batch_id":batch_id,"academy_id":academy}

def parent_record(parent_id: str,user_id: str,academy: str)->dict[str,str]:
    return {"id":parent_id,"user_id":user_id,"academy_id":academy}

def set_parent_active(parent_id: str,active: bool):
    if parent_id not in (ag33.PARENT_A1_ID,ag33.PARENT_A2_ID,ag33.PARENT_B_ID):
        raise ValueError("Unauthorized synthetic parent")
    sql("-c","UPDATE public.parents SET is_active="+("true" if active else "false")+
        " WHERE id='"+parent_id+"'::uuid")

def set_app_role(user_id: str, role: str):
    if role not in ("parent","coach"):
        raise ValueError("Wrong synthetic role")
    # Caller must pass only the Auth UUID signed up earlier.
    sql("-c","UPDATE public.users SET role='"+role+"' WHERE id='"+user_id+"'::uuid")

def report(items: list[tuple[str,str]],good: bool):
    lines=["## AG3.4C — exact deployed Parent helper and role policy JWT test",
           "","**"+("PASS" if good else "FAIL")+"**","",
           "| Checkpoint | Result |","| --- | --- |"]
    lines += ["| "+name+" | "+status+" |" for name,status in items]
    lines += ["","Policy and helper text came from read-only live pg_policies",
              "and pg_get_functiondef, checked via PostgreSQL MD5 parity.",
              "Only the verified Parent/Player/Batch SELECT subset is recreated.",
              "Not full original migration, financial RPC or Storage equivalence.",""]
    dest=os.environ.get("GITHUB_STEP_SUMMARY")
    if dest:
        with open(dest,"a",encoding="utf-8") as output:
            output.write("\n".join(lines))
    else:
        print("\n".join(lines))

def main()->int:
    stage_label="fresh unlinked Supabase"
    items=[]
    try:
        home=Path(os.environ.get("RUNNER_TEMP","/not-ci"))/PROJECT
        if (os.environ.get("GITHUB_ACTIONS")!="true"
            or os.environ.get("GITHUB_REPOSITORY")!="saurabh-shelke1993/acadpro-app"
            or os.environ.get("SUPABASE_ACCESS_TOKEN")
            or os.environ.get("SUPABASE_DB_URL")
            or Path.cwd().resolve()!=home.resolve()
            or not (home/"supabase/config.toml").is_file()
            or (home/"supabase/migrations").exists()
            or (home/"supabase/.temp/project-ref").exists()):
            raise ParityFailure("Refusing non-disposable Supabase")
        if command(["docker","inspect","-f","{{.State.Health.Status}}",CONTAINER])!="healthy":
            raise ParityFailure("Disposable Postgres unhealthy")
        cli=subprocess.run(["supabase","status","-o","env"],
                           capture_output=True,text=True,timeout=25)
        if cli.returncode: raise ParityFailure("Local Supabase status failed")
        key=ag2.local_status(cli.stdout)
        stage()
        items.append(("Unlinked native Auth and pinned synthetic schema","PASS"))

        stage_label="nine real GoTrue identities and AG3.3 base"
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
            raise ParityFailure("AG2 baseline changed")
        sql("--single-transaction","-f","/tmp/"+ag3.POLICY_FILE,
            marker="AG3 SYNTHETIC OWNER RLS POLICY VERIFIED")
        coach_a,coach_a_token=ag3.signup_with_token(key,"ag32-coach-a")
        coach_b,coach_b_token=ag3.signup_with_token(key,"ag32-coach-b")
        sql("--single-transaction","-v","coach_a_uuid="+coach_a,
            "-v","coach_b_uuid="+coach_b,"-f","/tmp/"+ag32.POLICY_FILE,
            marker="AG3.2 SYNTHETIC COACH SCOPE VERIFIED")
        parent_a1,token_a1=ag3.signup_with_token(key,"ag33-parent-a1")
        parent_a2,token_a2=ag3.signup_with_token(key,"ag33-parent-a2")
        parent_b,token_b=ag3.signup_with_token(key,"ag33-parent-b")
        sa,token_sa=ag3.signup_with_token(key,"ag33-super-admin")
        sql("--single-transaction",
            "-v","parent_a1_uuid="+parent_a1,
            "-v","parent_a2_uuid="+parent_a2,
            "-v","parent_b_uuid="+parent_b,
            "-v","super_admin_uuid="+sa,
            "-f","/tmp/"+ag33.POLICY_FILE,
            marker="AG3.3 SYNTHETIC PARENT AND SUPER ADMIN SCOPE VERIFIED")
        if sql("-At","-c",ag33.POST_STATE_SQL)!=ag33.EXPECTED_POST_STATE:
            raise ParityFailure("AG3.3 role baseline changed")
        items.append(("Real Owner/Coach/three Parent/Super Admin JWT mappings","PASS"))

        stage_label="install exact five live Parent policies and active helper"
        sql("-f","/tmp/"+FIXTURE,
            marker="AG3.4C EXACT PARENT POLICY AND HELPER SNAPSHOT VERIFIED")
        if sql("-At","-c",'''SELECT (SELECT count(*) FROM pg_proc p
            JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='private'),
            (SELECT count(*) FROM pg_policies WHERE schemaname='public'
              AND tablename='players');''')!="12|2":
            raise ParityFailure("Post-snapshot helper count unexpected")
        ag33.wait_for_player_relation(key,token_a1)
        items.append(("Exact 5 SELECT policies + source-attested active Parent helper","PASS"))

        a1=parent(ag33.PLAYER_A1,ag33.PARENT_A1_ID,ag3.BATCH_A,ag3.ACADEMY_A)
        a2=parent(ag33.PLAYER_A2,ag33.PARENT_A2_ID,ag32.BATCH_INACTIVE_A,ag3.ACADEMY_A)
        bb=parent(ag33.PLAYER_B,ag33.PARENT_B_ID,ag3.BATCH_B,ag3.ACADEMY_B)
        p1=parent_record(ag33.PARENT_A1_ID,parent_a1,ag3.ACADEMY_A)
        p2=parent_record(ag33.PARENT_A2_ID,parent_a2,ag3.ACADEMY_A)
        pb=parent_record(ag33.PARENT_B_ID,parent_b,ag3.ACADEMY_B)
        ba=[{"id":ag3.BATCH_A,"academy_id":ag3.ACADEMY_A}]
        ba2=[{"id":ag32.BATCH_INACTIVE_A,"academy_id":ag3.ACADEMY_A}]
        bB=[{"id":ag3.BATCH_B,"academy_id":ag3.ACADEMY_B}]

        stage_label="active Parent own and other-parent/academy isolation"
        for token,record,player_row,batch_rows in (
            (token_a1,p1,a1,ba),(token_a2,p2,a2,ba2),(token_b,pb,bb,bB)):
            ag33.expect_rows(key,token,"parents",[record])
            ag33.expect_rows(key,token,"players",[player_row])
            ag32.read_scoped(key,token,batch_rows)
        for token,other_player,other_parent,other_batch in (
            (token_a1,ag33.PLAYER_A2,ag33.PARENT_A2_ID,ag32.BATCH_INACTIVE_A),
            (token_a2,ag33.PLAYER_A1,ag33.PARENT_A1_ID,ag3.BATCH_A),
            (token_b,ag33.PLAYER_A1,ag33.PARENT_A1_ID,ag3.BATCH_A)):
            ag33.expect_rows(key,token,"players",[],row_filter=other_player)
            ag33.expect_rows(key,token,"parents",[],row_filter=other_parent)
            ag32.read_scoped(key,token,[],row_filter=other_batch)
        items.append(("Active Parent link and same-academy / cross-tenant denial","PASS"))

        stage_label="inactive Parent revocation against unchanged JWT"
        set_parent_active(ag33.PARENT_A1_ID,False)
        ag33.expect_rows(key,token_a1,"parents",[])
        ag33.expect_rows(key,token_a1,"players",[])
        ag32.read_scoped(key,token_a1,[])
        ag33.expect_rows(key,owner_a_token,"players",[a1,a2])
        ag33.expect_rows(key,token_sa,"players",[a1,a2,bb])
        set_parent_active(ag33.PARENT_A1_ID,True)
        ag33.expect_rows(key,token_a1,"parents",[p1])
        ag33.expect_rows(key,token_a1,"players",[a1])
        items.append(("Deactivated Parent loses record, player and batch while JWT remains valid","PASS"))

        stage_label="role change invalidates Parent rights"
        set_app_role(parent_a1,"coach")
        ag33.expect_rows(key,token_a1,"parents",[])
        ag33.expect_rows(key,token_a1,"players",[])
        ag32.read_scoped(key,token_a1,[])
        set_app_role(parent_a1,"parent")
        ag33.expect_rows(key,token_a1,"players",[a1])
        items.append(("Parent role changed in DB denies access without JWT refresh","PASS"))

        stage_label="Coach active and inactive Player read; Super Admin global"
        ag33.expect_rows(key,coach_a_token,"players",[a1])
        ag33.expect_rows(key,coach_a_token,"parents",[p1])
        ag33.expect_rows(key,coach_a_token,"players",[],row_filter=ag33.PLAYER_A2)
        ag33.expect_rows(key,coach_b_token,"players",[bb])
        ag33.expect_rows(key,token_sa,"players",[a1,a2,bb])
        ag33.expect_rows(key,token_sa,"parents",[p1,p2,pb])
        ag33.expect_rows(key,smoke_token,"players",[])
        items.append(("Coach active batch only, SA global, unmapped account denied","PASS"))

        stage_label="fresh SQL and JWT/header regression"
        if sql("-At","-c",'''SELECT (SELECT count(*) FROM auth.users),
            (SELECT count(*) FROM public.users),
            (SELECT count(*) FROM public.parents WHERE is_active),
            (SELECT count(*) FROM public.players),
            (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='private');''')!="9|8|3|3|12":
            raise ParityFailure("Final synthetic state drift")
        ag33.expect_rows(key,token_a1,"players",[a1],
                         extra_headers={"x-user-id":sa,"x-academy-id":ag3.ACADEMY_B})
        for table in ("parents","players","batches"):
            ag33.expect_denial(key,None,table)
            ag33.expect_denial(key,"invalid.ag34c.bearer",table)
        items.append(("Final SQL integrity and forged headers/anon/invalid JWT denial","PASS"))
        report(items,True)
        print("AG3.4C PASS: exact live Parent helper and SELECT policy JWT parity",flush=True)
        return 0
    except (ParityFailure,ag2.Ag2Error,ag3.Ag3Failure,ag32.Ag32Failure,
            ag33.Ag33Failure,OSError,subprocess.TimeoutExpired,TypeError,KeyError,ValueError) as err:
        items.append((stage_label,"FAIL"))
        report(items,False)
        reason=str(err) if isinstance(err,ParityFailure) else "diagnostics withheld"
        print("AG3.4C FAIL at "+stage_label+"; "+reason,flush=True)
        return 1

if __name__=="__main__":
    sys.exit(main())
