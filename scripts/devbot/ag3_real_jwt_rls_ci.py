#!/usr/bin/env python3
"""AG3.1: real JWT-backed PostgREST cross-academy RLS in ephemeral Supabase.

Uses existing NONHISTORICAL B2.9 fixtures. NEVER tests hosted Supabase.
Do not claim full production policy or all-role certification.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import UUID

import ag2_real_auth_ci as ag2

PROJECT = "kheltriva-ag3-ci"
CONTAINER = "supabase_db_" + PROJECT
API_URL = "http://127.0.0.1:54321"
POLICY_FILE = "ps_l2_3_b2_9_ag3_owner_batch_rls.sql"
ACADEMY_A = "a0000000-0000-4000-8000-000000000001"
ACADEMY_B = "a0000000-0000-4000-8000-000000000002"
BATCH_A = "b0000000-0000-4000-8000-000000000001"
BATCH_B = "b0000000-0000-4000-8000-000000000002"
EXPECTED_AFTER_POLICY = "3|2|0|0|0|2|11|1|1|f|t|f|t"


class Ag3Failure(Exception):
    """Non-sensitive, fixed-format test errors."""


def command(args: list[str], *, marker: str | None = None) -> str:
    completed = subprocess.run(args, text=True, capture_output=True,
                               check=False, timeout=90)
    if completed.returncode != 0:
        raise Ag3Failure("Disposable native SQL or Docker operation failed")
    output = completed.stdout.strip()
    if marker is not None and marker not in output:
        raise Ag3Failure("SQL checkpoint marker missing")
    return output


def psql(*args: str, marker: str | None = None) -> str:
    return command(["docker", "exec", CONTAINER, "psql", "-U", "postgres",
                    "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", *args],
                   marker=marker)


def fixtures() -> None:
    for name in (*ag2.FIXTURES, POLICY_FILE):
        source = ag2.FIXTURE_PATH / name
        if not source.is_file():
            raise Ag3Failure("Pinned SQL fixture missing")
        command(["docker", "cp", str(source), CONTAINER + ":/tmp/" + name])


def signup_with_token(key: str, label: str) -> tuple[str, str]:
    email = "b29-" + label + "-" + secrets.token_hex(6) + "@example.test"
    password = secrets.token_urlsafe(24) + "Aa9!"
    result = ag2.auth_json("/auth/v1/signup", key,
                           payload={"email": email, "password": password})
    token, user = result.get("access_token"), result.get("user")
    if not isinstance(token, str) or not token or not isinstance(user, dict):
        raise Ag3Failure("GoTrue failed to issue a signed-in bearer session")
    confirmed = ag2.auth_json("/auth/v1/user", key, token=token)
    if confirmed.get("email") != email or confirmed.get("id") != user.get("id"):
        raise Ag3Failure("Real GoTrue session identity mismatch")
    try:
        return str(UUID(str(confirmed["id"]))), token
    except (ValueError, KeyError, TypeError):
        raise Ag3Failure("Real GoTrue identity UUID malformed") from None


def rest(key: str, token: str | None, *, method: str = "GET",
         row_filter: str | None = None,
         extra_headers: dict[str, str] | None = None) -> tuple[int, object]:
    if method not in ("GET", "POST", "PATCH", "DELETE"):
        raise ValueError("Unapproved HTTP method")
    params = {"select": "id,academy_id"}
    if row_filter:
        params["id"] = "eq." + row_filter
    url = API_URL + "/rest/v1/batches?" + urlencode(params)
    headers = {"apikey": key, "Accept": "application/json"}
    if token is not None:
        headers["Authorization"] = "Bearer " + token
    if extra_headers:
        for name in ("x-academy-id", "x-user-id"):
            if name in extra_headers:
                headers[name] = extra_headers[name]
    body = None
    if method == "POST":
        # Must be rejected: no INSERT grant or INSERT RLS policy.
        body = json.dumps({"id": "b0000000-0000-4000-8000-000000000099",
                           "academy_id": ACADEMY_B,
                           "center_id": "c0000000-0000-4000-8000-000000000099"}).encode()
        headers["Content-Type"] = "application/json"
    if method == "PATCH":
        body = json.dumps({"academy_id": ACADEMY_B}).encode()
        headers["Content-Type"] = "application/json"
    req = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=20) as response:
            raw = response.read()
            if not raw:
                return response.status, None
            try:
                return response.status, json.loads(raw)
            except (ValueError, TypeError):
                raise Ag3Failure("PostgREST returned non-JSON successful body") from None
    except HTTPError as error:
        # Do not expose error response, bearer token, or keys.
        return error.code, None
    except (URLError, TimeoutError):
        raise Ag3Failure("Local PostgREST unavailable") from None


def expected_rows(key: str, token: str, wanted: list[dict[str, str]],
                  *, row_filter: str | None = None,
                  extra_headers: dict[str, str] | None = None) -> None:
    code, rows = rest(key, token, row_filter=row_filter, extra_headers=extra_headers)
    if code != 200 or not isinstance(rows, list) or rows != wanted:
        raise Ag3Failure("JWT-signed PostgREST read scope differed from expectation")


def wait_for_schema(key: str, token: str) -> None:
    # Only schema-cache/readiness failures are retried, never test failures.
    for _ in range(12):
        code, _ = rest(key, token)
        if code == 200:
            return
        if code not in (404, 503):
            raise Ag3Failure("Unexpected PostgREST status after policy installation")
        time.sleep(1)
    raise Ag3Failure("PostgREST failed to refresh synthetic schema cache")


def deny_http(key: str, token: str | None, *, method: str = "GET",
              row_filter: str | None = None) -> None:
    status, _ = rest(key, token, method=method, row_filter=row_filter)
    if status not in (401, 403):
        raise Ag3Failure("Unauthorized PostgREST request was not denied")


def summary(rows: list[tuple[str, str]], good: bool) -> None:
    lines = ["## Kheltriva DevBot AG3.1 — JWT-backed cross-academy RLS",
             "", "**Result: " + ("PASS" if good else "FAIL") + "**", "",
             "| Test checkpoint | Outcome |", "| --- | --- |"]
    lines.extend("| " + name + " | " + result + " |" for name, result in rows)
    lines += ["",
              "**Real authentication:** Local GoTrue-issued JWT validated through",
              "/auth/v1/user then sent to PostgREST over HTTP.",
              "", "**Test-only policy:** Authenticated Academy Owner can SELECT",
              "batches matching own academy, using existing private helpers.",
              "", "**Limit:** Only synthetic Academy Owner A/B batch-read policy;",
              "not production-schema policy equivalence, Coach/Parent/SA security,",
              "finance/Storage, payment release readiness or historical migration replay.",
              "", "**Cost and access:** Standard GitHub runner, no hosted Supabase",
              "credentials, no paid AI, no changes to the Owner's laptop.", ""]
    text = "\n".join(lines)
    if path := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(path, "a", encoding="utf-8") as file:
            file.write(text)
    else:
        print(text)


def main() -> int:
    rows: list[tuple[str, str]] = []
    checkpoint = "CI isolation"
    try:
        scratch = Path(os.environ.get("RUNNER_TEMP", "/not-on-runner")) / PROJECT
        if (os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REPOSITORY") != "saurabh-shelke1993/acadpro-app"
            or Path.cwd().resolve() != scratch.resolve()
            or not (scratch / "supabase" / "config.toml").is_file()
            or (scratch / "supabase" / "migrations").exists()
            or (scratch / "supabase" / ".temp" / "project-ref").exists()):
            raise Ag3Failure("AG3 refused non-disposable or linked Supabase workspace")
        if command(["docker", "inspect", "-f",
                    "{{.State.Health.Status}}", CONTAINER]) != "healthy":
            raise Ag3Failure("CI-only PostgreSQL container unhealthy")
        status = subprocess.run(["supabase", "status", "-o", "env"],
                                capture_output=True, text=True, timeout=25)
        if status.returncode != 0:
            raise Ag3Failure("Local Supabase CLI status failed")
        key = ag2.local_status(status.stdout)
        rows.append(("Fresh unlinked native Supabase", "PASS"))

        checkpoint = "pinned schema/helper source"
        fixtures()
        psql("-f", "/tmp/" + ag2.FIXTURES[0], marker="COMMIT")
        psql("--single-transaction",
             "-f", "/tmp/" + ag2.FIXTURES[1],
             "-f", "/tmp/" + ag2.FIXTURES[2],
             "-f", "/tmp/" + ag2.FIXTURES[3],
             marker="C3.3B CURRENT HELPERS VERIFIED")
        rows.append(("Five synthetic RLS tables and 11 pinned helpers", "PASS"))

        checkpoint = "genuine GoTrue sessions and existing owner mappings"
        smoke, smoke_token = signup_with_token(key, "c34a")
        owner_a, token_a = signup_with_token(key, "c34b1-ao-a")
        psql("--single-transaction", "-v", "owner_uuid=" + owner_a,
             "-f", "/tmp/" + ag2.FIXTURES[4],
             marker="B2.9-C3.4B1 OWNER A MAPPING VERIFIED")
        owner_b, token_b = signup_with_token(key, "c34b2-ao-b")
        if len({smoke, owner_a, owner_b}) != 3:
            raise Ag3Failure("Unexpected repeated real Auth identity")
        psql("--single-transaction", "-v", "owner_uuid=" + owner_b,
             "-f", "/tmp/" + ag2.FIXTURES[5],
             marker="B2.9-C3.4B2 OWNER B MAPPING VERIFIED")
        if psql("-At", "-c", ag2.STATE_SQL) != ag2.EXPECTED:
            raise Ag3Failure("Initial native Auth and 2 tenant mappings failed")
        rows.append(("3 real JWT sessions and FK-backed Owner A/B mappings", "PASS"))

        checkpoint = "install reviewed synthetic RLS"
        psql("--single-transaction", "-f", "/tmp/" + POLICY_FILE,
             marker="AG3 SYNTHETIC OWNER RLS POLICY VERIFIED")
        if psql("-At", "-c", ag2.STATE_SQL) != EXPECTED_AFTER_POLICY:
            raise Ag3Failure("Synthetic policy ACL or RLS state not as expected")
        rows.append(("Test-only SELECT privilege and scoped RLS predicate", "PASS"))
        wait_for_schema(key, token_a)

        checkpoint = "owner A allows own batches"
        a = [{"id": BATCH_A, "academy_id": ACADEMY_A}]
        b = [{"id": BATCH_B, "academy_id": ACADEMY_B}]
        expected_rows(key, token_a, a)
        expected_rows(key, token_a, a, row_filter=BATCH_A)
        rows.append(("Owner A can read only Academy A batch", "PASS"))

        checkpoint = "owner B allows own batches"
        expected_rows(key, token_b, b)
        expected_rows(key, token_b, b, row_filter=BATCH_B)
        rows.append(("Owner B can read only Academy B batch", "PASS"))

        checkpoint = "cross-academy reads denied"
        expected_rows(key, token_a, [], row_filter=BATCH_B)
        expected_rows(key, token_b, [], row_filter=BATCH_A)
        rows.append(("Cross-academy direct-ID reads return zero rows", "PASS"))

        checkpoint = "unmapped account denied"
        expected_rows(key, smoke_token, [])
        rows.append(("Signed-in account with no app role sees zero batches", "PASS"))

        checkpoint = "unauthenticated/invalid JWT denied"
        deny_http(key, None)
        deny_http(key, "invalid.ag3.bearer")
        rows.append(("Anon and invalid bearer denied at Data API", "PASS"))

        checkpoint = "header identity tampering blocked"
        expected_rows(key, token_a, a,
                      extra_headers={"x-academy-id": ACADEMY_B, "x-user-id": owner_b})
        rows.append(("Forged tenant/user headers do not enlarge scope", "PASS"))

        checkpoint = "unauthorized mutations denied"
        deny_http(key, token_a, method="POST")
        deny_http(key, token_a, method="PATCH", row_filter=BATCH_B)
        deny_http(key, token_a, method="DELETE", row_filter=BATCH_B)
        rows.append(("INSERT, UPDATE, DELETE without grants all denied", "PASS"))

        checkpoint = "postflight persisted batch and policy check"
        if psql("-At", "-c", ag2.STATE_SQL) != EXPECTED_AFTER_POLICY:
            raise Ag3Failure("Read-only batch/RLS counts changed after requests")
        expected_rows(key, token_a, a)
        expected_rows(key, token_b, b)
        rows.append(("Fresh SQL and REST scope unchanged after denial tests", "PASS"))

        summary(rows, True)
        print("AG3 PASS: native JWT owner isolation verified through PostgREST", flush=True)
        return 0
    except (Ag3Failure, ag2.Ag2Error, OSError, subprocess.TimeoutExpired):
        rows.append((checkpoint, "FAIL"))
        summary(rows, False)
        print("AG3 FAIL at checkpoint: " + checkpoint +
              "; no Auth secret, JWT or response body disclosed.", flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
