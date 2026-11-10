"""B3.3 original per-element source fingerprint preflight, no database access."""
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from b3_3_original_source_audit import (
    analyze, tokens_and_statements, EVIDENCE, BASE_REVIEW,
)
from b3_2_reconciliation_design import DIVERGENCES, REVIEW
from b3_1_assembly_manifest import PARITY, RISKS, HELPERS
from b3_0_replay_readiness import REQUIRED

ROOT = Path(__file__).resolve().parents[3]


class B33OriginalSourceAuditTests(unittest.TestCase):
    def test_real_source_metadata_is_complete_but_not_replay_ready(self):
        record = analyze(ROOT)
        self.assertEqual(record["remote_migration_count"], 82)
        self.assertEqual(record["original_ledger_element_count"], 168)
        self.assertEqual(record["source_bytes_held_by_remote_ledger"], 361302)
        self.assertTrue(record["historical_schema_87_statements_lexically_aligned"])
        self.assertFalse(record["private_archive_present"])
        self.assertFalse(record["private_archive_integrity_checked"])
        self.assertFalse(record["all_168_element_hashes_verified_from_private_archive"])
        self.assertFalse(record["ready_for_full_supabase_replay"])
        self.assertFalse(record["ready_for_production"])
        self.assertFalse(record["original_sql_body_embedded"])

    def test_semicolon_free_elements_match_terminated_git_statements(self):
        source = [
            "CREATE TABLE public.players (id uuid)",
            "ALTER TABLE public.players ADD COLUMN label text",
            "GRANT SELECT ON public.players TO authenticated",
        ]
        original = [token for s in source for token in tokens_and_statements(s)]
        git = tokens_and_statements("; \n".join(source) + ";")
        self.assertEqual(len(original), 3)
        self.assertEqual(original, git)

    def test_quoted_literal_semicolon_and_comments_are_not_new_statements(self):
        sample = (
            "-- comment; DELETE FROM players;\n"
            "CREATE TABLE public.example (code text DEFAULT 'semi;colon');"
            "/* ; /* nested ; */ more ; */"
            "UPDATE public.example SET code='semi;colon' WHERE code IS NULL;"
        )
        result = tokens_and_statements(sample)
        self.assertEqual(len(result), 2)

    def test_function_body_semicolon_does_not_split_migration(self):
        source = (
            "CREATE FUNCTION public.test() RETURNS int LANGUAGE plpgsql "
            "AS $function$ BEGIN RETURN 1; END; $function$;"
        )
        self.assertEqual(len(tokens_and_statements(source)), 1)
        different = source.replace("RETURN 1", "RETURN 2")
        self.assertNotEqual(tokens_and_statements(source), tokens_and_statements(different))

    def test_changed_record_specific_literal_not_normalized(self):
        a = "DELETE FROM public.player_batches WHERE player_id='11111111-1111-1111-1111-111111111111';"
        b = "DELETE FROM public.player_batches WHERE player_id='22222222-2222-2222-2222-222222222222';"
        self.assertNotEqual(tokens_and_statements(a), tokens_and_statements(b))

    def test_unclosed_sql_is_refused(self):
        for example in ("/* never closed", "SELECT 'unclosed", "SELECT $tag$body"):
            with self.subTest(example=example[:7]):
                with self.assertRaisesRegex(ValueError, "Unclosed"):
                    tokens_and_statements(example)

    def test_missing_original_statement_is_refused(self):
        with self.clone_sources() as root:
            path = root / EVIDENCE
            data = json.loads(path.read_text(encoding="utf-8"))
            data["items"].pop()
            path.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Incomplete original statement inventory"):
                analyze(root)

    def test_out_of_order_source_element_is_refused(self):
        with self.clone_sources() as root:
            path = root / EVIDENCE
            data = json.loads(path.read_text(encoding="utf-8"))
            data["items"][0]["ordinal"] = 2
            path.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "original statement ordinality|Original statement"):
                analyze(root)

    def test_marked_as_replay_ready_is_refused(self):
        with self.clone_sources() as root:
            path = root / EVIDENCE
            data = json.loads(path.read_text(encoding="utf-8"))
            data["ready_for_sql_assembly"] = True
            path.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Premature replay permission"):
                analyze(root)

    def test_base_statement_lexical_match_not_semantic_approval(self):
        with self.clone_sources() as root:
            path = root / BASE_REVIEW
            data = json.loads(path.read_text(encoding="utf-8"))
            data["semantic_equivalence_proven"] = True
            path.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Initial schema must remain pending"):
                analyze(root)

    def clone_sources(self):
        class Clone:
            def __init__(self):
                self.tmp = tempfile.TemporaryDirectory()
            def __enter__(self):
                root = Path(self.tmp.name)
                paths = {Path(s) for s in REQUIRED.values()}
                paths.update((PARITY, REVIEW, RISKS, HELPERS, DIVERGENCES,
                              EVIDENCE, BASE_REVIEW))
                for rel in paths:
                    dest = root / rel
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(ROOT / rel, dest)
                migr = root / "supabase/migrations"
                migr.mkdir(parents=True, exist_ok=True)
                for file in (ROOT / "supabase/migrations").glob("*.sql"):
                    shutil.copy2(file, migr / file.name)
                return root
            def __exit__(self, *_):
                self.tmp.cleanup()
        return Clone()


if __name__ == "__main__":
    unittest.main()
