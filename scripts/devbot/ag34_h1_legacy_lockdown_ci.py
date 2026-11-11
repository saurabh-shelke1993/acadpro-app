#!/usr/bin/env python3
"""AG34-HIGH-001: revoke legacy Coach mapping client access under signed JWTs.

Runs exclusively in the existing AG3.4B source-attested unlinked native Supabase.
Never executes against a hosted Supabase project or on customer data.
"""
from __future__ import annotations
from pathlib import Path
import sys

import ag3_4b_live_mapping_ci as b

ROOT = Path(__file__).resolve().parents[2]
PROPOSAL = ROOT / "supabase/security_remediation_proposals/ag34_h1_legacy_coach_batches_lockdown.sql"
LOCK_MARKER = "AG34-H1 LEGACY COACH MAPPING CLIENT LOCKDOWN VERIFIED"
EXPECTED_IDS = {b.LINKED, b.INACTIVE, b.FOREIGN}
ROLE_NAMES = (
    "owner_a", "owner_b", "coach_a", "coach_b",
    "parent_a1", "parent_a2", "parent_b", "super_admin",
)


def check_scratch_baseline() -> None:
    if b.db_counts() != "9|8|3|4|11":
        raise b.SecurityMismatch("AG34-H1 source-attested scratch baseline changed")
    ids = b.sql("-At", "-c",
                "SELECT id::text FROM public.coach_batches ORDER BY id::text;")
    if set(ids.splitlines()) != EXPECTED_IDS:
        raise b.SecurityMismatch("AG34-H1 unexpected scratch legacy mapping IDs")


def assert_no_client_privileges() -> None:
    query = """SELECT
      has_table_privilege('authenticated','public.coach_batches','SELECT'),
      has_table_privilege('authenticated','public.coach_batches','INSERT'),
      has_table_privilege('authenticated','public.coach_batches','UPDATE'),
      has_table_privilege('authenticated','public.coach_batches','DELETE'),
      has_table_privilege('anon','public.coach_batches','SELECT'),
      has_table_privilege('anon','public.coach_batches','INSERT'),
      (SELECT count(*) FROM pg_policies WHERE schemaname='public'
         AND tablename='coach_batches' AND policyname='coach_batches_legacy_closed'
         AND permissive='RESTRICTIVE' AND cmd='ALL'
         AND qual='false' AND with_check='false'),
      (SELECT count(*) FROM public.coach_batches),
      (SELECT count(*) FROM public.coach_batch_assignments);"""
    if b.sql("-At", "-c", query) != "f|f|f|f|f|f|1|0|3":
        raise b.SecurityMismatch("AG34-H1 SQL grants, RLS or unaffected assignments mismatch")


def must_get_denied(key: str, token: str | None) -> None:
    status, rows = b.rest(key, token)
    if status not in (401, 403):
        raise b.SecurityMismatch("AG34-H1 direct legacy SELECT unexpectedly succeeded")


def must_write_denied(key: str, token: str, method: str) -> None:
    payload = {"id": b.PROBE, "coach_id": b.CROSS_COACH,
               "batch_id": b.ag3.BATCH_A} if method == "POST" else (
               {"coach_id": b.CROSS_COACH} if method == "PATCH" else None)
    status, rows = b.rest(key, token, method=method, id_filter=(
                          b.LINKED if method != "POST" else None), payload=payload)
    if status not in (401, 403):
        raise b.SecurityMismatch("AG34-H1 direct legacy mutation unexpectedly allowed")


def lock_under_real_jwts(key: str, tokens: dict[str, str]) -> None:
    if set(tokens) != set(ROLE_NAMES):
        raise b.SecurityMismatch("AG34-H1 original native JWT role matrix missing")
    check_scratch_baseline()
    # Only these three invented scratch records are deleted. Production SQL
    # itself has a separate fail-closed ZERO-ROW preflight and deletes nothing.
    b.sql("-c", "DELETE FROM public.coach_batches WHERE id IN (" +
          ",".join("'" + item + "'::uuid" for item in sorted(EXPECTED_IDS)) + ");")
    if b.db_counts() != "9|8|0|4|11":
        raise b.SecurityMismatch("AG34-H1 invented scratch rows were not isolated")
    if not PROPOSAL.is_file():
        raise b.SecurityMismatch("AG34-H1 checked-in proposed SQL missing")
    b.safe(["docker", "cp", str(PROPOSAL),
            b.CONTAINER + ":/tmp/" + PROPOSAL.name])
    b.sql("-f", "/tmp/" + PROPOSAL.name, marker=LOCK_MARKER)
    if b.db_counts() != "9|8|0|5|11":
        raise b.SecurityMismatch("AG34-H1 unexpected table or policy counts after lockdown")
    assert_no_client_privileges()

    # Direct API denial for every actual signed GoTrue account, including
    # Super Admin (the deprecated mapping table is closed to ALL clients).
    for role in ROLE_NAMES:
        token = tokens[role]
        must_get_denied(key, token)
        for method in ("POST", "PATCH", "DELETE"):
            must_write_denied(key, token, method)
    must_get_denied(key, None)

    # Defense in depth: in scratch ONLY, intentionally simulate a future
    # accidental re-GRANT plus a privileged synthetic row. Restrictive RLS
    # must still hide the row and deny mutation across every app role.
    b.sql("-c", "INSERT INTO public.coach_batches(id,coach_id,batch_id) VALUES (" +
          "'" + b.PROBE + "'::uuid,'" + b.ag32.COACH_A_ID +
          "'::uuid,'" + b.ag3.BATCH_A + "'::uuid);")
    b.sql("-c", "GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_batches TO authenticated;")
    for role in ROLE_NAMES:
        token = tokens[role]
        status, rows = b.rest(key, token)
        if status != 200 or rows != []:
            raise b.SecurityMismatch("AG34-H1 restrictive RLS failed against re-GRANT")
        status, rows = b.rest(key, token, method="POST",
                              payload={"id": b.LINKED, "coach_id": b.ag32.COACH_A_ID,
                                       "batch_id": b.ag3.BATCH_A})
        if status not in (401, 403):
            raise b.SecurityMismatch("AG34-H1 restrictive RLS INSERT failed against re-GRANT")
        for method in ("PATCH", "DELETE"):
            payload = {"coach_id": b.CROSS_COACH} if method == "PATCH" else None
            status, rows = b.rest(key, token, method=method,
                                  id_filter=b.PROBE, payload=payload)
            if not (status in (401, 403) or
                    (status in (200, 204) and rows in (None, []))):
                raise b.SecurityMismatch("AG34-H1 restrictive RLS mutation failed")
    if b.sql("-At","-c","SELECT count(*) FROM public.coach_batches WHERE id='" +
             b.PROBE + "'::uuid AND coach_id='" + b.ag32.COACH_A_ID + "'::uuid") != "1":
        raise b.SecurityMismatch("AG34-H1 RLS failed to preserve synthetic probe row")

    b.sql("-c", "DELETE FROM public.coach_batches WHERE id='" + b.PROBE + "'::uuid;")
    b.sql("-c", "REVOKE ALL PRIVILEGES ON public.coach_batches FROM PUBLIC, anon, authenticated;")
    assert_no_client_privileges()

    # Regression: the active Coach assignment, batch and Parent-linked
    # access remain intact after closing only the unused legacy mapping.
    if b.sql("-At", "-c",
             "SELECT count(*) FROM public.coach_batch_assignments") != "3":
        raise b.SecurityMismatch("AG34-H1 modern Coach assignments were modified")
    b.ag32.read_scoped(key, tokens["coach_a"],
                       [{"id": b.ag3.BATCH_A, "academy_id": b.ag3.ACADEMY_A}])
    b.ag32.read_scoped(key, tokens["owner_b"],
                       [{"id": b.ag3.BATCH_B, "academy_id": b.ag3.ACADEMY_B}])
    b.ag32.read_scoped(key, tokens["super_admin"],
                       [{"id": b.ag3.BATCH_A, "academy_id": b.ag3.ACADEMY_A},
                        {"id": b.ag3.BATCH_B, "academy_id": b.ag3.ACADEMY_B},
                        {"id": b.ag32.BATCH_INACTIVE_A, "academy_id": b.ag3.ACADEMY_A}])
    print("AG34-H1 PASS: eight signed app JWTs and anon denied; modern mapping intact",
          flush=True)


if __name__ == "__main__":
    sys.exit(b.main(on_live_snapshot=lock_under_real_jwts))
