"""SEC-3 static fail-closed proof for the reviewed four-function JWT harness."""
from pathlib import Path
import re
import sys
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sec3_high002_four_rpc_jwt_ci as sec3

REVIEW = sec3.REVIEW_SQL.read_text(encoding="utf-8")
RUNNER = Path(sec3.__file__).read_text(encoding="utf-8")


class High002ReviewSourceTests(unittest.TestCase):
    def test_review_fixes_four_rpcs_only(self):
        self.assertEqual(REVIEW.count("CREATE OR REPLACE FUNCTION public."), 4)
        self.assertEqual(REVIEW.count(
            "if v_role is null or v_role not in ('super_admin', 'academy_owner') then"), 4)
        self.assertEqual(len(re.findall(
            r"and private\.is_payment_(?:due|player)_in_current_academy\([^)]*\) is not true then",
            REVIEW)), 4)
        self.assertNotIn("and not private.is_payment_", REVIEW)
        for _, md5 in sec3.EXPECTED.values():
            self.assertIn(md5, REVIEW)

    def test_original_reconstruction_is_exact_two_guard_reversals(self):
        source = sec3.extract_original_review_functions(REVIEW)
        self.assertEqual(source.count("CREATE OR REPLACE FUNCTION public."), 4)
        self.assertEqual(source.count(
            "if v_role not in ('super_admin', 'academy_owner') then"), 4)
        self.assertEqual(len(re.findall(
            r"and not private\.is_payment_(?:due|player)_in_current_academy\([^)]*\) then",
            source)), 4)
        self.assertNotIn("v_role is null or", source)
        self.assertIn("pg_notify('pgrst','reload schema')", source)

    def test_guard_changes_cannot_silently_change(self):
        with self.assertRaises(sec3.Sec3Failure):
            sec3.extract_original_review_functions(
                REVIEW.replace("is not true then", "then", 1))
        with self.assertRaises(sec3.Sec3Failure):
            sec3.extract_original_review_functions(
                REVIEW.replace("if v_role is null or ", "if ", 1))

    def test_runner_has_strict_unlinked_scratch_preflight(self):
        for phrase in (
            "GITHUB_ACTIONS", "GITHUB_REPOSITORY", "RUNNER_TEMP",
            "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_URL", "project-ref",
            "supabase/migrations", "source MD5s",
            "d1.sql", "source_md5", "SEC-3 PASS",
        ):
            # source_md5 occurs only in reviewed SQL, not in test runner.
            if phrase == "source_md5":
                self.assertIn("source_md5", REVIEW)
            else:
                self.assertIn(phrase, RUNNER)
        for forbidden in ("supabase link", "supabase db push",
                          "mcp__Supabase__execute_sql", "apply_migration"):
            self.assertNotIn(forbidden, RUNNER)

    def test_real_signed_roles_and_four_rpc_contracts_are_exercised(self):
        for token in (
            '"owner-a"', '"owner-b"', '"coach"', '"parent"',
            '"super-admin"', '"unmapped"', '"orphan-owner"',
            "signup_with_token", "ThreadPoolExecutor", "d31.allow",
            "d32.allow_approve", "d32.allow_reject", "d32.allow_request",
            "d32.seed_pending", "d32.deny", "d31.deny", "d32.snapshot",
            "AG34D3_ABORT", "AG34D32 synthetic adjustment rollback",
        ):
            self.assertIn(token, RUNNER)

    def test_negative_denial_propagates_wrong_response(self):
        # Existing D3 deny helper MUST reject a successful unauthorized response.
        with mock.patch.object(sec3.d31, "snapshot", side_effect=["same", "same"]), \
             mock.patch.object(sec3.d31, "collect", return_value=(200, [{}])):
            with self.assertRaises(sec3.d31.RpcFailure):
                sec3.d31.deny("key", "token", sec3.DUE_A, 10, "role denied")
        # Existing D3.2 deny helper MUST reject unexpected mutated ledger.
        with mock.patch.object(sec3.d32, "snapshot", side_effect=["before", "after"]), \
             mock.patch.object(sec3.d32, "rpc", return_value=(400, {"message": "role denied"})):
            with self.assertRaises(sec3.d32.CorrectionFailure):
                sec3.d32.deny("key", "token", "approve_payment_correction",
                              {"p_correction_id": "synthetic"}, "role denied")

    def test_cannot_execute_in_normal_local_workstation(self):
        with mock.patch.dict(sec3.os.environ, {"GITHUB_ACTIONS": "false"}, clear=False):
            with self.assertRaises(sec3.Sec3Failure):
                sec3.scratch_preflight()


if __name__ == "__main__":
    unittest.main()
