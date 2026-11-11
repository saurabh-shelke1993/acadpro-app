#!/usr/bin/env python3
"""AG3.1: real signed-JWT PostgREST tenant RLS tests, disposable GitHub CI only.

Tests synthetic Academy Owner A/B and unmapped Auth, not canonical policies,
Coach/Parent authorization, production DB or real Kheltriva data.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import secrets
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

import ag2_real_auth_ci as ag2

API_URL = ag2.API_URL
PROJECT = ag2.PROJECT  # Reuse isolated AG2 fixture and container naming, new CI runner.
BATCH_A = "b0000000-0000-4000-8000-000000000001"
BATCH_B = "b0000000-0000-4000-8000-000000000002"
ACADEMY_A = "a0000000-0000-4000-8000-000000000001"
ACADEMY_B = "a0000000-0000-4000-8000-000000000002"
ALLOWED_RLS_FIXTURES = ("ps_l2_3_b2_9_ag3_owner_rls.sql",)
EXPECTED_STATE = "3|2|2|11|1|t|f|f|f|f|f"
STATE_SQL = """
SELECT
  (SELECT count(*) FROM auth.users),
  (SELECT count(*) FROM public.users),
  (SELECT count(*) FROM public.batches),
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='private'),
  (SELECT count(*) FROM pg_policy WHERE polrelid='public.batches'::regclass),
  has_table_privilege('authenticated','public.batches','SELECT'),
  has_table_privilege('anon','public.batches','SELECT'),
  has_table_privilege('authenticated','public.batches','INSERT'),
  has_table_privilege('authenticated','public.batches','UPDATE'),
  has_table_privilege('authenticated','public.batches','DELETE'),
  has_table_privilege('authenticated','public.users','SELECT');
"""


class Ag3Error(Exception):
    """Safe, credential-free error message."""


def signup_session(key: str, label: str) -> tuple[str, str]:
    """Return verified GoTrue UUID and its actual Auth-issued JWT in memory."""
    email = "b29-" + label + "-" + secrets.token_hex(6) + "@example.test"
    password = secrets.token_urlsafe(24) + "Aa9!"
    created = ag2.auth_json("/auth/v1/signup", key,
                            payload={"email": email, "password": password})
    token, user = created.get("access_token"), created.get("user")
    if not isinstance(token, str) or not token or not isinstance(user, dict):
        raise Ag3Error("GoTrue did not issue a real session")
    verified = ag2.auth_json("/auth/v1/user", key, token=token)
    if verified.get("email") != email or verified.get("id") != user.get("id"):
        raise Ag3Error("Issued bearer JWT did not authenticate as its user")
    try:
        return str(UUID(str(verified["id"]))), token
    except (KeyError, ValueError, TypeError):
        raise Ag3Error("GoTrue returned invalid synthetic UUID") from None


def postgrest(key: str, path: str, *, token: str | None = None,
              method: str = "GET", payload: dict | None = None) -> tuple[int, object]:
    """Send real JWT through local Kong/PostgREST; never expose HTTP error bodies."""
    if not path.startswith("/rest/v1/batches"):
        raise Ag3Error("Blocked nonallowlisted API path")
    if method not in ("GET", "POST", "PATCH"):
        raise Ag3Error("Blocked nonallowlisted API method")
    headers = {"apikey": key, "Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode("utf-8")
    req = Request(API_URL + path, headers=headers, data=body, method=method)
    try:
        with urlopen(req, timeout=20) as response:
            response_body = response.read()
            return response.status, json.loads(response_body) if response_body else None
    except HTTPError as error:
        return error.code, None
    except (URLError, TimeoutError, OSError, ValueError):
        raise Ag3Error("Local PostgREST unavailable or response malformed") from None


def must_scoped_rows(key: str, token: str, batch_id: str,
                     academy_id: str, forbidden_id: str) -> None:
    path = "/rest/v1/batches?select=id,academy_id&order=id.asc"
    status, body = postgrest(key, path, token=token)
    if status != 200 or body != [{"id": batch_id, "academy_id": academy_id}]:
        raise Ag3Error("Owner did not see exactly their own synthetic batch")
    # Querying the other tenant by a known ID must still reveal no row.
    status, body = postgrest(key, "/rest/v1/batches?select=id&id=eq." + forbidden_id,
                            token=token)
    if status != 200 or body != []:
        raise Ag3Error("Cross-academy batch became visible through filtered API request")


def await_postgrest_schema(key: str, token: str) -> None:
    """Bounded schema cache readiness probe; does not mutate or retry signups."""
    for _ in range(10):
        status, body = postgrest(key, "/rest/v1/batches?select=id&limit=1", token=token)
        if status == 200 and isinstance(body, list):
            return
        if status not in (400, 404):
            break
        time.sleep(2)
    raise Ag3Error("Local PostgREST did not expose the synthetic batches table")


def corrupted_signature(token: str) -> str:
    pieces = token.split(".")
    if len(pieces) != 3 or not pieces[2]:
        raise Ag3Error("GoTrue did not issue a JWT-shaped token")
    original = pieces[2][0]
    pieces[2] = ("A" if original != "A" else "B") + pieces[2][1:]
    return ".".join(pieces)


def report(results: list[tuple[str, str]], success: bool) -> None:
    lines = [
        "## Kheltriva DevBot AG3.1 — Real JWT-backed RLS",
        "", "**Result: " + ("PASS" if success else "FAIL") + "**",
        "", "| Scenario | Result |", "| --- | --- |",
    ]
    lines += ["| " + label + " | " + result + " |" for label, result in results]
    lines += [
        "", "**Tested:** synthetic Academy Owner A/B allowed in-scope reads;",
        "cross-academy denied reads; anonymous and unmapped-user restrictions;",
        "forged JWT rejection and denied writes. All requests used real local",
        "Kong/PostgREST and native GoTrue bearer JWTs.",
        "",
        "**Scope limits:** synthetic test-only batches policy, not actual production",
        "policies; Coach/Parent/Super Admin, finance and historical migrations untested.",
        "",
        "**No laptop or hosted Supabase used.** No paid AI, secrets or deploy.",
        "",
    ]
    text = "\n".join(lines)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(text)
    else:
        print(text)


def main() -> int:
    results: list[tuple[str, str]] = []
    checkpoint = "scratch preflight"
    try:
        scratch = Path(os.environ.get("RUNNER_TEMP", "/not-a-runner")) / PROJECT
        if (os.environ.get("GITHUB_ACTIONS") != "true"
                or os.environ.get("GITHUB_REPOSITORY") !=
                    "saurabh-shelke1993/acadpro-app"
                or scratch.resolve() != Path.cwd().resolve()
                or not (scratch / "supabase/config.toml").is_file()
                or (scratch / "supabase/migrations").exists()
                or (scratch / "supabase/.temp/project-ref").exists()):
            raise Ag3Error("Not an isolated, unlinked GitHub runner project")

        if ag2.command(["docker", "inspect", "-f",
                        "{{.State.Health.Status}}", ag2.CONTAINER]) != "healthy":
            raise Ag3Error("Expected disposable native PostgreSQL not healthy")
        status = ag2.command(["supabase", "status", "-o", "env"])
        key = ag2.local_status(status)
        results.append(("Unlinked real GoTrue, Kong and PostgREST stack", "PASS"))

        checkpoint = "pinned synthetic fixture"
        ag2.prepare_fixtures()
        ag2.psql("-f", "/tmp/" + ag2.FIXTURES[0], marker="COMMIT")
        ag2.psql("--single-transaction", "-f", "/tmp/" + ag2.FIXTURES[1],
                 "-f", "/tmp/" + ag2.FIXTURES[2],
                 "-f", "/tmp/" + ag2.FIXTURES[3],
                 marker="C3.3B CURRENT HELPERS VERIFIED")
        results.append(("Five RLS tables + eleven unchanged private helpers", "PASS"))

        checkpoint = "real GoTrue sessions and owner mapping"
        smoke_id, smoke_jwt = signup_session(key, "c34a")
        owner_a_id, owner_a_jwt = signup_session(key, "c34b1-ao-a")
        ag2.mapping_sql(ag2.FIXTURES[4], owner_a_id,
                        "B2.9-C3.4B1 OWNER A MAPPING VERIFIED")
        owner_b_id, owner_b_jwt = signup_session(key, "c34b2-ao-b")
        ag2.mapping_sql(ag2.FIXTURES[5], owner_b_id,
                        "B2.9-C3.4B2 OWNER B MAPPING VERIFIED")
        if len({smoke_id, owner_a_id, owner_b_id}) != 3:
            raise Ag3Error("GoTrue identity UUIDs are not distinct")
        results.append(("Three real Auth-issued JWTs and two owner mappings", "PASS"))

        checkpoint = "synthetic owner-only RLS policy"
        for fixture in ALLOWED_RLS_FIXTURES:
            source = ag2.ROOT / "supabase/tests/subscriptions" / fixture
            if not source.is_file():
                raise Ag3Error("AG3 allowlisted SQL policy file missing")
            ag2.command(["docker", "cp", str(source),
                         ag2.CONTAINER + ":/tmp/" + fixture])
            ag2.psql("--single-transaction", "-f", "/tmp/" + fixture,
                     marker="AG3 OWNER RLS POLICY VERIFIED")
        await_postgrest_schema(key, owner_a_jwt)
        results.append(("Read-only synthetic scoped RLS and REST API ready", "PASS"))

        checkpoint = "Owner A can read Academy A only"
        must_scoped_rows(key, owner_a_jwt, BATCH_A, ACADEMY_A, BATCH_B)
        results.append(("Owner A own batch allowed; Academy B hidden", "PASS"))

        checkpoint = "Owner B can read Academy B only"
        must_scoped_rows(key, owner_b_jwt, BATCH_B, ACADEMY_B, BATCH_A)
        results.append(("Owner B own batch allowed; Academy A hidden", "PASS"))

        checkpoint = "unmapped genuine Auth user has no app privileges"
        code, rows = postgrest(key, "/rest/v1/batches?select=id",
                              token=smoke_jwt)
        if code != 200 or rows != []:
            raise Ag3Error("Unmapped authenticated user could see protected batches")
        results.append(("Unmapped real Auth user sees zero protected rows", "PASS"))

        checkpoint = "anonymous access denied"
        code, _ = postgrest(key, "/rest/v1/batches?select=id")
        if code not in (401, 403):
            raise Ag3Error("Anonymous request unexpectedly accessed protected table")
        results.append(("Anonymous client denied at table privilege boundary", "PASS"))

        checkpoint = "modified JWT signature denied"
        code, _ = postgrest(key, "/rest/v1/batches?select=id",
                           token=corrupted_signature(owner_a_jwt))
        if code not in (401, 403):
            raise Ag3Error("Forged owner JWT unexpectedly accepted by REST API")
        results.append(("Corrupted bearer JWT rejected", "PASS"))

        checkpoint = "unauthorized update and insert denied"
        code, _ = postgrest(key, "/rest/v1/batches?id=eq." + BATCH_B,
                           token=owner_a_jwt, method="PATCH",
                           payload={"center_id": "c0000000-0000-4000-8000-000000000099"})
        if code not in (401, 403):
            raise Ag3Error("Authenticated owner could update batches without UPDATE grant")
        code, _ = postgrest(key, "/rest/v1/batches",
                           token=owner_b_jwt, method="POST",
                           payload={"id": "b0000000-0000-4000-8000-000000000099",
                                    "center_id": "c0000000-0000-4000-8000-000000000099",
                                    "academy_id": ACADEMY_A})
        if code not in (401, 403):
            raise Ag3Error("Authenticated owner could insert without INSERT grant")
        results.append(("Cross-tenant UPDATE and unauthorized INSERT denied", "PASS"))

        checkpoint = "fresh PostgreSQL permission and data verification"
        if ag2.psql("-At", "-c", STATE_SQL) != EXPECTED_STATE:
            raise Ag3Error("PostgREST activity changed table rows, policies or grants")
        results.append(("Final SQL: 3 users, 2 owners, 2 batches, one policy", "PASS"))
        report(results, True)
        print("AG3.1 PASS: real Auth-issued JWT tenant RLS positive/negative tests",
              flush=True)
        return 0
    except (Ag2Error, Ag3Error, OSError, TimeoutError) as error:
        results.append((checkpoint, "FAIL"))
        report(results, False)
        print("AG3.1 FAIL at: " + checkpoint + " (credential-free diagnostic).",
              flush=True)
        return 1


Ag2Error = ag2.Ag2Error

if __name__ == "__main__":
    sys.exit(main())
