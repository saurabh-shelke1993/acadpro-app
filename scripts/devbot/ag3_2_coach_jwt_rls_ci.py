#!/usr/bin/env python3
"""AG3.2 disposable-only Coach real-JWT, active-assignment PostgREST RLS.

Reuses AG2 native Auth/11 pinned helpers and the merged AG3.1 owner policy.
Does not deploy or assert equivalence to hosted Kheltriva policies.
"""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import ag2_real_auth_ci as ag2
import ag3_real_jwt_rls_ci as ag3

PROJECT = "kheltriva-ag32-ci"
CONTAINER = "supabase_db_" + PROJECT
POLICY_FILE = "ps_l2_3_b2_9_ag32_coach_batch_rls.sql"
BATCH_INACTIVE_A = "b0000000-0000-4000-8000-000000000003"
COACH_A_ID = "e0000000-0000-4000-8000-000000000001"
COACH_B_ID = "e0000000-0000-4000-8000-000000000002"
EXPECTED_AFTER_COACH = "5|4|2|3|3|3|11|2|t|f|f|f"

POST_STATE_SQL = """
SELECT (SELECT count(*) FROM auth.users),
       (SELECT count(*) FROM public.users),
       (SELECT count(*) FROM public.coaches),
       (SELECT count(*) FROM public.batches),
       (SELECT count(*) FROM public.coach_batches),
       (SELECT count(*) FROM public.coach_batch_assignments),
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='private'),
       (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='batches'),
       has_table_privilege('authenticated','public.batches','SELECT'),
       has_table_privilege('anon','public.batches','SELECT'),
       has_table_privilege('authenticated','public.coach_batches','SELECT'),
       has_table_privilege('authenticated','public.batches','UPDATE');
"""


class Ag32Failure(Exception):
    """Error message intentionally does not contain tokens or SQL output."""


def command(args: list[str], *, marker: str | None = None) -> str:
    completed = subprocess.run(args, capture_output=True, text=True,
                               check=False, timeout=90)
    if completed.returncode:
        raise Ag32Failure("Scoped disposable database command failed")
    output = completed.stdout.strip()
    if marker and marker not in output:
        raise Ag32Failure("Required fixture checkpoint missing")
    return output


def psql(*args: str, marker: str | None = None) -> str:
    return command(["docker", "exec", CONTAINER, "psql", "-U", "postgres",
                    "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", *args],
                   marker=marker)


def stage_fixtures() -> None:
    for name in (*ag2.FIXTURES, ag3.POLICY_FILE, POLICY_FILE):
        path = ag2.FIXTURE_PATH / name
        if not path.is_file():
            raise Ag32Failure("Reviewed scratch fixture not found")
        command(["docker", "cp", str(path), CONTAINER + ":/tmp/" + name])


def read_scoped(key: str, token: str, expected: list[dict[str, str]],
                *, row_filter: str | None = None,
                extra_headers: dict[str, str] | None = None) -> None:
    status, rows = ag3.rest(key, token, row_filter=row_filter,
                            extra_headers=extra_headers)
    if status != 200 or not isinstance(rows, list):
        raise Ag32Failure("Signed-JWT batch read rejected unexpectedly")
    # SQL need not guarantee row ordering; compare exact set and row count.
    expected_items = {(r["id"], r["academy_id"]) for r in expected}
    actual_items = {(r["id"], r["academy_id"]) for r in rows
                    if isinstance(r, dict) and set(r) == {"id", "academy_id"}}
    if len(rows) != len(expected) or actual_items != expected_items:
        raise Ag32Failure("Coach signed-JWT batch visibility differs from contract")


def deny_ungranted_table(key: str, token: str, table: str) -> None:
    if table not in ("coaches", "coach_batches", "coach_batch_assignments", "users"):
        raise ValueError("Unexpected table under direct-denial test")
    request = Request(ag3.API_URL + "/rest/v1/" + table + "?select=*",
                      headers={"apikey": key, "Authorization": "Bearer " + token,
                               "Accept": "application/json"}, method="GET")
    try:
        with urlopen(request, timeout=20) as response:
            code = response.status
    except HTTPError as exc:
        code = exc.code
    except (URLError, TimeoutError):
        raise Ag32Failure("Local PostgREST unavailable") from None
    if code not in (401, 403):
        raise Ag32Failure("Ungrantable synthetic mapping table became readable")


def record_summary(rows: list[tuple[str, str]], success: bool) -> None:
    lines = ["## Kheltriva DevBot AG3.2 — Coach JWT/assigned-batch isolation",
             "", "**Result: " + ("PASS" if success else "FAIL") + "**", "",
             "| Verified checkpoint | Status |", "| --- | --- |"]
    lines.extend("| " + name + " | " + result + " |" for name, result in rows)
    lines += ["", "**Test boundary:** Native local GoTrue JWTs through real PostgREST;",
              "two real synthetic Coach sessions; active, inactive, unassigned and",
              "foreign-academy batch checks. Policies/fixtures are scratch-only.",
              "", "**Not certified:** Hosted policies, production Coach edits/attendance,",
              "Parent, Super Admin, player/finance RLS, Storage or B4 billing.",
              "", "**No cost or deployment:** Disposable GitHub runner, no hosted",
              "Supabase secrets, no canonical migration or main-branch changes.", ""]
    report = "\n".join(lines)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as output:
            output.write(report)
    else:
        print(report)


def main() -> int:
    rows: list[tuple[str, str]] = []
    checkpoint = "disposable-only environment"
    try:
        scratch = Path(os.environ.get("RUNNER_TEMP", "/not-in-ci")) / PROJECT
        if (os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REPOSITORY") != "saurabh-shelke1993/acadpro-app"
            or Path.cwd().resolve() != scratch.resolve()
            or not (scratch / "supabase" / "config.toml").is_file()
            or (scratch / "supabase" / "migrations").exists()
            or (scratch / "supabase" / ".temp" / "project-ref").exists()):
            raise Ag32Failure("AG3.2 requires fresh unlinked Supabase CI")
        if command(["docker", "inspect", "-f",
                    "{{.State.Health.Status}}", CONTAINER]) != "healthy":
            raise Ag32Failure("Disposable PostgreSQL not healthy")
        info = subprocess.run(["supabase", "status", "-o", "env"],
                              capture_output=True, text=True, timeout=25)
        if info.returncode:
            raise Ag32Failure("Local Supabase status failed")
        key = ag2.local_status(info.stdout)
        rows.append(("Fresh unlinked native Supabase", "PASS"))

        checkpoint = "pinned synthetic schema and unchanged helpers"
        stage_fixtures()
        psql("-f", "/tmp/" + ag2.FIXTURES[0], marker="COMMIT")
        psql("--single-transaction",
             "-f", "/tmp/" + ag2.FIXTURES[1],
             "-f", "/tmp/" + ag2.FIXTURES[2],
             "-f", "/tmp/" + ag2.FIXTURES[3],
             marker="C3.3B CURRENT HELPERS VERIFIED")
        rows.append(("Five RLS tables and eleven pinned functions", "PASS"))

        checkpoint = "native GoTrue Owner A/B setup"
        smoke, smoke_token = ag3.signup_with_token(key, "c34a")
        owner_a, token_owner_a = ag3.signup_with_token(key, "c34b1-ao-a")
        psql("--single-transaction", "-v", "owner_uuid=" + owner_a,
             "-f", "/tmp/" + ag2.FIXTURES[4],
             marker="B2.9-C3.4B1 OWNER A MAPPING VERIFIED")
        owner_b, token_owner_b = ag3.signup_with_token(key, "c34b2-ao-b")
        psql("--single-transaction", "-v", "owner_uuid=" + owner_b,
             "-f", "/tmp/" + ag2.FIXTURES[5],
             marker="B2.9-C3.4B2 OWNER B MAPPING VERIFIED")
        if len({smoke, owner_a, owner_b}) != 3 or psql("-At", "-c", ag2.STATE_SQL) != ag2.EXPECTED:
            raise Ag32Failure("Baseline real Auth role mapping mismatch")
        psql("--single-transaction", "-f", "/tmp/" + ag3.POLICY_FILE,
             marker="AG3 SYNTHETIC OWNER RLS POLICY VERIFIED")
        if psql("-At", "-c", ag2.STATE_SQL) != ag3.EXPECTED_AFTER_POLICY:
            raise Ag32Failure("Approved AG3.1 owner policy baseline mismatch")
        ag3.wait_for_schema(key, token_owner_a)
        rows.append(("AG3.1 owner policy still valid", "PASS"))

        checkpoint = "real Coach signups and scoped mappings"
        coach_a, token_coach_a = ag3.signup_with_token(key, "ag32-coach-a")
        coach_b, token_coach_b = ag3.signup_with_token(key, "ag32-coach-b")
        if len({smoke, owner_a, owner_b, coach_a, coach_b}) != 5:
            raise Ag32Failure("Coach JWT identities not unique")
        psql("--single-transaction",
             "-v", "coach_a_uuid=" + coach_a,
             "-v", "coach_b_uuid=" + coach_b,
             "-f", "/tmp/" + POLICY_FILE,
             marker="AG3.2 SYNTHETIC COACH SCOPE VERIFIED")
        if psql("-At", "-c", POST_STATE_SQL) != EXPECTED_AFTER_COACH:
            raise Ag32Failure("Coach test policy or scratch fixture changed")
        rows.append(("Coach A/B real JWTs and active/inactive assignments", "PASS"))

        own_a = [{"id": ag3.BATCH_A, "academy_id": ag3.ACADEMY_A}]
        own_b = [{"id": ag3.BATCH_B, "academy_id": ag3.ACADEMY_B}]
        inactive_a = [{"id": BATCH_INACTIVE_A, "academy_id": ag3.ACADEMY_A}]

        checkpoint = "Coach A and Coach B positive authorization"
        read_scoped(key, token_coach_a, own_a)
        read_scoped(key, token_coach_a, own_a, row_filter=ag3.BATCH_A)
        read_scoped(key, token_coach_b, own_b)
        read_scoped(key, token_coach_b, own_b, row_filter=ag3.BATCH_B)
        rows.append(("Coach A/B see only active assigned batches", "PASS"))

        checkpoint = "same-academy inactive assignment"
        read_scoped(key, token_coach_a, [], row_filter=BATCH_INACTIVE_A)
        rows.append(("Inactive same-academy mapping denied", "PASS"))

        checkpoint = "foreign academy and unassigned batch tampering"
        for token in (token_coach_a, token_coach_b):
            for batch in (ag3.BATCH_A, ag3.BATCH_B, BATCH_INACTIVE_A):
                if ((token == token_coach_a and batch == ag3.BATCH_A)
                    or (token == token_coach_b and batch == ag3.BATCH_B)):
                    continue
                read_scoped(key, token, [], row_filter=batch)
        rows.append(("Foreign academy and direct ID bypass denied", "PASS"))

        checkpoint = "Owner policies and unmapped identity regression"
        read_scoped(key, token_owner_a, own_a + inactive_a)
        read_scoped(key, token_owner_b, own_b)
        read_scoped(key, smoke_token, [])
        rows.append(("Both Owner policies unaffected; unmapped user sees none", "PASS"))

        checkpoint = "identity headers, invalid bearer and anonymous"
        read_scoped(key, token_coach_a, own_a,
                    extra_headers={"x-academy-id": ag3.ACADEMY_B, "x-user-id": coach_b})
        ag3.deny_http(key, None)
        ag3.deny_http(key, "invalid.ag32.bearer")
        rows.append(("Forged tenant/user headers and unsigned access denied", "PASS"))

        checkpoint = "no Coach writes or mapping-table exposure"
        ag3.deny_http(key, token_coach_a, method="POST")
        ag3.deny_http(key, token_coach_a, method="PATCH", row_filter=ag3.BATCH_A)
        ag3.deny_http(key, token_coach_a, method="DELETE", row_filter=ag3.BATCH_A)
        for name in ("coaches", "coach_batches", "coach_batch_assignments", "users"):
            deny_ungranted_table(key, token_coach_a, name)
        rows.append(("Writes and direct mapping tables denied", "PASS"))

        checkpoint = "fresh independent SQL and REST postflight"
        if psql("-At", "-c", POST_STATE_SQL) != EXPECTED_AFTER_COACH:
            raise Ag32Failure("RLS or mappings mutated during authorization tests")
        read_scoped(key, token_coach_a, own_a)
        read_scoped(key, token_coach_b, own_b)
        rows.append(("Postflight identities, policies, grants and rows preserved", "PASS"))
        record_summary(rows, True)
        print("AG3.2 PASS: real Coach JWT scoped batch RLS through PostgREST", flush=True)
        return 0
    except (Ag32Failure, ag3.Ag3Failure, ag2.Ag2Error,
            OSError, subprocess.TimeoutExpired, ValueError, KeyError, TypeError):
        rows.append((checkpoint, "FAIL"))
        record_summary(rows, False)
        print("AG3.2 FAIL at checkpoint: " + checkpoint +
              "; sensitive output and tokens withheld.", flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
