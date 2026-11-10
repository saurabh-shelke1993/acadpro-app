import json
from pathlib import Path
import tempfile
import unittest

from export_migrations import export
from inspect_historical_statements import split_masked_statements, scan_records, inspect_archive


def record(sql):
    return [{"version": "20260912142706", "name": "test", "statements": [sql]}]


class HistoricalStatementReviewTests(unittest.TestCase):
    def test_function_body_update_not_direct_top_level_mutation(self):
        sql = "CREATE FUNCTION private.test() RETURNS void AS $$ BEGIN UPDATE public.players SET active=false; END $$ LANGUAGE plpgsql;"
        report = scan_records(record(sql))
        self.assertEqual(report["summary"]["direct_data_statement_count"], 0)
        self.assertEqual(report["summary"]["top_level_segments"], 1)

    def test_procedural_do_block_requires_review(self):
        sql = "DO $run$ BEGIN DELETE FROM public.parents WHERE id IS NULL; END $run$;"
        report = scan_records(record(sql))
        self.assertEqual(report["summary"]["migrations_with_procedural_do"], 1)
        self.assertEqual(report["summary"]["direct_data_statement_count"], 0)
        self.assertFalse(report["ready_for_disposable_replay"])

    def test_comments_quoted_semicolons_and_nested_block_comments(self):
        sql = (
            "/* comment ; /* nested DELETE FROM public.players; */ trailing */\n"
            "-- DELETE FROM public.parents; comment\n"
            "UPDATE public.parents SET label = 'a; DROP TABLE payments;' WHERE id IS NULL;"
        )
        report = scan_records(record(sql))
        self.assertEqual(report["summary"]["top_level_segments"], 1)
        self.assertEqual(report["summary"]["direct_data_statement_count"], 1)
        self.assertEqual(report["records"][0]["direct_data_statements"][0]["target"], "public.parents")

    def test_direct_mutations_classified_without_quoted_personal_data(self):
        sql = (
            "INSERT INTO storage.buckets(id) VALUES ('photo-bucket');"
            "UPDATE public.parents SET email='private@example.com' WHERE id IS NULL;"
            "DELETE FROM public.player_batches WHERE player_id IS NULL;"
        )
        report = scan_records(record(sql))
        mutations = report["records"][0]["direct_data_statements"]
        self.assertEqual(len(mutations), 3)
        self.assertEqual([m["target"] for m in mutations],
                         ["storage.buckets", "public.parents", "public.player_batches"])
        self.assertNotIn("private@example.com", json.dumps(report))
        self.assertNotIn("photo-bucket", json.dumps(report))

    def test_unterminated_string_marks_uncertainty(self):
        parts, uncertain = split_masked_statements("SELECT 'not closed")
        self.assertTrue(uncertain)
        self.assertEqual(len(parts), 1)

    def test_verified_quarantined_archive_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            migrations = base / "migrations"
            migrations.mkdir()
            archive = base / "archive"
            export(record("UPDATE public.parents SET user_id = NULL WHERE user_id IS NOT NULL;"),
                   migrations, archive)
            report = inspect_archive(archive)
            self.assertEqual(report["summary"]["direct_data_statement_count"], 1)
            sqlfile = next((archive / "quarantine_sql").glob("*.json"))
            sqlfile.write_text('["SELECT 2;"]')
            with self.assertRaisesRegex(ValueError, "Hash mismatch"):
                inspect_archive(archive)

    def test_no_replay_approval_after_clean_scan(self):
        report = scan_records(record("CREATE SCHEMA private;"))
        self.assertEqual(report["summary"]["direct_data_statement_count"], 0)
        self.assertFalse(report["ready_for_production"])
        self.assertFalse(report["records"][0]["replay_approved"])


if __name__ == "__main__":
    unittest.main()
