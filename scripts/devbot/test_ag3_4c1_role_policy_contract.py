#!/usr/bin/env python3
"""AG3.4C1: offline structural checks for pinned *read-only* deployed RLS catalog.

No hosted network, credentials, SQL execution, JWTs, or production mutations.
These checks are not a substitute for native real-JWT behavioral regressions.
"""
from __future__ import annotations
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "supabase/tests/security/ag34c1_live_role_policy_fingerprints.json"
EXPECTED_TABLES = {
    "batches": 5, "centers": 4, "coach_batch_assignments": 4,
    "parents": 5, "players": 5, "player_batches": 5,
}
EXPECTED_HELPERS = {
    "private.can_access_batch(uuid)",
    "private.can_manage_academy(uuid)",
    "private.current_academy_id()",
    "private.current_parent_id()",
    "private.current_user_role()",
    "private.is_coach_assigned_to_batch(uuid)",
    "private.is_super_admin()",
}
HEX = re.compile(r"^[0-9a-f]{32}$")


class PinnedRolePolicyContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = MANIFEST.read_text(encoding="utf-8")
        cls.manifest = json.loads(cls.raw)

    def test_exact_table_and_policy_counts(self):
        rows = self.manifest["policies"]
        counts = {table: sum(p["tablename"] == table for p in rows)
                  for table in EXPECTED_TABLES}
        self.assertEqual(counts, EXPECTED_TABLES)
        self.assertEqual(len(rows), sum(EXPECTED_TABLES.values()))

    def test_policy_identity_uniqueness_and_digest_format(self):
        keys = set()
        for row in self.manifest["policies"]:
            key = (row["tablename"], row["policyname"])
            self.assertNotIn(key, keys)
            keys.add(key)
            self.assertIn(row["cmd"], ("SELECT", "INSERT", "UPDATE", "DELETE", "ALL"))
            self.assertEqual(row["roles"], "{authenticated}")
            self.assertRegex(row["predicate_md5"], HEX)

    def test_required_parent_and_coach_scopes_are_pinned(self):
        names = {(r["tablename"], r["policyname"]) for r in self.manifest["policies"]}
        for key in (
            ("parents", "parents_parent_select"),
            ("players", "players_parent_select"),
            ("player_batches", "player_batches_parent_select"),
            ("batches", "batches_parent_select"),
            ("batches", "batches_select"),
            ("coach_batch_assignments", "coach_batch_assignments_select"),
            ("centers", "centers_select"),
        ):
            self.assertIn(key, names)

    def test_selected_helper_signatures_and_security_definer(self):
        helpers = self.manifest["helpers"]
        self.assertEqual({x["signature"] for x in helpers}, EXPECTED_HELPERS)
        self.assertEqual(len(helpers), len(EXPECTED_HELPERS))
        for helper in helpers:
            self.assertTrue(helper["security_definer"])
            self.assertRegex(helper["source_md5"], HEX)
            self.assertTrue(helper["config"].startswith("search_path="))

    def test_manifest_is_explicitly_not_a_security_pass(self):
        self.assertIn("not equivalent", self.manifest["scope"])
        self.assertIn("never auto-update", " ".join(self.manifest["notes"]))
        self.assertIn("Production migration and release remain blocked",
                      " ".join(self.manifest["notes"]))


if __name__ == "__main__":
    unittest.main()
