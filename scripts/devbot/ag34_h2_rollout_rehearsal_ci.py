#!/usr/bin/env python3
"""AG34-H2: rehearse canonical forward migration and safe emergency downshift.

Runs with the AG3.4B source-attested native GoTrue/JWT/PostgREST fixture.
NEVER touches hosted Supabase, production data, or migration ledger.
"""
from __future__ import annotations
from pathlib import Path
import sys

import ag3_4b_live_mapping_ci as b
import ag34_h1_legacy_lockdown_ci as h

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20261111165330_ag34_h1_legacy_coach_batches_client_lockdown.sql"
DOWNSHIFT = ROOT / "supabase/security_remediation_proposals/ag34_h2_emergency_grants_only_downshift.sql"
POSTFLIGHT = ROOT / "supabase/security_remediation_proposals/ag34_h2_read_only_hosted_postflight.sql"
ORIGINAL = h.PROPOSAL
EMERGENCY_MARKER = "AG34-H2 EMERGENCY GRANTS-STILL-REVOKED VERIFIED"


def verify_cli_migration_body() -> None:
    source = ORIGINAL.read_text(encoding="utf-8")
    migration = MIGRATION.read_text(encoding="utf-8")
    original_start = source.find("BEGIN;\n")
    migration_start = migration.find("BEGIN;\n")
    if original_start < 0 or migration_start < 0:
        raise b.SecurityMismatch("AG34-H2 reviewed transaction delimiter missing")
    if source[original_start:] != migration[migration_start:]:
        raise b.SecurityMismatch("AG34-H2 canonical migration differs from reviewed JWT-tested source")
    if "NOT APPLIED" not in migration[:migration_start]:
        raise b.SecurityMismatch("AG34-H2 migration needs explicit release restriction")


def verify_postflight_sql() -> None:
    sql = POSTFLIGHT.read_text(encoding="utf-8")
    if any(command in sql.upper() for command in ("DROP POLICY", "REVOKE ALL", "GRANT SELECT", "DELETE FROM")):
        raise b.SecurityMismatch("AG34-H2 hosted postflight cannot contain mutation")
    observed = b.sql("-At", "-c", sql)
    if not observed.startswith("PASS_POLICY_LOCKDOWN|"):
        raise b.SecurityMismatch("AG34-H2 read-only lockdown postflight did not pass in scratch")


def downshift_still_closed(key: str, tokens: dict[str, str]) -> None:
    if not DOWNSHIFT.is_file():
        raise b.SecurityMismatch("AG34-H2 emergency source missing")
    b.safe(["docker", "cp", str(DOWNSHIFT), b.CONTAINER + ":/tmp/" + DOWNSHIFT.name])
    b.sql("-f", "/tmp/" + DOWNSHIFT.name, marker=EMERGENCY_MARKER)
    if b.db_counts() != "9|8|0|4|11":
        raise b.SecurityMismatch("AG34-H2 emergency downshift changed scratch data or helper count")
    query = """SELECT
      has_table_privilege('authenticated','public.coach_batches','SELECT'),
      has_table_privilege('authenticated','public.coach_batches','INSERT'),
      has_table_privilege('authenticated','public.coach_batches','UPDATE'),
      has_table_privilege('authenticated','public.coach_batches','DELETE'),
      has_table_privilege('anon','public.coach_batches','SELECT'),
      (SELECT count(*) FROM public.coach_batch_assignments);"""
    if b.sql("-At", "-c", query) != "f|f|f|f|f|3":
        raise b.SecurityMismatch("AG34-H2 emergency downshift re-opened client access")
    for role in h.ROLE_NAMES:
        token = tokens[role]
        h.must_get_denied(key, token)
        for method in ("POST", "PATCH", "DELETE"):
            h.must_write_denied(key, token, method)
    h.must_get_denied(key, None)
    b.ag32.read_scoped(key, tokens["coach_a"],
                       [{"id": b.ag3.BATCH_A, "academy_id": b.ag3.ACADEMY_A}])
    b.ag32.read_scoped(key, tokens["owner_b"],
                       [{"id": b.ag3.BATCH_B, "academy_id": b.ag3.ACADEMY_B}])
    # A second attempt to apply the canonical candidate must FAIL because
    # original grants were revoked. Never repair history or rerun on hosted.
    b.safe(["docker", "cp", str(MIGRATION), b.CONTAINER + ":/tmp/" + MIGRATION.name])
    try:
        b.sql("-f", "/tmp/" + MIGRATION.name)
    except b.SecurityMismatch:
        pass
    else:
        raise b.SecurityMismatch("AG34-H2 repeated migration unexpectedly succeeded")
    if b.db_counts() != "9|8|0|4|11":
        raise b.SecurityMismatch("AG34-H2 failed reapply affected scratch state")
    print("AG34-H2 PASS: safe emergency downshift keeps all direct client access denied",
          flush=True)


def verify_forward_and_downshift(key: str, tokens: dict[str, str]) -> None:
    verify_cli_migration_body()
    # Run existing exhaustive AG34-H1 real-JWT lockdown first. The source
    # transaction body is byte-equal to the canonical migration candidate.
    h.lock_under_real_jwts(key, tokens)
    verify_postflight_sql()
    downshift_still_closed(key, tokens)
    print("AG34-H2 PASS: canonical migration source parity, native JWT "
          "lockdown, read-only postflight and emergency recovery rehearsed", flush=True)


if __name__ == "__main__":
    sys.exit(b.main(on_live_snapshot=verify_forward_and_downshift))
