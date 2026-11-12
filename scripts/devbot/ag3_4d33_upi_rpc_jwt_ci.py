#!/usr/bin/env python3
"""AG3.4D3.3 genuine GoTrue JWT UPI regressions on an unlinked disposable database.

Prerequisites in the SAME scratch instance: C2, D1, D3.1 and D3.2.
Never invoke hosted endpoints, apply migrations, access customer data or deploy.
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
FIXTURE_ROOT = Path(__file__).resolve().parents[2] / "supabase/tests/security"
ORIGINAL = "ag34d33_live_upi_rpcs_scratch.sql"
CANDIDATE = "ag34d33_upi_null_role_scratch_candidate.sql"
RPCS = ("submit_parent_upi_payment", "review_parent_upi_payment",
        "record_accepted_parent_upi_submission")
DUE_A, DUE_B = d1.DUE_IDS[0], d1.DUE_IDS[2]
PARENT_A, PARENT_B = d1.PARENT_IDS[0], d1.PARENT_IDS[2]
ACADEMY_A, ACADEMY_B = d1.A, d1.B
ROLE_SUBMIT = "Only a parent can submit a UPI payment claim"
ROLE_REVIEW = "Only the Academy Owner can review UPI payment claims"
ROLE_RECORD = "Only the Academy Owner can record an accepted parent UPI claim"
TENANT_REVIEW = "You are not authorized to review this academy payment claim"
TENANT_RECORD = "You are not authorized to record this academy payment claim"


class UpiFailure(Exception):
    pass


def uuid(value: str) -> bool:
    return bool(re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", value))


def rpc(key: str, token: str | None, fn: str, payload: dict) -> tuple[int, object]:
    if fn not in RPCS:
        raise ValueError("RPC outside approved scratch scope")
    headers = {"apikey": key, "Accept": "application/json",
               "Content-Type": "application/json"}
    if token is not None:
        headers["Authorization"] = "Bearer " + token
    request = Request(ag3.API_URL + "/rest/v1/rpc/" + fn,
                      method="POST", headers=headers, data=json.dumps(payload).encode())
    try:
        with urlopen(request, timeout=30) as response:
            data = response.read()
            return response.status, json.loads(data) if data else None
    except HTTPError as error:
        try:
            data = json.loads(error.read())
        except (ValueError, TypeError):
            data = {}
        return error.code, data if isinstance(data, dict) else {}
    except (URLError, TimeoutError):
        raise UpiFailure("Disposable PostgREST unavailable") from None


def submit(due: str, amount: int, utr: str) -> dict:
    return {"p_due_id": due, "p_amount": amount,
            "p_transaction_reference": utr, "p_payment_date": "2026-11-10",
            "p_parent_note": "AG34D33 invented reference"}


def review(claim: str, decision: str = "accepted") -> dict:
    return {"p_submission_id": claim, "p_decision": decision,
            "p_review_note": "AG34D33 verified synthetic claim"}


def record(claim: str) -> dict:
    return {"p_submission_id": claim}


def snapshot() -> str:
    """All synthetic claim, due, payment and sequence state, not customer data."""
    return d1.sql("-At", "-c", """
    SELECT
      coalesce((SELECT string_agg(id::text||':'||status||':'||
           coalesce(payment_id::text,'-')||':'||coalesce(reviewed_by_user_id::text,'-'),
           ';' ORDER BY id) FROM public.parent_payment_submissions),'')
      || '|' || coalesce((SELECT string_agg(id::text||':'||paid_amount::text||':'||
           due_status, ';' ORDER BY id) FROM public.payment_dues),'')
      || '|' || (SELECT count(*) FROM public.payments)::text
      || '|' || (SELECT coalesce(sum(next_value),0) FROM public.payment_number_counters)::text;
    """)


def deny(key: str, token: str | None, fn: str, args: dict, expected: str) -> None:
    before = snapshot()
    status, body = rpc(key, token, fn, args)
    if status not in (400, 401, 403) or not isinstance(body, dict):
        raise UpiFailure("UPI RPC did not deny unauthorized/invalid call")
    if expected not in str(body.get("message", "")):
        raise UpiFailure("UPI RPC denial did not reach the expected guard")
    if snapshot() != before:
        raise UpiFailure("Denied UPI RPC modified financial or claim state")


def allowed(key: str, token: str, fn: str, args: dict, status: str) -> dict:
    code, body = rpc(key, token, fn, args)
    if code != 200 or not isinstance(body, dict) or body.get("status") != status:
        raise UpiFailure("Authorized UPI call returned invalid status/contract")
    if not uuid(str(body.get("id" if fn != "record_accepted_parent_upi_submission"
                              else "submission_id", ""))):
        raise UpiFailure("Authorized UPI call did not return a claim UUID")
    return body


def claim_state(claim: str) -> str:
    if not uuid(claim):
        raise UpiFailure("Invalid invented claim UUID")
    return d1.sql("-At", "-c", "SELECT status||'|'||coalesce(payment_id::text,'-') "
                  "FROM public.parent_payment_submissions WHERE id='" + claim + "'::uuid")


def seed(claim_status: str, academy: str, parent: str, due: str,
         player: str, utr: str, amount: int) -> str:
    if not all(uuid(x) for x in (academy, parent, due, player)):
        raise UpiFailure("Invalid invented seed identifiers")
    if claim_status not in ("pending", "accepted") or not re.fullmatch(r"[A-Z0-9_-]+", utr):
        raise UpiFailure("Invalid seed parameters")
    result = d1.sql("-At", "-c",
        "INSERT INTO public.parent_payment_submissions "
        "(academy_id,parent_id,player_id,due_id,amount,transaction_reference,"
        "payment_date,status) VALUES ('" + academy + "'::uuid,'" + parent +
        "'::uuid,'" + player + "'::uuid,'" + due + "'::uuid," + str(amount) +
        ",'" + utr + "',CURRENT_DATE,'" + claim_status + "') RETURNING id::text")
    claim = result.splitlines()[0] if result else ""
    if not uuid(claim):
        raise UpiFailure("Could not seed disposable UPI claim")
    return claim


def sql_copy(filename: str, marker: str) -> None:
    ag34b.safe(["docker", "cp", str(FIXTURE_ROOT / filename),
                CONTAINER + ":/tmp/" + filename])
    d1.sql("--single-transaction", "-f", "/tmp/" + filename, marker=marker)


def context() -> str:
    root = Path(os.environ.get("RUNNER_TEMP", "/non-github-actions")) / PROJECT
    if (os.environ.get("GITHUB_ACTIONS") != "true"
        or os.environ.get("GITHUB_REPOSITORY") != "saurabh-shelke1993/acadpro-app"
        or os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_DB_URL")
        or Path.cwd().resolve() != root.resolve()
        or not (root / "supabase/config.toml").is_file()
        or (root / "supabase/migrations").exists()
        or (root / "supabase/.temp/project-ref").exists()
        or d1.sql("-At", "-c", "SELECT count(*) FROM auth.users") != "29"
        or d1.sql("-At", "-c", "SELECT count(*) FROM public.users") != "26"
        or d1.sql("-At", "-c", "SELECT count(*) FROM public.payment_dues") != "5"
        or d1.sql("-At", "-c", "SELECT count(*) FROM public.parent_payment_submissions") != "3"
        or any(not (FIXTURE_ROOT / f).is_file() for f in (ORIGINAL, CANDIDATE))):
        raise UpiFailure("Refusing unexpected, linked or non-disposable D3.2 baseline")
    response = subprocess.run(["supabase", "status", "-o", "env"],
                              text=True, capture_output=True, timeout=30, check=False)
    if response.returncode:
        raise UpiFailure("Disposable native Supabase not running")
    return ag2.local_status(response.stdout)


def main() -> int:
    stage = "disposable context preflight"
    ag34b.CONTAINER = CONTAINER
    try:
        key = context()
        stage = "original RPC source and ACL installation"
        sql_copy(ORIGINAL, "AG3.4D3.3 EXACT ORIGINAL UPI RPCS SOURCE MATCHED IN SCRATCH")
        stage = "fresh genuine signed JWT identities"
        labels = ("owner-a", "owner-b", "parent-a", "parent-b",
                  "coach", "super-admin", "unmapped")
        users = {label: ag3.signup_with_token(key, "ag34d33-" + label)
                 for label in labels}
        if len({value[0] for value in users.values()}) != 7:
            raise UpiFailure("Duplicate disposable GoTrue UUIDs")
        for label, role, academy in (
                ("owner-a", "academy_owner", ACADEMY_A),
                ("owner-b", "academy_owner", ACADEMY_B),
                ("parent-a", "parent", ACADEMY_A),
                ("parent-b", "parent", ACADEMY_B),
                ("coach", "coach", ACADEMY_A),
                ("super-admin", "super_admin", None)):
            user_id = users[label][0]
            if not uuid(user_id):
                raise UpiFailure("Invalid signed identity")
            academy_sql = "'" + academy + "'::uuid" if academy else "NULL"
            d1.sql("-c", "INSERT INTO public.users (id,academy_id,role) VALUES ('" +
                   user_id + "'::uuid," + academy_sql + ",'" + role + "')")
        if d1.sql("-At", "-c", "SELECT count(*) FROM auth.users") != "36":
            raise UpiFailure("Unexpected signed-JWT identity count")
        tokens = {label: data[1] for label, data in users.items()}

        stage = "schema cache recognized original UPI signature"
        ready = False
        for _ in range(26):
            code, body = rpc(key, tokens["owner-a"], "submit_parent_upi_payment",
                             submit(DUE_A, -1, "AG34D33_BAD"))
            if (code == 400 and isinstance(body, dict)
                and ROLE_SUBMIT in str(body.get("message", ""))):
                ready = True
                break
            time.sleep(0.5)
        if not ready:
            raise UpiFailure("Source RPC exposure or role guard not available")

        stage = "source original unmapped Parent submission denied by existing FK relationship"
        unmapped_id = users["unmapped"][0]
        if not uuid(unmapped_id):
            raise UpiFailure("Invalid unmapped test identity")
        # parents.user_id -> public.users.id and users.role is non-NULL in hosted.
        # Never disable the FK to invent a NULL-role Parent-submission exploit.
        deny(key, tokens["unmapped"], "submit_parent_upi_payment",
             submit(DUE_A, 5, "AG34D33_UNMAPPED"), "Parent profile not found")
        print("AG3.4D3.3 PASS: original unmapped Parent submission denied by linked-profile boundary",
              flush=True)

        stage = "original NULL-role Owner review reproduction on seeded pending claim"
        original_id = seed("pending", ACADEMY_A, PARENT_A, DUE_A,
                           d1.PLAYER_IDS[0], "AG34D33_ORIGINAL", 5)
        unchanged_ledger = d31.snapshot()
        accepted = allowed(key, tokens["unmapped"], "review_parent_upi_payment",
                           review(original_id), "accepted")
        if accepted.get("reviewed_by_user_id") != unmapped_id or d31.snapshot() != unchanged_ledger:
            raise UpiFailure("Original NULL-role review bypass or ledger non-mutation not proven")
        print("AG34-HIGH-002 D3.3 REPRODUCED: unmapped JWT reviewed a synthetic UPI claim",
              flush=True)

        stage = "original recording downstream NULL-safe tenant denial"
        deny(key, tokens["unmapped"], "record_accepted_parent_upi_submission",
             record(original_id), TENANT_RECORD)
        # The recording wrapper has a distinct-from check unlike the review RPC;
        # reject rather than claiming it is exploitable without a valid test path.
        d1.sql("-c", "UPDATE public.parents SET user_id='" + users["parent-a"][0] +
               "'::uuid WHERE id='" + PARENT_A + "'::uuid")
        d1.sql("-c", "UPDATE public.parents SET user_id='" + users["parent-b"][0] +
               "'::uuid WHERE id='" + PARENT_B + "'::uuid")
        if d1.sql("-At", "-c", "SELECT count(*) FROM public.users") != "32":
            raise UpiFailure("Fixture role mapping count changed")
        print("AG3.4D3.3 PASS: original recording's NULL-safe tenant guard blocked unmapped JWT",
              flush=True)

        stage = "install scratch-only strict UPI role and tenant candidates"
        sql_copy(CANDIDATE, "AG3.4D3.3 SCRATCH UPI ROLE CANDIDATES INSTALLED")
        for fn, args, error in (
            ("submit_parent_upi_payment", submit(DUE_A, 5, "AG34D33_NEG"), ROLE_SUBMIT),
            ("review_parent_upi_payment", review(original_id), ROLE_REVIEW),
            ("record_accepted_parent_upi_submission", record(original_id), ROLE_RECORD),
        ):
            for label in ("unmapped", "coach"):
                deny(key, tokens[label], fn, args, error)
        deny(key, tokens["parent-a"], "review_parent_upi_payment",
             review(original_id), ROLE_REVIEW)
        deny(key, tokens["super-admin"], "review_parent_upi_payment",
             review(original_id), ROLE_REVIEW)
        deny(key, tokens["super-admin"], "record_accepted_parent_upi_submission",
             record(original_id), ROLE_RECORD)
        deny(key, tokens["owner-b"], "review_parent_upi_payment",
             review(original_id), TENANT_REVIEW)
        deny(key, tokens["owner-b"], "record_accepted_parent_upi_submission",
             record(original_id), TENANT_RECORD)

        stage = "anonymous and forged bearer denied on all three UPI endpoints"
        for fn, args in (
            ("submit_parent_upi_payment", submit(DUE_A, 5, "AG34D33_NONE")),
            ("review_parent_upi_payment", review(original_id)),
            ("record_accepted_parent_upi_submission", record(original_id)),
        ):
            for token in (None, "invalid.ag34d33.jwt"):
                code, _ = rpc(key, token, fn, args)
                if code not in (401, 403, 404):
                    raise UpiFailure("Anon or forged JWT reached privileged UPI RPC")

        stage = "positive Owner A records verified parent claim only once"
        before_payment = d1.sql("-At", "-c", "SELECT count(*) FROM public.payments")
        result = allowed(key, tokens["owner-a"], "record_accepted_parent_upi_submission",
                         record(original_id), "recorded")
        payment_id = result.get("payment_id", "")
        if (not uuid(str(payment_id)) or not result.get("receipt_number")
            or result.get("external_transaction_reference") != "AG34D33_ORIGINAL"
            or claim_state(original_id) != "recorded|" + payment_id
            or d31.due_state(DUE_A) != "95|partial"
            or int(d1.sql("-At", "-c", "SELECT count(*) FROM public.payments")) !=
                int(before_payment) + 1):
            raise UpiFailure("Recorded claim payment/UTR/receipt/due invariant failed")
        deny(key, tokens["owner-a"], "record_accepted_parent_upi_submission",
             record(original_id), "already been recorded")

        stage = "positive Parent A submits, Owner accepts, then records final due"
        new_claim = allowed(key, tokens["parent-a"], "submit_parent_upi_payment",
                            submit(DUE_A, 5, "AG34D33_FINAL"), "pending")
        claim = new_claim["id"]
        deny(key, tokens["parent-a"], "submit_parent_upi_payment",
             submit(DUE_A, 5, "AG34D33_FINAL"), "already been submitted")
        deny(key, tokens["parent-a"], "submit_parent_upi_payment",
             submit(DUE_A, 5, "AG34D33_ACTIVE"), "duplicate key")
        # Review is explicitly nonfinancial; collect occurs only after separate record action.
        before_review = d31.snapshot()
        allowed(key, tokens["owner-a"], "review_parent_upi_payment",
                review(claim), "accepted")
        if d31.snapshot() != before_review:
            raise UpiFailure("Review changed due/payment ledger")
        allowed(key, tokens["owner-a"], "record_accepted_parent_upi_submission",
                record(claim), "recorded")
        if d31.due_state(DUE_A) != "100|paid":
            raise UpiFailure("Full payment did not close synthetic due")

        stage = "foreign Parent due denial and over-balance validation"
        deny(key, tokens["parent-a"], "submit_parent_upi_payment",
             submit(DUE_B, 5, "AG34D33_FOREIGN"),
             "You are not authorized to submit a claim for this player")
        deny(key, tokens["parent-b"], "submit_parent_upi_payment",
             submit(DUE_B, 99, "AG34D33_OVERPAY"),
             "Claim amount cannot exceed the remaining due")
        rejected = allowed(key, tokens["parent-b"], "submit_parent_upi_payment",
                           submit(DUE_B, 10, "AG34D33_REJECT"), "pending")
        baseline = d31.snapshot()
        allowed(key, tokens["owner-b"], "review_parent_upi_payment",
                review(rejected["id"], "rejected"), "rejected")
        if d31.snapshot() != baseline:
            raise UpiFailure("Rejected claim changed ledger")

        stage = "stale accepted amount rejected atomically"
        stale = allowed(key, tokens["parent-b"], "submit_parent_upi_payment",
                        submit(DUE_B, 30, "AG34D33_STALE"), "pending")
        allowed(key, tokens["owner-b"], "review_parent_upi_payment",
                review(stale["id"]), "accepted")
        code, _ = d31.collect(key, tokens["owner-b"], DUE_B, 10)
        if code != 200:
            raise UpiFailure("Synthetic concurrent manual collection failed")
        deny(key, tokens["owner-b"], "record_accepted_parent_upi_submission",
             record(stale["id"]), "current remaining due is")
        if claim_state(stale["id"]) != "accepted|-":
            raise UpiFailure("Stale claim must remain accepted/unrecorded")
        print("AG3.4D3.3 PASS: review NULL-role bypass reproduced; submission/recording denied; candidate UPI and ledger invariants",
              flush=True)
        print("AG3.4D3.3 LIMIT: synthetic tables/triggers only; hosted HIGH-001/002 remain OPEN; AG3.4E NO_GO",
              flush=True)
        return 0
    except (UpiFailure, d1.FinanceFailure, d31.RpcFailure, ValueError, subprocess.TimeoutExpired):
        print("AG3.4D3.3 FAIL at " + stage + "; no private identifiers or credentials logged",
              file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
