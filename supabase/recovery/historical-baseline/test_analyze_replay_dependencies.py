import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from analyze_replay_dependencies import analyze


def prepare(root, rows):
    root = Path(root)
    (root / "sql").mkdir()
    items = []
    for version, name, statements in rows:
        raw = json.dumps(statements, ensure_ascii=False, separators=(",", ":")).encode()
        relative = "sql/" + version + "_" + name + ".json"
        (root / relative).write_bytes(raw)
        items.append({"version": version, "name": name, "relative_path": relative,
                      "sha256": hashlib.sha256(raw).hexdigest(),
                      "statement_count": len(statements)})
    (root / "manifest.json").write_text(json.dumps({"items": items}))
    return items


class DependencyAuditTests(unittest.TestCase):
    def test_missing_auth_function_and_schema_are_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            prepare(tmp, [("20260901000000", "first", ["create policy p on public.players using (private.is_super_admin());"])])
            report = analyze(Path(tmp))
            self.assertEqual(report["migrations_with_unresolved_private_references"], 1)
            self.assertFalse(report["private_schema_creation_seen"])
            self.assertIn("is_super_admin", report["findings"][0]["private_references_without_prior_definition"])

    def test_created_helper_and_parent_column(self):
        with tempfile.TemporaryDirectory() as tmp:
            prepare(tmp, [
                ("20260823093317", "baseline", ["create schema private;"]),
                ("20260901000000", "helper", ["create function private.is_super_admin() returns boolean language sql as $$ select true $$;"]),
                ("20260902000000", "parents", ["alter table public.parents add column user_id uuid;",
                                               "create policy p on public.players using (private.is_super_admin());"]),
            ])
            report = analyze(Path(tmp))
            self.assertTrue(report["private_schema_creation_seen"])
            self.assertTrue(report["parents_user_id_addition_seen"])
            self.assertEqual(report["migrations_with_unresolved_private_references"], 0)

    def test_tampered_source_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            items = prepare(tmp, [("20260901000000", "first", ["select 1;"])])
            (Path(tmp) / items[0]["relative_path"]).write_text('["select 2;"]')
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                analyze(Path(tmp))

    def test_historical_dml_flagged(self):
        with tempfile.TemporaryDirectory() as tmp:
            prepare(tmp, [("20260901000000", "data", ["UPDATE public.players SET is_active = false;"])])
            report = analyze(Path(tmp))
            self.assertEqual(report["migrations_with_potential_data_mutations"], 1)
            self.assertFalse(report["findings"][0]["replay_approved"])


if __name__ == "__main__":
    unittest.main()
