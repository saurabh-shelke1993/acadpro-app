#!/usr/bin/env python3
"""AG3.4C2 exact-source parent/Coach/SA SELECT parity via signed disposable JWTs."""
from __future__ import annotations
import os
from pathlib import Path
import subprocess
import sys
import time

import ag2_real_auth_ci as ag2
import ag3_real_jwt_rls_ci as ag3
import ag3_2_coach_jwt_rls_ci as ag32
import ag3_3_parent_sa_jwt_rls_ci as ag33
import ag3_4b_live_mapping_ci as ag34b

PROJECT="kheltriva-ag34c2-ci"
CONTAINER="supabase_db_"+PROJECT
POLICY_FILE="ag34c2_live_parent_coach_sa_select.sql"
FIXTURE=Path(__file__).resolve().parents[2]/"supabase/tests/security"
EXPECTED_COUNTS="9|8|3|3|3|5|2|2|12"

class C2Failure(Exception):
    pass

def sql(*args: str, marker: str | None=None) -> str:
    return ag34b.sql(*args,marker=marker)

def counts() -> str:
    return sql("-At","-c","""SELECT (SELECT count(*) FROM auth.users),
    (SELECT count(*) FROM public.users),
    (SELECT count(*) FROM public.parents),
    (SELECT count(*) FROM public.players),
    (SELECT count(*) FROM public.batches),
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='batches'),
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='parents'),
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='players'),
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
     WHERE n.nspname='private');""")

def stage() -> None:
    for fname in (*ag2.FIXTURES,ag3.POLICY_FILE,ag32.POLICY_FILE,ag33.POLICY_FILE):
        path=ag2.FIXTURE_PATH/fname
        if not path.is_file():
            raise C2Failure("Pinned AG2/AG3 fixture missing")
        ag34b.safe(["docker","cp",str(path),CONTAINER+":/tmp/"+fname])
    path=FIXTURE/POLICY_FILE
    if not path.is_file():
        raise C2Failure("Attested AG3.4C2 SQL missing")
    ag34b.safe(["docker","cp",str(path),CONTAINER+":/tmp/"+POLICY_FILE])

def rparent(user: str,id: str,academy: str)->dict:
    return {"id":id,"user_id":user,"academy_id":academy}

def rplayer(id: str, parent: str,batch: str,academy: str)->dict:
    return {"id":id,"parent_id":parent,"batch_id":batch,"academy_id":academy}

def batch(id: str,academy: str)->dict:
    return {"id":id,"academy_id":academy}

def main() -> int:
    steps=[]
    checkpoint="preflight"
    ag34b.CONTAINER=CONTAINER
    try:
        scratch=Path(os.environ.get("RUNNER_TEMP","/non-ci"))/PROJECT
        if (os.environ.get("GITHUB_ACTIONS")!="true"
            or os.environ.get("GITHUB_REPOSITORY")!="saurabh-shelke1993/acadpro-app"
            or os.environ.get("SUPABASE_ACCESS_TOKEN")
            or os.environ.get("SUPABASE_DB_URL")
            or Path.cwd().resolve()!=scratch.resolve()
            or not (scratch/"supabase"/"config.toml").is_file()
            or (scratch/"supabase"/"migrations").exists()
            or (scratch/"supabase"/".temp"/"project-ref").exists()):
            raise C2Failure("Refusing non-disposable CI context")
        if ag34b.safe(["docker","inspect","-f","{{.State.Health.Status}}",CONTAINER])!="healthy":
            raise C2Failure("Scratch DB unhealthy")
        process=subprocess.run(["supabase","status","-o","env"],
                               capture_output=True,text=True,timeout=30)
        if process.returncode:
            raise C2Failure("Native Supabase CLI not ready")
        key=ag2.local_status(process.stdout)
        stage()
        steps.append("unlinked native Supabase: PASS")

        checkpoint="existing AG2/AG3 role bootstrap"
        sql("-f","/tmp/"+ag2.FIXTURES[0],marker="COMMIT")
        sql("--single-transaction","-f","/tmp/"+ag2.FIXTURES[1],
            "-f","/tmp/"+ag2.FIXTURES[2],"-f","/tmp/"+ag2.FIXTURES[3],
            marker="C3.3B CURRENT HELPERS VERIFIED")
        smoke,smoke_token=ag3.signup_with_token(key,"c34a")
        owner_a,token_oa=ag3.signup_with_token(key,"c34b1-ao-a")
        sql("--single-transaction","-v","owner_uuid="+owner_a,
            "-f","/tmp/"+ag2.FIXTURES[4],
            marker="B2.9-C3.4B1 OWNER A MAPPING VERIFIED")
        owner_b,token_ob=ag3.signup_with_token(key,"c34b2-ao-b")
        sql("--single-transaction","-v","owner_uuid="+owner_b,
            "-f","/tmp/"+ag2.FIXTURES[5],
            marker="B2.9-C3.4B2 OWNER B MAPPING VERIFIED")
        if sql("-At","-c",ag2.STATE_SQL)!=ag2.EXPECTED:
            raise C2Failure("AG2 source baseline mismatched")
        sql("--single-transaction","-f","/tmp/"+ag3.POLICY_FILE,
            marker="AG3 SYNTHETIC OWNER RLS POLICY VERIFIED")
        coach_a,token_ca=ag3.signup_with_token(key,"ag32-coach-a")
        coach_b,token_cb=ag3.signup_with_token(key,"ag32-coach-b")
        sql("--single-transaction","-v","coach_a_uuid="+coach_a,
            "-v","coach_b_uuid="+coach_b,
            "-f","/tmp/"+ag32.POLICY_FILE,
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
            raise C2Failure("AG3.3 source baseline mismatched")
        if len({smoke,owner_a,owner_b,coach_a,coach_b,parent_a1,parent_a2,parent_b,sa})!=9:
            raise C2Failure("GoTrue JWT identity collision")
        steps.append("nine real role JWTs and original synthetic fixtures: PASS")

        checkpoint="install deployed exact SELECT predicates"
        sql("-f","/tmp/"+POLICY_FILE,
            marker="AG3.4C2 EXACT LIVE PARENT COACH SA SELECT POLICY PARITY INSTALLED")
        if counts()!=EXPECTED_COUNTS:
            raise C2Failure("Exact-policy SQL count changed")
        ag33.wait_for_player_relation(key,token_a1)
        steps.append("six deployed policy checksums + active Parent helper MD5: PASS")

        pa1=rparent(parent_a1,ag33.PARENT_A1_ID,ag3.ACADEMY_A)
        pa2=rparent(parent_a2,ag33.PARENT_A2_ID,ag3.ACADEMY_A)
        pb=rparent(parent_b,ag33.PARENT_B_ID,ag3.ACADEMY_B)
        pla1=rplayer(ag33.PLAYER_A1,ag33.PARENT_A1_ID,ag3.BATCH_A,ag3.ACADEMY_A)
        pla2=rplayer(ag33.PLAYER_A2,ag33.PARENT_A2_ID,ag32.BATCH_INACTIVE_A,ag3.ACADEMY_A)
        plb=rplayer(ag33.PLAYER_B,ag33.PARENT_B_ID,ag3.BATCH_B,ag3.ACADEMY_B)
        ba1=batch(ag3.BATCH_A,ag3.ACADEMY_A)
        ba2=batch(ag32.BATCH_INACTIVE_A,ag3.ACADEMY_A)
        bb=batch(ag3.BATCH_B,ag3.ACADEMY_B)

        checkpoint="Parent positive/negative source-predicate parity"
        for token,p,pplayer,pbatch in [
            (token_a1,pa1,pla1,ba1),(token_a2,pa2,pla2,ba2),
            (token_b,pb,plb,bb)]:
            ag33.expect_rows(key,token,"parents",[p])
            ag33.expect_rows(key,token,"players",[pplayer])
            ag32.read_scoped(key,token,[pbatch])
            for other in (pa1,pa2,pb):
                if other["id"]!=p["id"]:
                    ag33.expect_rows(key,token,"parents",[],row_filter=other["id"])
            for other in (pla1,pla2,plb):
                if other["id"]!=pplayer["id"]:
                    ag33.expect_rows(key,token,"players",[],row_filter=other["id"])
            for other in (ba1,ba2,bb):
                if other["id"]!=pbatch["id"]:
                    ag32.read_scoped(key,token,[],row_filter=other["id"])
        steps.append("same-academy other-parent and foreign academy isolated: PASS")

        checkpoint="inactive Parent A2 access regression"
        sql("-c","UPDATE public.parents SET is_active=false WHERE id='"+ag33.PARENT_A2_ID+"'")
        ag33.expect_rows(key,token_a2,"parents",[])
        ag33.expect_rows(key,token_a2,"players",[])
        ag32.read_scoped(key,token_a2,[])
        ag33.expect_rows(key,token_a1,"parents",[pa1])
        ag33.expect_rows(key,token_sa,"parents",[pa1,pa2,pb])
        ag33.expect_rows(key,token_sa,"players",[pla1,pla2,plb])
        ag32.read_scoped(key,token_sa,[ba1,ba2,bb])
        sql("-c","UPDATE public.parents SET is_active=true WHERE id='"+ag33.PARENT_A2_ID+"'")
        ag33.expect_rows(key,token_a2,"parents",[pa2])
        ag33.expect_rows(key,token_a2,"players",[pla2])
        steps.append("deactivated Parent denied; SA sees row; reactivation restores: PASS")

        checkpoint="Coach and Owner source-select role regression"
        ag33.expect_rows(key,token_oa,"parents",[pa1,pa2])
        ag33.expect_rows(key,token_oa,"players",[pla1,pla2])
        ag33.expect_rows(key,token_ob,"parents",[pb])
        ag33.expect_rows(key,token_ob,"players",[plb])
        ag33.expect_rows(key,token_ca,"players",[pla1])
        ag33.expect_rows(key,token_ca,"parents",[pa1])
        ag33.expect_rows(key,token_cb,"players",[plb])
        ag33.expect_rows(key,token_cb,"parents",[pb])
        ag32.read_scoped(key,token_ca,[ba1])
        ag32.read_scoped(key,token_ca,[],row_filter=ag32.BATCH_INACTIVE_A)
        ag32.read_scoped(key,token_oa,[ba1,ba2])
        ag32.read_scoped(key,token_ob,[bb])
        steps.append("Owner/Coach active assignment vs inactive cross-scope: PASS")

        checkpoint="unmapped/anon/forged header denial"
        ag33.expect_rows(key,smoke_token,"parents",[])
        ag33.expect_rows(key,smoke_token,"players",[])
        ag32.read_scoped(key,smoke_token,[])
        for table in ("parents","players","batches"):
            ag33.expect_denial(key,None,table)
            ag33.expect_denial(key,"invalid.ag34c2.bearer",table)
        ag33.expect_rows(key,token_a1,"players",[pla1],
                         extra_headers={"x-user-id":sa,"x-academy-id":ag3.ACADEMY_B})
        ag32.read_scoped(key,token_a1,[ba1],
                         extra_headers={"x-user-id":sa,"x-academy-id":ag3.ACADEMY_B})
        if counts()!=EXPECTED_COUNTS:
            raise C2Failure("Source-aligned scratch postflight diverged")
        if sql("-At","-c","SELECT count(*) FROM public.parents WHERE is_active=true")!="3":
            raise C2Failure("Scratch Parent activation not restored")
        steps.append("anonymous/unmapped/token spoofing blocked; counts intact: PASS")
        steps.append("LIMIT: only six SELECT policies + single helper are source-aligned")
        print("AG3.4C2 PASS: exact six live SELECT policies, inactive Parent and real-JWT role regressions",flush=True)
        return 0
    except (C2Failure,ag34b.SecurityMismatch,ag33.Ag33Failure,ag32.Ag32Failure,
            ag3.Ag3Failure,ag2.Ag2Error,ValueError,KeyError,TypeError,OSError,
            subprocess.TimeoutExpired):
        print("AG3.4C2 FAIL at: "+checkpoint+"; JWTs/secrets withheld",flush=True)
        return 1
    finally:
        for item in steps:
            print("AG3.4C2 "+item,flush=True)

if __name__=="__main__":
    sys.exit(main())
