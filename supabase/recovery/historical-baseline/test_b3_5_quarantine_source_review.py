"""B3.5 pure/synthetic quarantine SQL review tests. Never fetches actual SQL."""
import contextlib
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

from b3_5_quarantine_source_review import (
    CHECKS, REGISTER, RECOVERY, EVIDENCE, RISKS, structural_kind,
    inspect_case, prepare_local_review, main,
)

ROOT = Path(__file__).resolve().parents[3]


class B35ReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.private = self.root / RECOVERY / ".recovery-private"
        self.archive = self.private / "baseline"
        self.archive.mkdir(parents=True)
        for rel in (REGISTER, EVIDENCE, RISKS):
            dst = self.root / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / rel, dst)
        self.register = json.loads((self.root / REGISTER).read_text(encoding="utf-8"))

    def tearDown(self):
        self.tmp.cleanup()

    def test_fourteen_case_classes_come_from_pinned_review_register(self):
        items = self.register["cases"]
        self.assertEqual(len(items), 14)
        self.assertEqual(len({x["version"] for x in items}), 14)
        self.assertTrue(all(x["review_class"] in CHECKS for x in items))
        self.assertTrue(all(x["replay_approved"] is False for x in items))
        self.assertEqual(sum(x["review_class"] == "record_specific_player_reconciliation"
                             for x in items), 2)

    def test_masked_statement_structural_categories(self):
        examples = {
            "INSERT INTO public.players (id) VALUES (NULL)": "DIRECT_MUTATION",
            "DELETE FROM public.players WHERE id IS NULL": "DIRECT_MUTATION",
            "DO $$ BEGIN END $$": "OPAQUE_DO",
            "WITH q AS (SELECT 1) SELECT 1": "CTE_REVIEW",
            "CREATE FUNCTION private.foo() RETURNS boolean": "OPAQUE_ROUTINE",
            "CREATE OR REPLACE FUNCTION private.foo() RETURNS boolean": "OPAQUE_ROUTINE",
            "CREATE TRIGGER demo BEFORE UPDATE ON public.players": "TRIGGER",
            "CREATE POLICY mine ON public.players": "RLS",
            "ALTER TABLE public.players ENABLE ROW LEVEL SECURITY": "RLS",
            "GRANT SELECT ON public.players TO authenticated": "PRIVILEGE",
            "ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO authenticated": "PRIVILEGE",
            "SELECT risky_func()": "EXECUTION_POSSIBLE",
            "CREATE TABLE public.players (id uuid)": "DDL_REVIEW",
            "VACUUM": "OTHER_UNREVIEWED",
        }
        for sql, expected in examples.items():
            with self.subTest(expected=expected, sql_type=sql.split()[0]):
                self.assertEqual(structural_kind(sql), expected)

    def test_private_review_masks_literal_values_and_does_not_approve_sql(self):
        case = next(x for x in self.register["cases"]
                    if x["version"] == "20260920041516")
        original = (
            "UPDATE public.player_batches SET id=NULL WHERE player_id="
            "'a1111111-2222-3333-4444-555555555555';"
            "DELETE FROM public.player_batches WHERE player_id="
            "'a1111111-2222-3333-4444-555555555555';"
        )
        review = inspect_case(case, [original], {1: "0" * 64})
        text = json.dumps(review)
        self.assertEqual(review["masked_top_level_segment_count"], 2)
        self.assertEqual(review["structural_category_counts"], {"DIRECT_MUTATION": 2})
        self.assertNotIn("a1111111", text)
        self.assertNotIn("public.player_batches", text)
        self.assertTrue(review["manual_review_checks"])
        self.assertFalse(review["replay_approved"])
        self.assertFalse(review["schema_data_split_approved"])
        self.assertTrue(all(not x["ddl_approved"] and not x["dml_approved"]
                            for x in review["segments"]))

    def test_semicolons_in_literals_and_function_bodies_not_counted_as_top_level(self):
        case = next(x for x in self.register["cases"]
                    if x["version"] == "20260912180959")
        sql = (
            "CREATE FUNCTION private.f() RETURNS boolean LANGUAGE plpgsql "
            "AS $function$ BEGIN RETURN true; END; $function$;"
            "CREATE POLICY mypol ON public.parents USING (auth.uid() IS NOT NULL);"
        )
        review = inspect_case(case, [sql], {1: "a" * 64})
        self.assertEqual(review["masked_top_level_segment_count"], 2)
        self.assertEqual(review["structural_category_counts"]["OPAQUE_ROUTINE"], 1)
        self.assertEqual(review["structural_category_counts"]["RLS"], 1)

    def test_do_block_and_dml_are_separate_and_opaque(self):
        case = next(x for x in self.register["cases"]
                    if x["version"] == "20260926081053")
        sql = ("DO $$ BEGIN UPDATE public.payment_dues SET status='paid'; END $$;"
               "INSERT INTO public.payment_dues (id) VALUES (NULL);")
        review = inspect_case(case, [sql], {1: "b" * 64})
        self.assertEqual(review["structural_category_counts"]["OPAQUE_DO"], 1)
        self.assertEqual(review["structural_category_counts"]["DIRECT_MUTATION"], 1)
        self.assertIn("INSPECT_OPAQUE_DO_BODY_MANUALLY", review["manual_review_checks"])

    def test_approval_tampering_is_rejected(self):
        case = next(x for x in self.register["cases"]
                    if x["version"] == "20260920041606").copy()
        case["replay_approved"] = True
        with self.assertRaisesRegex(ValueError, "prematurely approved"):
            inspect_case(case, ["DELETE FROM public.player_batches"], {1: "0" * 64})

    def test_missing_source_fingerprint_and_bad_lexing_refused(self):
        case = self.register["cases"][0]
        with self.assertRaisesRegex(ValueError, "SHA-256 missing"):
            inspect_case(case, ["SELECT 1;"], {})
        with self.assertRaisesRegex(ValueError, "Unterminated"):
            inspect_case(case, ["SELECT 'unterminated"], {1: "0" * 64})

    def test_archive_outside_private_folder_refused(self):
        with self.assertRaisesRegex(ValueError, ".recovery-private"):
            prepare_local_review(self.root, self.root)

    def test_invalid_source_attestation_refused(self):
        with patch("b3_5_quarantine_source_review.analyze", return_value={
            "private_archive_source_matched_to_live_fingerprints": True,
            "all_168_element_hashes_verified_from_private_archive": False,
        }):
            with self.assertRaisesRegex(ValueError, "full attestation"):
                prepare_local_review(self.root, self.archive)

    def test_synthetic_fourteen_case_assembly_only_after_mocked_source_verification(self):
        # This deliberately uses invented statements and mocks the prior source
        # verifier; it does NOT prove any real local private archive was inspected.
        cases = self.register["cases"]
        sources = []
        for case in cases:
            path = self.archive / f"{case['version']}.json"
            path.write_text(json.dumps(["CREATE TABLE public.synthetic (id uuid);"]),
                            encoding="utf-8")
            sources.append({
                "version": case["version"],
                "name": case["name"],
                "relative_path": path.name,
            })
        with (
            patch("b3_5_quarantine_source_review.analyze", return_value={
                "private_archive_source_matched_to_live_fingerprints": True,
                "all_168_element_hashes_verified_from_private_archive": True,
            }),
            patch("b3_5_quarantine_source_review.verify", return_value={"items": sources}),
        ):
            report = prepare_local_review(self.root, self.archive)
        self.assertEqual(len(report["cases"]), 14)
        self.assertFalse(report["manual_source_review_complete"])
        self.assertFalse(report["ready_for_disposable_replay"])
        self.assertFalse(report["contains_original_sql_or_literal_values"])
        self.assertNotIn("CREATE TABLE public.synthetic", json.dumps(report))
        self.assertTrue(all(x["manual_review_status"] == "PENDING"
                            for x in report["cases"]))

    def test_cli_rejects_output_outside_ignored_private_without_writes(self):
        output = self.root / "danger.json"
        err = io.StringIO()
        with (
            patch.object(sys, "argv", [
                "b3_5_quarantine_source_review.py",
                "--root", str(self.root),
                "--archive", str(self.archive),
                "--output", str(output),
            ]),
            contextlib.redirect_stderr(err),
        ):
            self.assertEqual(main(), 1)
        self.assertFalse(output.exists())
        self.assertNotIn("CREATE", err.getvalue())


if __name__ == "__main__":
    unittest.main()
