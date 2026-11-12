#!/usr/bin/env python3
"""SEC-3: exact SEC-2 four-RPC source patch under *real* disposable GoTrue JWTs.

Requires green AG3.4C2 > D1 > D3.1 > D3.2 in one fresh, unlinked CI stack.
The original vulnerable bodies are restored from the SEC-2 review-only SQL
(after reversing ONLY the two authorization changes) and MD5-attested before
applying that EXACT SEC-2 SQL in disposable Postgres, never hosted Supabase.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import os
import re
import subprocess
import sys
import time

import ag2_real_auth_ci as ag2
import ag3_real_jwt_rls_ci as ag3
import ag3_4b_live_mapping_ci as ag34b
import ag3_4c2_live_parent_policy_ci as c2
import ag3_4d_finance_jwt_ci as d1
import ag3_4d3_collect_payment_jwt_ci as d31
import ag3_4d32_correction_rpc_jwt_ci as d32

ROOT = Path(__file__).resolve().parents[2]
REVIEW_SQL = ROOT / "supabase/review_only/HIGH002_FOUR_PAYMENT_RPC_FAIL_CLOSED_REVIEW_ONLY.sql"
PROJECT = c2.PROJECT
CONTAINER = c2.CONTAINER
EXPECTED = {
    "approve_payment_correction": ("approve_payment_correction(uuid)", "adfb6a80c05255e6d250207ae1e3ae1d"),
    "collect_payment": ("collect_payment(uuid,numeric,text,text)", "fcc5610c509392caf81ffa99b82051a9"),
    "reject_payment_correction": ("reject_payment_correction(uuid,text)", "c21c953c1ac3e9afa201e5ec7c28c4e5"),
    "request_payment_correction": ("request_payment_correction(uuid,numeric,text)", "9e2900dd0a7c960554896e0e51b23075"),
}
ROLE_ERROR = {
    "collect_payment": "Only Academy Owner or Super Admin can collect payments",
    **d32.ROLE_ERROR,
}
DUE_A = "d3000000-0000-4000-8000-000000000101"
DUE_A2 = "d3000000-0000-4000-8000-000000000102"
DUE_B = "d3000000-0000-4000-8000-000000000103"
DUE_RACE = "d3000000-0000-4000-8000-000000000104"


class Sec3Failure(Exception):
    pass


def extract_original_review_functions(review: str) -> str:
    """Construct verbatim original pg_get_functiondef bodies for source attestation.

    Never modifies repo files; scratch originals are installed only in an
    ephemeral, unlinked CI Postgres after the older test runners have finished.
    """
    sql = []
    for name in EXPECTED:
        pattern = re.compile(
            r"^CREATE OR REPLACE FUNCTION public\." + re.escape(name)
            + r"\([^\n]*\)[\s\S]*?^\$function\$;",
            re.MULTILINE,
        )
        matches = list(pattern.finditer(review))
        if len(matches) != 1:
            raise Sec3Failure("Reviewed SQL must contain one exact original function: " + name)
        patched = matches[0].group(0)
        new_role = "if v_role is null or v_role not in ('super_admin', 'academy_owner') then"
        old_role = "if v_role not in ('super_admin', 'academy_owner') then"
        helper = ("private.is_payment_due_in_current_academy"
                  if name == "collect_payment" else "private.is_payment_player_in_current_academy")
        owner_guard = re.compile(
            r"and (" + re.escape(helper) + r"\([^)]*\)) is not true then"
        )
        if patched.count(new_role) != 1 or len(owner_guard.findall(patched)) != 1:
            raise Sec3Failure("Unexpected SEC-2 guard shape in " + name)
        original = patched.replace(new_role, old_role).replace(
            owner_guard.search(patched).group(0),
            "and not " + owner_guard.search(patched).group(1) + " then",
        )
        if original == patched or new_role in original:
            raise Sec3Failure("Reversal failed; refusing to apply review patch")
        sql.append(original)
    return "\n\n".join(sql) + "\nSELECT pg_notify('pgrst','reload schema');\n"


def scratch_preflight() -> tuple[Path, str]:
    root = Path(os.environ.get("RUNNER_TEMP", "/unsafe")) / PROJECT
    if (os.environ.get("GITHUB_ACTIONS") != "true"
        or os.environ.get("GITHUB_REPOSITORY") != "saurabh-shelke1993/acadpro-app"
        or os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_DB_URL")
        or Path.cwd().resolve() != root.resolve()
        or not (root / "supabase/config.toml").is_file()
        or (root / "supabase/migrations").exists()
        or (root / "supabase/.temp/project-ref").exists()
        or not REVIEW_SQL.is_file()
        or d1.sql("-At", "-c", "SELECT count(*) FROM auth.users") != "29"
        or d1.sql("-At", "-c", "SELECT count(*) FROM public.users") != "26"
        or d1.sql("-At", "-c", "SELECT count(*) FROM public.payment_corrections") == ""
        or d1.sql("-At", "-c", "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private'") != "21"):
        raise Sec3Failure("SEC-3 refuses non-disposable or drifted original D3.2 context")
    status = subprocess.run(["supabase", "status", "-o", "env"], capture_output=True,
                            text=True, timeout=30)
    if status.returncode:
        raise Sec3Failure("Unlinked Supabase stack is not healthy")
    return root, ag2.local_status(status.stdout)


def original_fingerprints() -> dict[str, str]:
    return {
        name: d1.sql("-At", "-c", "SELECT md5(pg_get_functiondef('public."
                     + signature + "'::regprocedure))")
        for name, (signature, _) in EXPECTED.items()
    }


def install_reviewed_patch(root: Path) -> None:
    reviewed = REVIEW_SQL.read_text(encoding="utf-8")
    if ("BEGIN;" not in reviewed or "high002_source_preflight" not in reviewed
        or reviewed.count("CREATE OR REPLACE FUNCTION public.") != 4):
        raise Sec3Failure("Review-only SQL has changed unexpectedly")
    original = extract_original_review_functions(reviewed)
    local_original = root / "high002-sec3-original-scratch-only.sql"
    local_original.write_text(original, encoding="utf-8")
    ag34b.safe(["docker", "cp", str(local_original),
                CONTAINER + ":/tmp/high002-sec3-original.sql"])
    d1.sql("--single-transaction", "-f", "/tmp/high002-sec3-original.sql")
    if original_fingerprints() != {
        name: expected for name, (_, expected) in EXPECTED.items()
    }:
        raise Sec3Failure("Restored original function sources are not identical to hosted source MD5s")
    print("SEC-3 PASS: restored all FOUR original hosted function source MD5s in scratch", flush=True)

    ag34b.safe(["docker", "cp", str(REVIEW_SQL),
                CONTAINER + ":/tmp/high002-sec3-reviewed-patch.sql"])
    d1.sql("-f", "/tmp/high002-sec3-reviewed-patch.sql")
    # The review patch includes a one-shot original-source MD5 preflight.
    # We verify the expected guards, preserved grants and unchanged return
    # contracts on the actual compiled Postgres definitions after installation.
    for name, (signature, original_md5) in EXPECTED.items():
        current_md5 = d1.sql("-At", "-c",
                            "SELECT md5(pg_get_functiondef('public."
                            + signature + "'::regprocedure))")
        if current_md5 == original_md5:
            raise Sec3Failure("Reviewed authorization patch was not applied: " + name)
        source = d1.sql("-At", "-c", "SELECT pg_get_functiondef('public."
                        + signature + "'::regprocedure)")
        if ("if v_role is null or v_role not in ('super_admin', 'academy_owner') then" not in source
            or "is not true then" not in source.lower()
            or "and not private.is_payment_" in source
            or "SECURITY DEFINER" not in source
            or "search_path TO ''" not in source
            or d1.sql("-At", "-c",
                      "SELECT has_function_privilege('authenticated','public."
                      + signature + "','EXECUTE')") != "t"
            or d1.sql("-At", "-c",
                      "SELECT has_function_privilege('anon','public."
                      + signature + "','EXECUTE')") != "f"):
            raise Sec3Failure("Compiled function guard, privileges or metadata drift: " + name)
    d1.sql("-c", "SELECT pg_notify('pgrst','reload schema')")
    print("SEC-3 PASS: EXACT reviewed four-function patch compiled; original signatures/ACL retained", flush=True)


def add_synthetic_fixtures(sessions: dict[str, tuple[str, str]]) -> None:
    for label in ("owner-a", "owner-b", "coach", "parent", "super-admin", "orphan-owner"):
        role = "super_admin" if label == "super-admin" else (
            "academy_owner" if label.startswith("owner") or label == "orphan-owner" else label
        )
        academy = ("NULL" if label in ("super-admin", "orphan-owner") else
                   "'a0000000-0000-4000-8000-000000000002'::uuid"
                   if label == "owner-b" else
                   "'a0000000-0000-4000-8000-000000000001'::uuid")
        d1.sql("-c", "INSERT INTO public.users(id,academy_id,role) VALUES ('"
               + sessions[label][0] + "'::uuid," + academy + ",'" + role + "')")
    if d1.sql("-At", "-c", "SELECT count(*) FROM public.users") != "32":
        raise Sec3Failure("Synthetic mapped role cardinality differs")

    players = d1.PLAYER_IDS
    for due, player in ((DUE_A, players[0]), (DUE_A2, players[1]),
                        (DUE_B, players[2]), (DUE_RACE, players[0])):
        d1.sql("-c", "INSERT INTO public.payment_dues(id,player_id,total_amount)"
               " VALUES ('" + due + "'::uuid,'" + player + "'::uuid,100)")


def check_identity_denials(key: str, tokens: dict[str, str]) -> None:
    before = d32.snapshot()
    for label in ("coach", "parent", "unmapped"):
        d31.deny(key, tokens[label], DUE_A, 10, ROLE_ERROR["collect_payment"])
    d31.deny(key, tokens["owner-b"], DUE_A, 10,
             "You are not authorized to collect this payment")
    d31.deny(key, tokens["orphan-owner"], DUE_A, 10,
             "You are not authorized to collect this payment")
    for tok in (None, "invalid.sec3.jwt"):
        code, _ = d31.collect(key, tok, DUE_A, 10)
        if code not in (401, 403, 404):
            raise Sec3Failure("Anonymous/forged signed token reached payment RPC")
    if d32.snapshot() != before:
        raise Sec3Failure("Unauthorized collection mutated ledger or counters")
    print("SEC-3 PASS: collect_payment denies Coach/Parent/unmapped/foreign/orphan Owner/anonymous", flush=True)


def check_correction_denials(key: str, tokens: dict[str, str],
                             a_payment: str, approve_id: str, reject_id: str) -> None:
    cases = (
        ("request_payment_correction", d32.request_args(a_payment, 35),
         "You are not authorized to correct this payment"),
        ("approve_payment_correction", d32.approve_args(approve_id),
         "You are not authorized to approve this correction"),
        ("reject_payment_correction", d32.reject_args(reject_id),
         "You are not authorized to reject this correction"),
    )
    for label in ("coach", "parent", "unmapped"):
        for fn, args, _ in cases:
            d32.deny(key, tokens[label], fn, args, ROLE_ERROR[fn])
    for label in ("owner-b", "orphan-owner"):
        for fn, args, expected in cases[:2]:
            d32.deny(key, tokens[label], fn, args, expected)
    d32.deny(key, tokens["owner-a"], cases[2][0], cases[2][1], cases[2][2])
    d32.deny(key, tokens["orphan-owner"], cases[2][0], cases[2][1], cases[2][2])
    before = d32.snapshot()
    for fn, args, _ in cases:
        for token in (None, "invalid.sec3.jwt"):
            code, _ = d32.rpc(key, token, fn, args)
            if code not in (401, 403, 404):
                raise Sec3Failure("Anonymous or forged JWT accepted by " + fn)
    if d32.snapshot() != before:
        raise Sec3Failure("Anonymous RPC changed due/correction/payment/counter state")
    print("SEC-3 PASS: all THREE corrections deny Coach/Parent/unmapped/foreign/orphan/anon JWT", flush=True)


def main() -> int:
    stage = "preflight"
    ag34b.CONTAINER = CONTAINER
    try:
        root, key = scratch_preflight()
        stage = "restore original source and apply exact reviewed patch"
        install_reviewed_patch(root)
        stage = "create real JWT sessions and synthetic dues"
        labels = ("owner-a", "owner-b", "coach", "parent", "super-admin",
                  "unmapped", "orphan-owner")
        sessions = {name: ag3.signup_with_token(key, "sec3-h002-" + name)
                    for name in labels}
        if len({v[0] for v in sessions.values()}) != len(labels):
            raise Sec3Failure("Synthetic signed-JWT identity collision")
        add_synthetic_fixtures(sessions)
        tokens = {label: value[1] for label, value in sessions.items()}
        stage = "collect unauthorized role and foreign-academy denials"
        check_identity_denials(key, tokens)

        stage = "authorized partial/full collection, receipts and concurrent lock"
        d31.deny(key, tokens["owner-a"], DUE_A, 0,
                 "Payment amount must be greater than zero")
        d31.deny(key, tokens["owner-a"], DUE_A, 10,
                 "Unsupported payment mode", mode="unsupported")
        d31.deny(key, tokens["owner-a"], DUE_A, 101,
                 "Payment exceeds the remaining due amount")
        d31.allow(key, tokens["owner-a"], DUE_A, 60, 40, "partial")
        d31.allow(key, tokens["owner-a"], DUE_A, 40, 0, "paid")
        d31.deny(key, tokens["owner-a"], DUE_A, 1, "already fully paid")
        d31.allow(key, tokens["owner-a"], DUE_A2, 80, 20, "partial")
        d31.allow(key, tokens["owner-b"], DUE_B, 70, 30, "partial")
        # SA can receive a valid payment for a different academy in the
        # same already-authenticated scratch stack.
        d31.allow(key, tokens["super-admin"], DUE_B, 10, 20, "partial")

        before = d32.snapshot()
        d31.deny(key, tokens["owner-a"], DUE_A2, 10,
                 "AG34D3 scratch transaction abort", remarks="AG34D3_ABORT")
        if d32.snapshot() != before:
            raise Sec3Failure("Forced late payment failure did not roll back counters and ledger")
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs = [pool.submit(d31.collect, key, tokens["owner-a"], DUE_RACE, 70)
                    for _ in range(2)]
            outcomes = [f.result(timeout=50) for f in jobs]
        ok = [r for r in outcomes if r[0] == 200]
        err = [r for r in outcomes if r[0] == 400]
        if (len(ok) != 1 or len(err) != 1
            or "Payment exceeds the remaining due amount" not in
               str(err[0][1].get("message", ""))
            or d31.due_state(DUE_RACE) != "70|partial"
            or d1.sql("-At","-c",
                      "SELECT count(*) FROM public.payments WHERE due_id='"
                      + DUE_RACE + "'::uuid") != "1"):
            raise Sec3Failure("Two concurrent browser requests produced invalid payments")
        print("SEC-3 PASS: AO/SA collections, receipts, partial/full, rollback, concurrent overpayment", flush=True)

        stage = "correction negative role/tenant probes"
        a_payment60 = d32.payment_id(DUE_A, 60)
        a_payment40 = d32.payment_id(DUE_A, 40)
        b_payment70 = d32.payment_id(DUE_B, 70)
        a2_payment80 = d32.payment_id(DUE_A2, 80)
        approve_pending = d32.seed_pending(a_payment60, 50, sessions["owner-a"][0])
        reject_pending = d32.seed_pending(b_payment70, 60, sessions["owner-b"][0])
        check_correction_denials(key, tokens, a_payment40, approve_pending, reject_pending)

        stage = "authorized Owner and Super Admin correction ledger and receipt"
        d32.allow_approve(key, tokens["owner-a"], approve_pending, -10, "partial", DUE_A)
        d32.assert_due(DUE_A, 90, "partial")
        d32.allow_reject(key, tokens["owner-b"], reject_pending)
        d32.assert_due(DUE_B, 80, "partial")
        own_request = d32.allow_request(key, tokens["owner-a"], a_payment40, 35)
        d32.deny(key, tokens["owner-a"], "request_payment_correction",
                 d32.request_args(a_payment40, 30), "A correction is already pending")
        d32.allow_reject(key, tokens["owner-a"], own_request)
        sa_request = d32.allow_request(key, tokens["super-admin"], b_payment70, 60)
        d32.allow_approve(key, tokens["super-admin"], sa_request, -10, "partial", DUE_B)
        d32.assert_due(DUE_B, 70, "partial")
        sa_rejection = d32.allow_request(key, tokens["super-admin"], a2_payment80, 70)
        d32.allow_reject(key, tokens["super-admin"], sa_rejection)
        d32.assert_due(DUE_A2, 80, "partial")

        stage = "invalid adjustment and forced late correction rollback"
        # The original D3.2 fixture left this older due paid 70 against an
        # original payment 80 after a legitimate adjustment. Re-correcting that
        # original to 1 must be refused because it would make the balance -9.
        legacy_b_payment80 = d32.payment_id(d1.DUE_IDS[2], 80)
        d32.assert_due(d1.DUE_IDS[2], 70, "partial")
        too_low = d32.allow_request(key, tokens["owner-b"], legacy_b_payment80, 1)
        d32.deny(key, tokens["owner-b"], "approve_payment_correction",
                 d32.approve_args(too_low), "Correction would make paid amount negative")
        d32.allow_reject(key, tokens["owner-b"], too_low)
        too_high = d32.allow_request(key, tokens["owner-b"], legacy_b_payment80, 200)
        d32.deny(key, tokens["owner-b"], "approve_payment_correction",
                 d32.approve_args(too_high), "Correction would overpay the payment due")
        d32.allow_reject(key, tokens["owner-b"], too_high)
        late = d32.allow_request(key, tokens["owner-a"], a2_payment80, 75)
        d1.sql("-c", "UPDATE public.ag34d32_fault_switch SET enabled=true")
        try:
            d32.deny(key, tokens["owner-a"], "approve_payment_correction",
                     d32.approve_args(late), "AG34D32 synthetic adjustment rollback")
            d32.assert_due(DUE_A2, 80, "partial")
        finally:
            d1.sql("-c", "UPDATE public.ag34d32_fault_switch SET enabled=false")
        d32.allow_approve(key, tokens["owner-a"], late, -5, "partial", DUE_A2)
        d32.assert_due(DUE_A2, 75, "partial")
        print("SEC-3 PASS: AO/SA correction request/approve/reject, receipts, limits and rollback", flush=True)

        if d1.sql("-At", "-c", "SELECT count(*) FROM auth.users") != "36":
            raise Sec3Failure("Disposable JWT identity count changed")
        print("SEC-3 PASS: exact SEC-2 FOUR RPC patch proven with signed JWTs; LIVE HIGH-002 REMAINS OPEN", flush=True)
        return 0
    except (Sec3Failure, d31.RpcFailure, d32.CorrectionFailure,
            d1.FinanceFailure, ag34b.SecurityMismatch,
            ag3.Ag3Failure, ag2.Ag2Error, ValueError,
            TypeError, KeyError, OSError, subprocess.TimeoutExpired):
        print("SEC-3 FAIL at " + stage + "; JWTs and payment response bodies withheld", flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
