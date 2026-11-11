"""AG34-H2 offline integrity tests for a staged, never-deployed migration."""
from __future__ import annotations
import re
import sys
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ag34_h2_rollout_rehearsal_ci as h2
import ag34_h1_legacy_lockdown_ci as h1
import ag3_4b_live_mapping_ci as b


class H2RolloutGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.migration = h2.MIGRATION.read_text(encoding="utf-8")
        cls.original = h2.ORIGINAL.read_text(encoding="utf-8")
        cls.downshift = h2.DOWNSHIFT.read_text(encoding="utf-8")
        cls.preflight = (h2.ROOT / "supabase/security_remediation_proposals/ag34_h2_read_only_hosted_preflight.sql").read_text(encoding="utf-8")
        cls.postflight = h2.POSTFLIGHT.read_text(encoding="utf-8")
        cls.runner = Path(h2.__file__).read_text(encoding="utf-8")

    def test_cli_generated_name_and_one_explicit_candidate(self):
        self.assertRegex(h2.MIGRATION.name, r"^\d{14}_ag34_h1_legacy_coach_batches_client_lockdown\.sql$")
        self.assertEqual(h2.MIGRATION.name, "20261111165330_ag34_h1_legacy_coach_batches_client_lockdown.sql")
        self.assertTrue(h2.MIGRATION.is_file())
        self.assertIn("CLI v3.0.0", self.migration)

    def test_migration_sql_body_byte_for_byte_matches_reviewed_source(self):
        h2.verify_cli_migration_body()
        source = self.original.split("\nBEGIN;\n", 1)[1].lstrip("\n")
        expected = source.replace("\nCOMMIT;\n", "\n", 1)
        self.assertEqual(expected, "DO $ag34_h1_preflight$" +
                         self.migration.split("\nDO $ag34_h1_preflight$", 1)[1])
        self.assertNotIn("\nBEGIN;\n", self.migration)
        self.assertNotIn("\nCOMMIT;\n", self.migration)

    def test_migration_is_unapplied_and_source_locked(self):
        for expected in ("NOT APPLIED", "82 live versions vs 40",
                         "(SELECT count(*) FROM public.coach_batches)<>0",
                         "REVOKE ALL PRIVILEGES ON TABLE public.coach_batches",
                         "AS RESTRICTIVE", "USING (false) WITH CHECK (false)",
                         "NOTIFY pgrst, 'reload schema'"):
            self.assertIn(expected, self.migration)
        for digest in ("cd4193d15352dcfb25a4b3835e8850a4",
                       "957ab744836d9772e4258c85504827c0",
                       "7a3ff298bc791c74727729a21549b844",
                       "f82e68e0224f4417a0e0e7a0897be20e"):
            self.assertIn(digest, self.migration)

    def test_downshift_fails_closed_and_never_restores_unsafe_grants(self):
        for expected in ("LOCK TABLE public.coach_batches IN ACCESS EXCLUSIVE MODE",
                         "DROP POLICY coach_batches_legacy_closed",
                         "has_table_privilege('authenticated','public.coach_batches','SELECT')",
                         "AG34-H2 EMERGENCY GRANTS-STILL-REVOKED VERIFIED"):
            self.assertIn(expected, self.downshift)
        self.assertNotIn("GRANT ", self.downshift.replace("GRANTS-STILL-REVOKED", ""))
        self.assertNotIn("DROP TABLE", self.downshift)
        self.assertNotIn("UPDATE public.coach_batch_assignments", self.downshift)

    def test_operator_preflight_and_postflight_are_read_only(self):
        for script in (self.preflight, self.postflight):
            no_comments = re.sub(r"(?m)^\s*--.*$", "", script)
            self.assertNotRegex(no_comments, r"(?im)^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|DO|CALL|NOTIFY)\b")
            self.assertIn("public.coach_batch_assignments", no_comments)
        self.assertIn("READY_FOR_SEPARATE_PRODUCTION_APPROVAL", self.preflight)
        self.assertIn("STOP_DO_NOT_DEPLOY", self.preflight)
        self.assertIn("PASS_POLICY_LOCKDOWN", self.postflight)
        self.assertIn("STOP_INVESTIGATE_NO_REGRANTS", self.postflight)

    def test_three_legacy_helper_fingerprints_pinned(self):
        for digest in ("904f63449638d7d62256cd6c646024eb",
                       "6fa7c6666752421100f54806a3dc8605",
                       "dade30c21e9d96cf284dc7e028d3eeb6"):
            self.assertIn(digest, self.preflight)
            self.assertIn(digest, self.postflight)

    def test_runner_only_reuses_unlinked_native_parent_test(self):
        self.assertIn("b.main(on_live_snapshot=verify_forward_and_downshift)", self.runner)
        self.assertIn("h.lock_under_real_jwts(key, tokens)", self.runner)
        self.assertIn("verify_postflight_sql()", self.runner)
        self.assertIn("downshift_still_closed(key, tokens)", self.runner)
        self.assertEqual(len(h1.ROLE_NAMES), 8)

    def test_reapply_can_never_be_counted_as_success(self):
        self.assertIn("except b.SecurityMismatch:", self.runner)
        self.assertIn("repeated migration unexpectedly succeeded", self.runner)
        self.assertIn("failed reapply affected scratch state", self.runner)

    def test_readonly_postflight_must_be_an_explicit_pass(self):
        with mock.patch.object(b, "sql", return_value="STOP_INVESTIGATE_NO_REGRANTS|x"):
            with self.assertRaises(b.SecurityMismatch):
                h2.verify_postflight_sql()
        with mock.patch.object(b, "sql", return_value="PASS_POLICY_LOCKDOWN|x"):
            h2.verify_postflight_sql()

    def test_release_gate_remains_no_go(self):
        import json
        gate = json.loads((h2.ROOT / "frontend/docs/AG3_4E_SECURITY_RELEASE_GATE.json").read_text())
        self.assertEqual(gate["production_decision"], "NO_GO")
        self.assertFalse(gate["production_release_requirements"]["coach_mapping_production_policy_remediation_verified"])
        high = next(x for x in gate["blocking_findings"] if x["id"] == "AG34-HIGH-001")
        self.assertEqual(high["status"], "open")


if __name__ == "__main__":
    unittest.main()
