#!/usr/bin/env python3
"""Pure fail-closed contract tests; does not connect to Supabase."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/devbot"))
import ag3_4d33_upi_rpc_jwt_ci as d33

SOURCE = (ROOT / "supabase/tests/security/ag34d33_live_upi_rpcs_scratch.sql").read_text()
CANDIDATE = (ROOT / "supabase/tests/security/ag34d33_upi_null_role_scratch_candidate.sql").read_text()
RUNNER = (ROOT / "scripts/devbot/ag3_4d33_upi_rpc_jwt_ci.py").read_text()


class UpiSecurityContract(unittest.TestCase):
    def test_all_three_original_sources_are_pinned(self):
        for name, digest in (
            ("submit_parent_upi_payment", "d3788514af85e404504861936cfef20e"),
            ("review_parent_upi_payment", "33852ded2505672448ed44ccf46a43e2"),
            ("record_accepted_parent_upi_submission", "ff98c595f28944f33b7a8f50b4177722"),
        ):
            self.assertIn("CREATE OR REPLACE FUNCTION public." + name, SOURCE)
            self.assertIn(digest, SOURCE)
            self.assertIn(digest, CANDIDATE)
        self.assertIn("OR (SELECT count(*) FROM auth.users)<>29", SOURCE)
        self.assertIn("(SELECT count(*) FROM public.users)<>26", SOURCE)
        self.assertIn("OR (SELECT count(*) FROM auth.users)<>36", CANDIDATE)
        self.assertIn("(SELECT count(*) FROM public.users)<>32", CANDIDATE)

    def test_source_and_candidate_role_comparisons_are_distinct(self):
        self.assertIn("IF private.current_user_role() <> 'parent' THEN", SOURCE)
        self.assertIn("IF v_role <> 'academy_owner' THEN", SOURCE)
        self.assertIn("IF v_submission.academy_id <> (SELECT private.current_academy_id())", SOURCE)
        self.assertIn("IF private.current_user_role() IS DISTINCT FROM 'parent' THEN", CANDIDATE)
        self.assertEqual(CANDIDATE.count("IF v_role IS DISTINCT FROM 'academy_owner' THEN"), 2)
        self.assertIn("v_submission.academy_id IS DISTINCT FROM", CANDIDATE)
        self.assertNotIn("IF v_role IS DISTINCT FROM 'academy_owner' THEN", SOURCE)

    def test_acl_and_transaction_are_explicit(self):
        self.assertEqual(SOURCE.count("REVOKE ALL ON FUNCTION public."), 3)
        self.assertEqual(SOURCE.count("GRANT EXECUTE ON FUNCTION public."), 3)
        self.assertIn("REVOKE", SOURCE)
        self.assertIn("NOTIFY pgrst,'reload schema'", SOURCE)
        self.assertIn("UNLINKED DISPOSABLE", SOURCE)
        self.assertIn("OR has_table_privilege('authenticated','public.parent_payment_submissions','INSERT')", SOURCE)
        self.assertIn("CREATE UNIQUE INDEX ag34d33_unique_active_due", SOURCE)
        self.assertIn("CREATE UNIQUE INDEX ag34d33_unique_payment_link", SOURCE)
        self.assertIn("BEGIN;", CANDIDATE)
        self.assertIn("COMMIT;", CANDIDATE)

    def test_only_scratch_host_is_used(self):
        for forbidden in ("ulyealhkmlorsbdiknrh", "borsjaktqcuicmuiuldc",
                          "supabase link", "supabase db push", "apply_migration",
                          "service_role"):
            self.assertNotIn(forbidden, RUNNER)
        for guard in ("RUNNER_TEMP", "GITHUB_ACTIONS", "GITHUB_REPOSITORY",
                      "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_URL",
                      "project-ref", "supabase/migrations", "auth.users"):
            if guard == "supabase/migrations":
                self.assertIn('"supabase/migrations"', RUNNER)
            else:
                self.assertIn(guard, RUNNER)

    def test_real_jwt_negative_positive_and_financial_scenarios_are_written(self):
        for marker in ("source original unmapped Parent submission denied by existing FK relationship",
                       "original NULL-role Owner review reproduction on seeded pending claim",
                       "downstream NULL-safe tenant denial",
                       "install scratch-only strict UPI role",
                       "anonymous and forged bearer",
                       "positive Parent A submits",
                       "stale accepted amount rejected atomically",
                       "already been recorded",
                       "duplicate key",
                       "AG3.4E NO_GO"):
            self.assertIn(marker, RUNNER)

    def test_denial_fails_closed_for_wrong_error(self):
        with patch.object(d33, "snapshot", return_value="unchanged"), \
             patch.object(d33, "rpc", return_value=(400, {"message": "Missing column"})):
            with self.assertRaises(d33.UpiFailure):
                d33.deny("key", "token", "review_parent_upi_payment", {}, d33.ROLE_REVIEW)

    def test_denial_fails_closed_for_success(self):
        with patch.object(d33, "snapshot", return_value="unchanged"), \
             patch.object(d33, "rpc", return_value=(200, {"status": "accepted"})):
            with self.assertRaises(d33.UpiFailure):
                d33.deny("key", "token", "review_parent_upi_payment", {}, d33.ROLE_REVIEW)

    def test_denial_fails_closed_if_state_changes(self):
        with patch.object(d33, "snapshot", side_effect=["before", "after"]), \
             patch.object(d33, "rpc", return_value=(400, {"message": d33.ROLE_REVIEW})):
            with self.assertRaises(d33.UpiFailure):
                d33.deny("key", "token", "review_parent_upi_payment", {}, d33.ROLE_REVIEW)

    def test_authorized_response_requires_correct_status_and_uuid(self):
        with patch.object(d33, "rpc", return_value=(200, {"status": "accepted",
                                                           "id": "not-a-uuid"})):
            with self.assertRaises(d33.UpiFailure):
                d33.allowed("key", "token", "review_parent_upi_payment", {}, "accepted")

    def test_rpc_allowlist_rejects_non_upi_function(self):
        with self.assertRaises(ValueError):
            d33.rpc("key", "token", "collect_payment", {})


    def test_duplicate_due_conflict_must_match_exact_index_message(self):
        with patch.object(d33, "snapshot", return_value="unchanged"), \
             patch.object(d33, "rpc", return_value=(409, {"message": "duplicate key value violates unique constraint"})):
            d33.deny("key", "token", "submit_parent_upi_payment", {}, "duplicate key")
            with self.assertRaises(d33.UpiFailure):
                d33.deny("key", "token", "submit_parent_upi_payment", {}, d33.ROLE_SUBMIT)

    def test_wrapper_rollback_and_signed_owner_race_are_explicit(self):
        self.assertIn("CREATE TRIGGER ag34d33_abort_recording", SOURCE)
        self.assertIn("AG34D33 synthetic wrapper rollback", SOURCE)
        self.assertIn("ThreadPoolExecutor(max_workers=2)", RUNNER)
        self.assertIn("future.result(timeout=35)", RUNNER)
        self.assertIn("before_count + 1", RUNNER)
        self.assertIn("DROP TRIGGER ag34d33_abort_recording", RUNNER)
        self.assertIn("DROP FUNCTION private.ag34d33_abort_after_payment()", RUNNER)
        self.assertIn("claim_state(fault[\"id\"]) != \"accepted|-\"", RUNNER)
        self.assertIn("p.external_transaction_reference='AG34D33_RACE'", RUNNER)


    def test_parent_fk_boundary_is_not_weakened_to_force_submission_bypass(self):
        self.assertNotIn("DROP CONSTRAINT", SOURCE.upper())
        self.assertNotIn("ALTER TABLE public.parents", SOURCE)
        self.assertNotIn("ALTER TABLE public.users", SOURCE)
        self.assertIn("Parent profile not found", RUNNER)
        self.assertIn("original unmapped Parent submission denied by linked-profile boundary", RUNNER)
        self.assertIn("original NULL-role Owner review reproduction on seeded pending claim", RUNNER)
        self.assertIn("AG34-HIGH-002 D3.3 REPRODUCED", RUNNER)


if __name__ == "__main__":
    unittest.main()
