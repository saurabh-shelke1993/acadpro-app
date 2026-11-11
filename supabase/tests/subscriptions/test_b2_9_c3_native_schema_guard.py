"""Fail-closed static checks for a native-Supabase-only synthetic fixture.

These tests do not execute SQL or assert real Supabase integration has passed.
"""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/"supabase/tests/subscriptions/ps_l2_3_b2_9_c3_native_schema.sql"

class NativeSupabaseSchemaGuard(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql=SOURCE.read_text(encoding="utf-8")
        cls.uncommented=re.sub(r"(?m)^[ \t]*--.*$", "", cls.sql)

    def test_requires_native_auth_not_fake_auth_uid(self):
        for required in ("to_regclass('auth.users')",
                         "to_regprocedure('auth.uid()')",
                         "to_regrole('authenticated')",
                         "EXISTS (SELECT 1 FROM auth.users)"):
            self.assertIn(required, self.uncommented)
        self.assertNotRegex(self.uncommented, r"(?i)\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+auth\.")
        self.assertNotRegex(self.uncommented, r"(?i)\bCREATE\s+ROLE\b")
        self.assertNotRegex(self.uncommented, r"(?i)\b(?:INSERT|UPDATE|DELETE|ALTER)\s+(?:INTO\s+|FROM\s+|TABLE\s+)?auth\.")

    def test_five_only_new_tables_with_rls(self):
        tables=("users","batches","coaches","coach_batches","coach_batch_assignments")
        actual=re.findall(r"(?i)\bCREATE\s+TABLE\s+public\.([a-z_]+)",self.uncommented)
        self.assertCountEqual(actual,tables)
        for table in tables:
            self.assertIn(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY",self.uncommented)
        self.assertNotRegex(self.uncommented,r"(?i)\bCREATE\s+POLICY\b")

    def test_exposed_client_access_is_denied(self):
        self.assertIn("FROM PUBLIC, anon, authenticated, service_role;",self.uncommented)
        self.assertNotRegex(self.uncommented,r"(?i)\bGRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)\b")

    def test_required_abort_guards_and_transaction(self):
        self.assertRegex(self.uncommented,r"(?m)^\s*BEGIN;\s*$")
        self.assertRegex(self.uncommented,r"(?m)^\s*COMMIT;\s*$")
        for expected in ("session_user <> 'postgres'","to_regclass('public.players')",
                         "to_regclass('public.payment_dues')",
                         "to_regnamespace('private')","RAISE EXCEPTION",
                         "secured_count <> 5"):
            self.assertIn(expected,self.uncommented)

    def test_no_destructive_or_hosted_actions(self):
        self.assertNotRegex(self.uncommented,r"(?i)\b(?:DROP|TRUNCATE|ALTER\s+ROLE|CREATE\s+EXTENSION|CREATE\s+SCHEMA)\b")
        self.assertNotIn("supabase_migrations.schema_migrations",self.uncommented)
        self.assertNotIn("billing_policy",self.uncommented)
        self.assertNotIn("CREATE TABLE public.players",self.uncommented)

    def test_data_is_only_two_synthetic_batches(self):
        self.assertEqual(len(re.findall(r"(?i)\bINSERT\s+INTO\s+public\.",self.uncommented)),1)
        self.assertIn("a0000000-0000-4000-8000-000000000001",self.uncommented)
        self.assertIn("a0000000-0000-4000-8000-000000000002",self.uncommented)

if __name__=="__main__":
    unittest.main()
