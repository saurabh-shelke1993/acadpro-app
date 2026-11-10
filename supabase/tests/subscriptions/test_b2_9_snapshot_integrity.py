"""B2.9 source-provenance assertions. No database connection or hosted SQL writes."""
import hashlib
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parent
SQL = ROOT / "ps_l2_3_b2_9_live_helper_snapshot.sql"
MANIFEST = ROOT / "ps_l2_3_b2_9_live_helper_snapshot_manifest.json"

class B29SourceIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        cls.source = SQL.read_bytes().decode("utf-8")

    def test_exactly_eleven_current_state_helpers(self):
        names = [x["helper"] for x in self.manifest["functions"]]
        self.assertEqual(len(names), 11)
        self.assertEqual(len(set(names)), 11)
        actual = re.findall(r"CREATE OR REPLACE FUNCTION private\.([a-z_]+)\(", self.source)
        self.assertCountEqual(actual, names)

    def test_no_historical_or_production_approval(self):
        self.assertEqual(self.manifest["source_type"], "live-current-state-not-historical")
        self.assertFalse(self.manifest["authoritative_historical_provenance"])
        self.assertFalse(self.manifest["production_replay_approved"])
        self.assertFalse(self.manifest["actual_supabase_replay_tested"])
        self.assertIn("NEVER apply to hosted Supabase", self.source)
        self.assertNotIn("SET check_function_bodies = off", self.source)
        self.assertNotIn("supabase_migrations.schema_migrations", self.source)

    def test_stable_security_definer_and_search_paths(self):
        self.assertEqual(sum(bool(x["security_definer"]) for x in self.manifest["functions"]), 11)
        self.assertTrue(all(x["owner"] == "postgres" and x["volatility"] == "stable"
                            and x["authenticated_execute"] for x in self.manifest["functions"]))
        self.assertTrue(all(x["search_path"] for x in self.manifest["functions"]))
        self.assertEqual(sum(x["anon_execute"] for x in self.manifest["functions"]), 7)
        self.assertEqual(sum(x["service_role_execute"] for x in self.manifest["functions"]), 7)
        self.assertFalse(self.manifest["schema_permissions"]["anon_usage"])
        self.assertFalse(self.manifest["schema_permissions"]["service_role_usage"])

    def test_sha256_of_each_exact_live_definition(self):
        """Remove our one added trailing SQL semicolon and reinstate pg_get_functiondef LF."""
        for x in self.manifest["functions"]:
            marker = "-- LIVE SNAPSHOT " + x["helper"] + "(" + x["args"] + "): sha256 " + x["sha256_pg_get_functiondef"]
            self.assertIn(marker, self.source)
            after = self.source.split(marker, 1)[1].lstrip("\r\n")
            # Each helper uses the PostgreSQL introspected $function$ delimiter.
            ending = "$function$;"
            end = after.find(ending)
            self.assertGreater(end, 0)
            definition = after[:end] + "$function$\n"
            actual = hashlib.sha256(definition.encode("utf-8")).hexdigest()
            self.assertEqual(actual, x["sha256_pg_get_functiondef"], x["helper"])

    def test_no_unreviewed_auth_fixture_shortcuts(self):
        self.assertNotIn("app.fixture_role", self.source)
        self.assertNotIn("CREATE ROLE", self.source)
        self.assertNotIn("INSERT INTO public.", self.source)
        self.assertNotIn("ALTER TABLE public.", self.source)
        self.assertNotIn("GRANT ALL", self.source)

if __name__ == "__main__":
    unittest.main()
