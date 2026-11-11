"""Static safety checks for the one-user native local GoTrue smoke test.

The script is not executed by these tests; Owner must report real local result.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / 'supabase/tests/subscriptions/b2_9_c34a_local_gotrue_smoke.ps1'

class C34ALocalAuthSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = SCRIPT.read_text(encoding='utf-8')

    def test_local_only_exact_target(self):
        for term in ('kheltriva-b29-disposable', 'supabase_db_kheltriva-b29-disposable',
                     'http://127.0.0.1:54321', '$apiMatch.Groups[1].Value -ne $localUrl'):
            self.assertIn(term, self.source)
        self.assertNotIn('supabase.co', self.source)

    def test_one_auth_signup_then_get_user(self):
        self.assertEqual(self.source.count('/auth/v1/signup'), 1)
        self.assertEqual(self.source.count('/auth/v1/user'), 1)
        self.assertIn('$signup.access_token', self.source)
        self.assertIn('$authUser.id -ne $signup.user.id', self.source)
        self.assertNotIn('service_role', self.source)

    def test_pre_and_post_conditions_and_email_guard(self):
        for term in ("11|2|0|0|t|f|t", "11|2|0|1|t|f|t",
                     'enable_confirmations', "status -o env",
                     "PUBLISHABLE_KEY", 'local_auth_users = 1'):
            self.assertIn(term, self.source)
        self.assertIn('C3.4A stopped:', self.source)

    def test_no_token_output_or_app_schema_changes(self):
        self.assertNotRegex(self.source, re.compile(r'(?im)^\s*(?:write-host|write-output|echo)\b'))
        self.assertNotRegex(self.source, re.compile(r'(?im)^\s*[^#\n]*(?:drop\s+table|create\s+table|create\s+policy|grant\s+|revoke\s+)'))
        self.assertNotIn('supabase db push',self.source)
        self.assertNotIn('supabase link',self.source)

    def test_random_local_test_identity_and_no_retry(self):
        self.assertIn('[guid]::NewGuid()',self.source)
        self.assertIn('@example.test',self.source)
        self.assertIn('STOP. Do not retry',self.source)

if __name__ == '__main__':
    unittest.main()
