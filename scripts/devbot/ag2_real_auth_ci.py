#!/usr/bin/env python3
"""AG2 CI-only real GoTrue auth with nonhistorical, disposable synthetic tables.

No hosted service, historical replay or production credentials. No token logging.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

ROOT = Path(__file__).resolve().parents[2]
PROJECT = "kheltriva-ag2-ci"
CONTAINER = "supabase_db_" + PROJECT
API_URL = "http://127.0.0.1:54321"
FIXTURES = (
    "ps_l2_3_b2_9_c3_native_schema.sql",
    "ps_l2_3_b2_9_c33b_precheck.sql",
    "ps_l2_3_b2_9_live_helper_snapshot.sql",
    "ps_l2_3_b2_9_c33b_postcheck.sql",
    "ps_l2_3_b2_9_c34b1_owner_a_mapping.sql",
    "ps_l2_3_b2_9_c34b2_owner_b_mapping.sql",
)
FIXTURE_PATH = ROOT / "supabase" / "tests" / "subscriptions"
STATE_SQL = """
SELECT
 (SELECT count(*) FROM auth.users),
 (SELECT count(*) FROM public.users),
 (SELECT count(*) FROM public.coaches),
 (SELECT count(*) FROM public.coach_batches),
 (SELECT count(*) FROM public.coach_batch_assignments),
 (SELECT count(*) FROM public.batches),
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private'),
 (SELECT count(*) FROM public.users WHERE role='academy_owner'
   AND academy_id='a0000000-0000-4000-8000-000000000001'::uuid),
 (SELECT count(*) FROM public.users WHERE role='academy_owner'
   AND academy_id='a0000000-0000-4000-8000-000000000002'::uuid),
 has_schema_privilege('anon','private','USAGE'),
 has_schema_privilege('authenticated','private','USAGE'),
 has_table_privilege('authenticated','public.users','SELECT'),
 has_table_privilege('authenticated','public.batches','SELECT');
"""
EXPECTED = "3|2|0|0|0|2|11|1|1|f|t|f|f"


class Ag2Error(Exception):
    """Errors with no local credentials or JWT contents."""


def local_status(text: str) -> str:
    api = re.search(r'^API_URL="?([^"\r\n]+)"?\s*$', text, flags=re.M)
    key = re.search(r'^PUBLISHABLE_KEY="?(sb_publishable_[A-Za-z0-9_-]+)"?\s*$',
                    text, flags=re.M)
    if not api or not key or api.group(1) != API_URL:
        raise Ag2Error("Local API URL/key isolation guard failed")
    return key.group(1)


def command(args: list[str], *, marker: str | None = None) -> str:
    completed = subprocess.run(args, text=True, capture_output=True,
                               check=False, timeout=90)
    if completed.returncode != 0:
        raise Ag2Error("Disposable database fixture or SQL step failed")
    output = completed.stdout.strip()
    if marker is not None and marker not in output:
        raise Ag2Error("Pinned SQL verification marker absent")
    return output


def psql(*arguments: str, marker: str | None = None) -> str:
    return command(["docker", "exec", CONTAINER, "psql", "-U", "postgres",
                    "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1",
                    *arguments], marker=marker)


def auth_json(path: str, key: str, *, token: str | None = None,
              payload: dict[str, str] | None = None) -> dict:
    headers = {"apikey": key}
    if token is not None:
        headers["Authorization"] = "Bearer " + token
    body = None
    method = "GET"
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
        method = "POST"
    req = Request(API_URL + path, data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=20) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError, ValueError):
        raise Ag2Error("Real local GoTrue HTTP request failed") from None


def signup(key: str, label: str) -> str:
    email = "b29-" + label + "-" + secrets.token_hex(6) + "@example.test"
    password = secrets.token_urlsafe(24) + "Aa9!"
    signed_up = auth_json("/auth/v1/signup", key,
                          payload={"email": email, "password": password})
    token, user = signed_up.get("access_token"), signed_up.get("user")
    if not isinstance(token, str) or not token or not isinstance(user, dict):
        raise Ag2Error("GoTrue signup did not issue a bearer session")
    verified = auth_json("/auth/v1/user", key, token=token)
    if verified.get("id") != user.get("id") or verified.get("email") != email:
        raise Ag2Error("GoTrue bearer session identity mismatch")
    try:
        return str(UUID(str(verified["id"])))
    except (ValueError, KeyError, TypeError):
        raise Ag2Error("GoTrue response has invalid identity UUID") from None


def rejects_invalid_token(key: str) -> bool:
    request = Request(API_URL + "/auth/v1/user",
                      headers={"apikey": key, "Authorization": "Bearer invalid-ag2-jwt"})
    try:
        with urlopen(request, timeout=20):
            return False
    except HTTPError as error:
        return error.code in (401, 403)
    except (URLError, TimeoutError):
        raise Ag2Error("GoTrue unavailable for invalid token test") from None


def prepare_fixtures() -> None:
    for name in FIXTURES:
        path = FIXTURE_PATH / name
        if not path.is_file():
            raise Ag2Error("Pinned synthetic fixture missing")
        command(["docker", "cp", str(path), CONTAINER + ":/tmp/" + name])


def mapping_sql(filename: str, user_id: str, marker: str) -> None:
    psql("--single-transaction", "-v", "owner_uuid=" + str(UUID(user_id)),
         "-f", "/tmp/" + filename, marker=marker)


def summary(rows: list[tuple[str, str]], success: bool) -> None:
    lines = [
        "## DevBot AG2 — real disposable Supabase Auth",
        "", "**Result: " + ("PASS" if success else "FAIL") + "**",
        "", "| Checkpoint | Status |", "| --- | --- |",
    ]
    lines.extend("| " + name + " | " + result + " |" for name, result in rows)
    lines.extend([
        "", "**Verified only:** GoTrue-issued sessions, rejected invalid JWT,",
        "synthetic owner-role FK mappings, pinned helper and permission checks.",
        "", "**Not yet tested:** PostgREST positive/negative cross-tenant RLS;",
        "historical migration parity, Storage, finance or production readiness.",
        "", "**Isolation:** ephemeral GitHub runner, no hosted Supabase or paid AI.",
        "",
    ])
    report = "\n".join(lines)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as target:
            target.write(report)
    else:
        print(report)


def main() -> int:
    rows: list[tuple[str, str]] = []
    checkpoint = "CI isolation"
    try:
        scratch = Path(os.environ.get("RUNNER_TEMP", "/not-on-runner")) / PROJECT
        if (os.environ.get("GITHUB_ACTIONS") != "true" or
            os.environ.get("GITHUB_REPOSITORY") != "saurabh-shelke1993/acadpro-app" or
            scratch.resolve() != Path.cwd().resolve() or
            not (scratch / "supabase" / "config.toml").is_file() or
            (scratch / "supabase" / "migrations").exists() or
            (scratch / "supabase" / ".temp" / "project-ref").exists()):
            raise Ag2Error("Not a fresh unlinked GitHub-only Supabase project")
        checkpoint = "native local stack"
        if command(["docker", "inspect", "-f", "{{.State.Health.Status}}", CONTAINER]) != "healthy":
            raise Ag2Error("Expected local Postgres container is unhealthy")
        status = subprocess.run(["supabase", "status", "-o", "env"],
                                capture_output=True, text=True, timeout=25)
        if status.returncode != 0:
            raise Ag2Error("Local Supabase CLI status failed")
        key = local_status(status.stdout)
        rows.append(("CI-only native GoTrue/Postgres stack", "PASS"))
        checkpoint = "synthetic schema"
        prepare_fixtures()
        psql("-f", "/tmp/" + FIXTURES[0], marker="COMMIT")
        rows.append(("Five RLS-enabled synthetic tables", "PASS"))
        checkpoint = "private helper installation"
        psql("--single-transaction", "-f", "/tmp/" + FIXTURES[1],
             "-f", "/tmp/" + FIXTURES[2], "-f", "/tmp/" + FIXTURES[3],
             marker="C3.3B CURRENT HELPERS VERIFIED")
        rows.append(("Eleven pinned helpers and permission checks", "PASS"))
        checkpoint = "invalid bearer negative test"
        if not rejects_invalid_token(key):
            raise Ag2Error("Invalid JWT unexpectedly accepted")
        rows.append(("Invalid JWT rejected by real GoTrue", "PASS"))
        checkpoint = "unmapped real Auth signup"
        smoke = signup(key, "c34a")
        rows.append(("Unmapped real GoTrue Auth session", "PASS"))
        checkpoint = "Academy Owner A real Auth mapping"
        owner_a = signup(key, "c34b1-ao-a")
        mapping_sql(FIXTURES[4], owner_a, "B2.9-C3.4B1 OWNER A MAPPING VERIFIED")
        rows.append(("Owner A Auth-issued UUID and app role", "PASS"))
        checkpoint = "Academy Owner B real Auth mapping"
        owner_b = signup(key, "c34b2-ao-b")
        if len({smoke, owner_a, owner_b}) != 3:
            raise Ag2Error("Auth identity UUIDs are not unique")
        mapping_sql(FIXTURES[5], owner_b, "B2.9-C3.4B2 OWNER B MAPPING VERIFIED")
        rows.append(("Owner B Auth-issued UUID and app role", "PASS"))
        checkpoint = "fresh native PostgreSQL verification"
        if psql("-At", "-c", STATE_SQL) != EXPECTED:
            raise Ag2Error("Synthetic postconditions or RLS privileges changed")
        rows.append(("3 Auth, 2 scoped owners, 2 batches, 11 helpers", "PASS"))
        rows.append(("Cross-academy RLS via PostgREST (AG3)", "NOT TESTED"))
        summary(rows, True)
        print("AG2 PASS: native local GoTrue sessions and FK owner mappings", flush=True)
        return 0
    except (Ag2Error, OSError, subprocess.TimeoutExpired):
        rows.append((checkpoint, "FAIL"))
        summary(rows, False)
        print("AG2 FAIL at checkpoint: " + checkpoint +
              ". See scoped CI tests; sensitive output withheld.", flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
