"""B3.7A fail-closed validation of sanitized helper provenance; no DB/SQL."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[3]
AUDIT = ROOT / "supabase/recovery/historical-baseline/b3_7a_helper_history_20261111.json"
MANIFEST = ROOT / "supabase/tests/subscriptions/ps_l2_3_b2_9_live_helper_snapshot_manifest.json"

def check(audit, manifest):
    if audit["schema"] != "kheltriva-b3-7a-history-v1" or audit["project_id"] != manifest["project_id"]:
        raise ValueError("Source provenance changed")
    if audit["source_versions"] != 82 or audit["source_elements"] != 168:
        raise ValueError("Source counts changed")
    if audit["current_function_hashes_matching_manifest"] != 11:
        raise ValueError("Current function validation mismatch")
    if audit["original_private_schema_create_detected"] or audit["all_historical_creation_source_recovered"]:
        raise ValueError("Historical provenance falsely approved")
    if audit["private_schema_usage_grant_first_version"] != "20260903173804":
        raise ValueError("Private schema chronology drift")
    if audit["parent_first_function"] != "20260908062059" or not audit["parent_first_function_uses_email_not_user_id"] or audit["parent_user_id_added_and_function_revised"] != "20260912142706":
        raise ValueError("Parent Auth dependency drift")
    rows = audit["helpers"]
    if len(rows) != 11 or len(set(x["name"] for x in rows)) != 11:
        raise ValueError("Required helper coverage missing")
    expected = {x["helper"]:x for x in manifest["functions"]}
    if set(expected) != set(x["name"] for x in rows):
        raise ValueError("Helper source names differ")
    for x in rows:
        p = expected[x["name"]]
        if x["original_create_found"] or x["approved_for_replay"] or not x["live_metadata_matches_manifest"]:
            raise ValueError("Historical helper prematurely approved")
        if (x["owner"] != p["owner"] or x["security_definer"] != p["security_definer"] or
            x["search_path"] != p["search_path"] or x["public_execute"] != p["public_execute"] or
            x["auth_execute"] != p["authenticated_execute"] or x["anon_execute"] != p["anon_execute"]):
            raise ValueError("Current helper grants/settings drift")
    if any(audit["security_gates"].values()) or audit["sensitive_sql_included"] or audit["any_database_changed"]:
        raise ValueError("Unsafe review gates")
    return True

class Tests(unittest.TestCase):
    def setUp(self):
        self.a = json.loads(AUDIT.read_text(encoding="utf-8"))
        self.m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    def test_valid_blocked(self):
        self.assertTrue(check(self.a,self.m))
    def test_missing_function(self):
        self.a["helpers"].pop()
        with self.assertRaises(ValueError): check(self.a,self.m)
    def test_bad_historical_claim(self):
        self.a["helpers"][0]["original_create_found"]=True
        with self.assertRaises(ValueError): check(self.a,self.m)
    def test_bad_grants(self):
        self.a["helpers"][0]["public_execute"]=True
        with self.assertRaises(ValueError): check(self.a,self.m)
    def test_b4_not_ready(self):
        self.a["security_gates"]["b4_ready"]=True
        with self.assertRaises(ValueError): check(self.a,self.m)
    def test_parent_timing(self):
        self.a["parent_first_function"]="20260912142706"
        with self.assertRaises(ValueError): check(self.a,self.m)
    def test_sql_source_not_included(self):
        self.a["sensitive_sql_included"]=True
        with self.assertRaises(ValueError): check(self.a,self.m)

if __name__ == "__main__":
    unittest.main()
