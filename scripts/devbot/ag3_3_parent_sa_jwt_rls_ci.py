#!/usr/bin/env python3
"""AG3.3: real local GoTrue JWT Parent/SA RLS, strictly disposable Supabase CI.

Synthetic policy coverage only; not a production-schema authorization audit.
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

PROJECT = "kheltriva-ag33-ci"
CONTAINER = "supabase_db_" + PROJECT
POLICY_FILE = "ps_l2_3_b2_9_ag33_parent_sa_rls.sql"

PARENT_A1_ID = "d0000000-0000-4000-8000-000000000011"
PARENT_A2_ID = "d0000000-0000-4000-8000-000000000012"
PARENT_B_ID = "d0000000-0000-4000-8000-000000000013"
PLAYER_A1 = "f1000000-0000-4000-8000-000000000011"
PLAYER_A2 = "f1000000-0000-4000-8000-000000000012"
PLAYER_B = "f1000000-0000-4000-8000-000000000013"
NEW_BATCH = "b0000000-0000-4000-8000-000000000099"
NEW_CENTER = "c0000000-0000-4000-8000-000000000099"

POST_STATE_SQL = """
SELECT (SELECT count(*) FROM auth.users),
       (SELECT count(*) FROM public.users),
       (SELECT count(*) FROM public.parents),
       (SELECT count(*) FROM public.players),
       (SELECT count(*) FROM public.batches),
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='batches'),
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='parents'),
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='players'),
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='private'),
       (SELECT count(*) FROM public.coach_batch_assignments),
       has_table_privilege('authenticated','public.batches','UPDATE'),
       has_table_privilege('authenticated','public.parents','SELECT'),
       has_table_privilege('authenticated','public.players','SELECT'),
       has_table_privilege('anon','public.players','SELECT');
"""
EXPECTED_POST_STATE = "9|8|3|3|3|7|1|1|11|3|t|t|t|f"


class Ag33Failure(Exception):
    """Fixed, secret-free CI failure."""


def command(args: list[str], *, marker: str | None = None) -> str:
    result = subprocess.run(args, text=True, capture_output=True,
                            timeout=90, check=False)
    if result.returncode:
        raise Ag33Failure("Isolated SQL or Docker command failed")
    output = result.stdout.strip()
    if marker is not None and marker not in output:
        raise Ag33Failure("Mandatory SQL checkpoint missing")
    return output


def psql(*args: str, marker: str | None = None) -> str:
    return command(["docker", "exec", CONTAINER, "psql", "-U", "postgres",
                    "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", *args],
                   marker=marker)


def fixture_files() -> tuple[str, ...]:
    return (*ag2.FIXTURES, ag3.POLICY_FILE, ag32.POLICY_FILE, POLICY_FILE)


def stage_fixtures() -> None:
    for name in fixture_files():
        file = ag2.FIXTURE_PATH / name
        if not file.is_file():
            raise Ag33Failure("Approved synthetic test fixture missing")
        command(["docker", "cp", str(file), CONTAINER + ":/tmp/" + name])


def request_table(key: str, token: str | None, table: str, *,
                  method: str = "GET", row_filter: str | None = None,
                  payload: dict[str, str] | None = None,
                  extra_headers: dict[str, str] | None = None) -> tuple[int, object]:
    if table not in ("parents", "players", "batches"):
        raise ValueError("Unapproved PostgREST table")
    if method not in ("GET", "POST", "PATCH", "DELETE"):
        raise ValueError("Unapproved HTTP method")
    fields = {
        "parents": "id,user_id,academy_id",
        "players": "id,parent_id,batch_id,academy_id",
        "batches": "id,academy_id",
    }
    query = {"select": fields[table]}
    if row_filter is not None:
        query["id"] = "eq." + row_filter
    url = ag3.API_URL + "/rest/v1/" + table + "?" + urlencode(query)
    headers = {"apikey": key, "Accept": "application/json",
               "Prefer": "return=representation"}
    if token is not None:
        headers["Authorization"] = "Bearer " + token
    if extra_headers is not None:
        for name in ("x-academy-id", "x-user-id"):
            if name in extra_headers:
                headers[name] = extra_headers[name]
    data = None
    if method in ("POST", "PATCH"):
        if payload is None:
            raise ValueError("Mutation payload required")
        data = json.dumps(payload, separators=(",", ":")).encode()
        headers["Content-Type"] = "application/json"
    request = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read()
            if not raw:
                return response.status, None
            try:
                return response.status, json.loads(raw)
            except (ValueError, TypeError):
                raise Ag33Failure("Unexpected non-JSON successful response") from None
    except HTTPError as exc:
        # Never emit response body or JWT secrets.
        return exc.code, None
    except (URLError, TimeoutError):
        raise Ag33Failure("Disposable PostgREST unavailable") from None


def expect_rows(key: str, token: str, table: str,
                expected: list[dict[str, str]],
                *, row_filter: str | None = None,
                extra_headers: dict[str, str] | None = None) -> None:
    code, rows = request_table(key, token, table, row_filter=row_filter,
                               extra_headers=extra_headers)
    if code != 200 or not isinstance(rows, list) or len(rows) != len(expected):
        raise Ag33Failure("JWT-backed relation read count/status mismatch")
    def fingerprint(items: list[dict[str, str]]) -> set[tuple[tuple[str, str], ...]]:
        if any(not isinstance(r, dict) for r in items):
            raise Ag33Failure("Malformed PostgREST result")
        return {tuple(sorted(r.items())) for r in items}
    if fingerprint(rows) != fingerprint(expected):
        raise Ag33Failure("Parent/SA JWT visibility outside expected scope")


def expect_denial(key: str, token: str | None, table: str) -> None:
    code, _ = request_table(key, token, table)
    if code not in (401, 403):
        raise Ag33Failure("Unauthenticated/forged JWT not rejected")


def deny_mutation(key: str, token: str, method: str, *,
                  row_filter: str | None = None,
                  payload: dict[str, str] | None = None) -> None:
    if method not in ("POST", "PATCH", "DELETE"):
        raise ValueError("Only mutation methods may be denied")
    code, rows = request_table(key, token, "batches", method=method,
                               row_filter=row_filter, payload=payload)
    if method == "POST":
        if code not in (401, 403):
            raise Ag33Failure("Non-SA INSERT was not denied by RLS")
    elif not (code in (401, 403) or
              (code == 200 and rows == []) or
              (code == 204 and rows is None)):
        raise Ag33Failure("Non-SA UPDATE/DELETE affected a batch")


def wait_for_player_relation(key: str, token: str) -> None:
    for _ in range(12):
        code, _ = request_table(key, token, "players")
        if code == 200:
            return
        if code not in (404, 503):
            raise Ag33Failure("Unexpected PostgREST schema readiness response")
        time.sleep(1)
    raise Ag33Failure("PostgREST players schema cache was not refreshed")


def report(rows: list[tuple[str, str]], good: bool) -> None:
    lines = ["## Kheltriva DevBot AG3.3 — Parent/SA real-JWT role authorization",
             "", "**Result: " + ("PASS" if good else "FAIL") + "**", "",
             "| CI checkpoint | Result |", "| --- | --- |"]
    lines.extend("| " + name + " | " + state + " |" for name, state in rows)
    lines += ["", "Real native GoTrue JWTs were sent to local PostgREST.",
              "Three synthetic parent accounts cover same-academy other-parent",
              "isolation and cross-academy child/batch denial. One Super Admin",
              "tests platform-wide synthetic SELECT and permitted batch CRUD.",
              "", "**Test limit:** Scratch-only nonhistorical parents/players",
              "schema and RLS policies. Not genuine hosted policy-text parity.",
              "No full Parent Portal, payments/Storage, historical replay or B4.",
              "", "**Guardrails:** No hosted Supabase, production secrets,",
              "canonical migrations, main/Vercel or paid AI calls.", ""]
    content = "\n".join(lines)
    destination = os.environ.get("GITHUB_STEP_SUMMARY")
    if destination:
        with open(destination, "a", encoding="utf-8") as handle:
            handle.write(content)
    else:
        print(content)


def main() -> int:
    rows: list[tuple[str, str]] = []
    checkpoint = "isolated CI-only native Supabase"
    try:
        scratch = Path(os.environ.get("RUNNER_TEMP", "/non-runner")) / PROJECT
        if (os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REPOSITORY") != "saurabh-shelke1993/acadpro-app"
            or os.environ.get("SUPABASE_ACCESS_TOKEN")
            or os.environ.get("SUPABASE_DB_URL")
            or Path.cwd().resolve() != scratch.resolve()
            or not (scratch / "supabase" / "config.toml").is_file()
            or (scratch / "supabase" / "migrations").exists()
            or (scratch / "supabase" / ".temp" / "project-ref").exists()):
            raise Ag33Failure("AG3.3 refused non-disposable or linked environment")
        if command(["docker", "inspect", "-f",
                    "{{.State.Health.Status}}", CONTAINER]) != "healthy":
            raise Ag33Failure("Disposable Postgres container unhealthy")
        cli = subprocess.run(["supabase", "status", "-o", "env"],
                             capture_output=True, text=True, timeout=25)
        if cli.returncode:
            raise Ag33Failure("Native Supabase CLI status failed")
        key = ag2.local_status(cli.stdout)
        rows.append(("Fresh unlinked native Auth/PostgREST", "PASS"))

        checkpoint = "pinned five tables and eleven original current-state helpers"
        stage_fixtures()
        psql("-f", "/tmp/" + ag2.FIXTURES[0], marker="COMMIT")
        psql("--single-transaction",
             "-f", "/tmp/" + ag2.FIXTURES[1],
             "-f", "/tmp/" + ag2.FIXTURES[2],
             "-f", "/tmp/" + ag2.FIXTURES[3],
             marker="C3.3B CURRENT HELPERS VERIFIED")
        rows.append(("Pinned synthetic schema and 11 authorization helpers", "PASS"))

        checkpoint = "real Owner A/B GoTrue and approved AG3.1 role mapping"
        smoke, smoke_token = ag3.signup_with_token(key, "c34a")
        owner_a, owner_a_token = ag3.signup_with_token(key, "c34b1-ao-a")
        psql("--single-transaction", "-v", "owner_uuid=" + owner_a,
             "-f", "/tmp/" + ag2.FIXTURES[4],
             marker="B2.9-C3.4B1 OWNER A MAPPING VERIFIED")
        owner_b, owner_b_token = ag3.signup_with_token(key, "c34b2-ao-b")
        psql("--single-transaction", "-v", "owner_uuid=" + owner_b,
             "-f", "/tmp/" + ag2.FIXTURES[5],
             marker="B2.9-C3.4B2 OWNER B MAPPING VERIFIED")
        if psql("-At", "-c", ag2.STATE_SQL) != ag2.EXPECTED:
            raise Ag33Failure("AG2 baseline role or helper mismatch")
        psql("--single-transaction", "-f", "/tmp/" + ag3.POLICY_FILE,
             marker="AG3 SYNTHETIC OWNER RLS POLICY VERIFIED")
        if psql("-At", "-c", ag2.STATE_SQL) != ag3.EXPECTED_AFTER_POLICY:
            raise Ag33Failure("AG3.1 Owner policy baseline mismatch")
        ag3.wait_for_schema(key, owner_a_token)
        rows.append(("Existing Owner A/B synthetic scope preserved", "PASS"))

        checkpoint = "real Coach A/B identities and approved AG3.2 assignments"
        coach_a, coach_a_token = ag3.signup_with_token(key, "ag32-coach-a")
        coach_b, coach_b_token = ag3.signup_with_token(key, "ag32-coach-b")
        psql("--single-transaction",
             "-v", "coach_a_uuid=" + coach_a,
             "-v", "coach_b_uuid=" + coach_b,
             "-f", "/tmp/" + ag32.POLICY_FILE,
             marker="AG3.2 SYNTHETIC COACH SCOPE VERIFIED")
        if psql("-At", "-c", ag32.POST_STATE_SQL) != ag32.EXPECTED_AFTER_COACH:
            raise Ag33Failure("AG3.2 Coach role/assignment baseline mismatch")
        rows.append(("Active/inactive Coach assignments preserved", "PASS"))

        checkpoint = "real Parent A1/A2/B and Super Admin GoTrue JWTs"
        parent_a1, token_a1 = ag3.signup_with_token(key, "ag33-parent-a1")
        parent_a2, token_a2 = ag3.signup_with_token(key, "ag33-parent-a2")
        parent_b, token_parent_b = ag3.signup_with_token(key, "ag33-parent-b")
        sa, token_sa = ag3.signup_with_token(key, "ag33-super-admin")
        if len({smoke, owner_a, owner_b, coach_a, coach_b,
                parent_a1, parent_a2, parent_b, sa}) != 9:
            raise Ag33Failure("Native GoTrue UUID collision")
        psql("--single-transaction",
             "-v", "parent_a1_uuid=" + parent_a1,
             "-v", "parent_a2_uuid=" + parent_a2,
             "-v", "parent_b_uuid=" + parent_b,
             "-v", "super_admin_uuid=" + sa,
             "-f", "/tmp/" + POLICY_FILE,
             marker="AG3.3 SYNTHETIC PARENT AND SUPER ADMIN SCOPE VERIFIED")
        if psql("-At", "-c", POST_STATE_SQL) != EXPECTED_POST_STATE:
            raise Ag33Failure("Parent/SA new policy data or grants mismatch")
        wait_for_player_relation(key, token_a1)
        rows.append(("3 Parent JWTs and platform Super Admin synthetic mapping", "PASS"))

        batch_a1 = [{"id": ag3.BATCH_A, "academy_id": ag3.ACADEMY_A}]
        batch_a2 = [{"id": ag32.BATCH_INACTIVE_A, "academy_id": ag3.ACADEMY_A}]
        batch_b = [{"id": ag3.BATCH_B, "academy_id": ag3.ACADEMY_B}]
        player_a1 = [{"id": PLAYER_A1, "parent_id": PARENT_A1_ID,
                      "batch_id": ag3.BATCH_A, "academy_id": ag3.ACADEMY_A}]
        player_a2 = [{"id": PLAYER_A2, "parent_id": PARENT_A2_ID,
                      "batch_id": ag32.BATCH_INACTIVE_A, "academy_id": ag3.ACADEMY_A}]
        player_b = [{"id": PLAYER_B, "parent_id": PARENT_B_ID,
                     "batch_id": ag3.BATCH_B, "academy_id": ag3.ACADEMY_B}]
        record_a1 = [{"id": PARENT_A1_ID, "user_id": parent_a1,
                      "academy_id": ag3.ACADEMY_A}]
        record_a2 = [{"id": PARENT_A2_ID, "user_id": parent_a2,
                      "academy_id": ag3.ACADEMY_A}]
        record_b = [{"id": PARENT_B_ID, "user_id": parent_b,
                     "academy_id": ag3.ACADEMY_B}]

        checkpoint = "Parent positive linked-player and batch scope"
        for token, own_parent, own_player, own_batch in (
            (token_a1, record_a1, player_a1, batch_a1),
            (token_a2, record_a2, player_a2, batch_a2),
            (token_parent_b, record_b, player_b, batch_b)
        ):
            expect_rows(key, token, "parents", own_parent)
            expect_rows(key, token, "players", own_player)
            ag32.read_scoped(key, token, own_batch)
        rows.append(("Parents see only self, linked child and training batch", "PASS"))

        checkpoint = "different same-academy parent and foreign-academy negative"
        for token, own_batch, own_player, own_parent in (
            (token_a1, ag3.BATCH_A, PLAYER_A1, PARENT_A1_ID),
            (token_a2, ag32.BATCH_INACTIVE_A, PLAYER_A2, PARENT_A2_ID),
            (token_parent_b, ag3.BATCH_B, PLAYER_B, PARENT_B_ID)
        ):
            for batch in (ag3.BATCH_A, ag32.BATCH_INACTIVE_A, ag3.BATCH_B):
                if batch != own_batch:
                    ag32.read_scoped(key, token, [], row_filter=batch)
            for player in (PLAYER_A1, PLAYER_A2, PLAYER_B):
                if player != own_player:
                    expect_rows(key, token, "players", [], row_filter=player)
            for parent in (PARENT_A1_ID, PARENT_A2_ID, PARENT_B_ID):
                if parent != own_parent:
                    expect_rows(key, token, "parents", [], row_filter=parent)
        rows.append(("Other parent in same academy and foreign tenant denied", "PASS"))

        checkpoint = "Super Admin global scope across multiple academies"
        ag32.read_scoped(key, token_sa, batch_a1 + batch_a2 + batch_b)
        expect_rows(key, token_sa, "players", player_a1 + player_a2 + player_b)
        expect_rows(key, token_sa, "parents", record_a1 + record_a2 + record_b)
        rows.append(("Super Admin reads all 3 cross-academy synthetic records", "PASS"))

        checkpoint = "non-SA writes blocked by actual synthetic RLS"
        denied_payload = {"id": NEW_BATCH, "center_id": NEW_CENTER,
                          "academy_id": ag3.ACADEMY_A}
        for token in (token_a1, token_a2, token_parent_b, coach_a_token):
            deny_mutation(key, token, "POST", payload=denied_payload)
        deny_mutation(key, token_a1, "PATCH", row_filter=ag3.BATCH_A,
                      payload={"academy_id": ag3.ACADEMY_B})
        deny_mutation(key, token_a1, "DELETE", row_filter=ag3.BATCH_A)
        ag32.read_scoped(key, token_sa, batch_a1 + batch_a2 + batch_b)
        rows.append(("Parent/Coach direct batch writes denied by SA-only RLS", "PASS"))

        checkpoint = "Super Admin allowed isolated cross-academy INSERT UPDATE DELETE"
        code, payload = request_table(key, token_sa, "batches", method="POST",
                                      payload=denied_payload)
        if code != 201 or payload != [
            {"id": NEW_BATCH, "academy_id": ag3.ACADEMY_A}]:
            raise Ag33Failure("Super Admin synthetic batch INSERT failed")
        code, payload = request_table(key, token_sa, "batches", method="PATCH",
                                      row_filter=NEW_BATCH,
                                      payload={"academy_id": ag3.ACADEMY_B})
        if code != 200 or payload != [
            {"id": NEW_BATCH, "academy_id": ag3.ACADEMY_B}]:
            raise Ag33Failure("Super Admin cross-academy UPDATE failed")
        code, payload = request_table(key, token_sa, "batches", method="DELETE",
                                      row_filter=NEW_BATCH)
        if code != 200 or payload != [
            {"id": NEW_BATCH, "academy_id": ag3.ACADEMY_B}]:
            raise Ag33Failure("Super Admin synthetic batch DELETE failed")
        ag32.read_scoped(key, token_sa, [], row_filter=NEW_BATCH)
        rows.append(("Super Admin batch INSERT/UPDATE/DELETE succeeded, then cleaned", "PASS"))

        checkpoint = "previous Owner and Coach scoped regressions"
        ag32.read_scoped(key, owner_a_token, batch_a1 + batch_a2)
        ag32.read_scoped(key, owner_b_token, batch_b)
        ag32.read_scoped(key, coach_a_token, batch_a1)
        ag32.read_scoped(key, coach_b_token, batch_b)
        ag32.read_scoped(key, coach_a_token, [], row_filter=ag32.BATCH_INACTIVE_A)
        rows.append(("AG3.1 Owner and AG3.2 Coach behavior unchanged", "PASS"))

        checkpoint = "unmapped/anonymous/invalid JWT and forged headers"
        ag32.read_scoped(key, smoke_token, [])
        expect_rows(key, smoke_token, "parents", [])
        expect_rows(key, smoke_token, "players", [])
        for table in ("batches", "parents", "players"):
            expect_denial(key, None, table)
            expect_denial(key, "invalid.ag33.bearer", table)
        ag32.read_scoped(key, token_a1, batch_a1,
                         extra_headers={"x-academy-id": ag3.ACADEMY_B,
                                        "x-user-id": sa})
        expect_rows(key, token_a1, "players", player_a1,
                    extra_headers={"x-academy-id": ag3.ACADEMY_B,
                                   "x-user-id": sa})
        rows.append(("Unmapped, anonymous, forged JWT/header denied", "PASS"))

        checkpoint = "independent fresh SQL and PostgREST postflight"
        if psql("-At", "-c", POST_STATE_SQL) != EXPECTED_POST_STATE:
            raise Ag33Failure("Scratch RLS/rows/grants changed unexpectedly")
        ag32.read_scoped(key, token_sa, batch_a1 + batch_a2 + batch_b)
        expect_rows(key, token_a1, "players", player_a1)
        rows.append(("Fresh SQL confirms restored 3 batches and scoped grants", "PASS"))

        report(rows, True)
        print("AG3.3 PASS: Parent/SA real JWT authorization via disposable PostgREST",
              flush=True)
        return 0
    except (Ag33Failure, ag32.Ag32Failure, ag3.Ag3Failure, ag2.Ag2Error,
            OSError, subprocess.TimeoutExpired, ValueError, KeyError, TypeError):
        rows.append((checkpoint, "FAIL"))
        report(rows, False)
        print("AG3.3 FAIL at checkpoint: " + checkpoint +
              "; request bodies, passwords, JWTs and keys withheld.", flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
