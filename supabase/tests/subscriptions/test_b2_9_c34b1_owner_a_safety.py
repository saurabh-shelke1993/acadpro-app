"""B2.9 C3.4B1 static scope/SQL guards. This suite never calls GoTrue."""
import re
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[3]
DIR=ROOT/'supabase/tests/subscriptions'
class OwnerAOneUserScope(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.sql=(DIR/'ps_l2_3_b2_9_c34b1_owner_a_mapping.sql').read_text()
  cls.ps=(DIR/'b2_9_c34b1_owner_a_local.ps1').read_text()
 def test_scratch_only_and_one_owner(self):
  for term in ('kheltriva-b29-disposable','supabase_db_kheltriva-b29-disposable','http://127.0.0.1:54321'):
   self.assertIn(term,self.ps)
  self.assertIn('1|0|0|0|0|2|11',self.ps)
  self.assertIn('2|1|0|0|0|2|11',self.ps)
  self.assertIn("1|0|0|0|0|2|11",self.ps)
  self.assertEqual(self.ps.count('/auth/v1/signup'),1)
  self.assertEqual(self.ps.count('/auth/v1/user'),1)
  self.assertNotIn('supabase.co',self.ps)
 def test_sql_transaction_guards_and_no_auth_changes(self):
  self.assertIn(":'owner_uuid'::uuid",self.sql)
  self.assertIn("b29-c34a-%@example.test",self.sql)
  self.assertIn("b29-c34b1-ao-a-%@example.test",self.sql)
  self.assertIn("CREATE TEMP TABLE",self.sql)
  self.assertIn("INSERT INTO public.users(id,academy_id,role)",self.sql)
  self.assertIn("WHERE u.role='academy_owner'",self.sql)
  self.assertIn("n<>5",self.sql)
  self.assertIn("n<>11",self.sql)
  self.assertNotRegex(self.sql,re.compile(r"(?im)^\s*(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?auth\."))
  self.assertNotRegex(self.sql,re.compile(r"(?im)^\s*(?:CREATE|ALTER|DROP)\s+(?:ROLE|POLICY|FUNCTION)\b"))
 def test_single_atomic_exec_and_no_credentials_in_logs(self):
  self.assertIn('--single-transaction',self.ps)
  self.assertIn('ON_ERROR_STOP=1',self.ps)
  self.assertIn("status -o env",self.ps)
  self.assertIn("PUBLISHABLE_KEY",self.ps)
  self.assertNotIn('sb_secret_',self.ps)
  self.assertNotIn('supabase db push',self.ps)
  self.assertNotIn('supabase link',self.ps)
  self.assertNotRegex(self.ps,re.compile(r"(?im)^\s*(?:Write-Host|Write-Output)\b"))
 def test_no_client_grants_or_policies(self):
  for text in (self.ps,self.sql):
   self.assertNotIn('GRANT SELECT ON TABLE',text)
   self.assertNotRegex(text,re.compile(r"(?im)^\s*CREATE\s+POLICY\b"))
   self.assertNotIn('ALTER TABLE public.users DISABLE ROW LEVEL SECURITY',text)
 def test_only_one_public_users_insert(self):
  self.assertEqual(len(re.findall(r"\bINSERT\s+INTO\s+public\.",self.sql,re.I)),1)
  self.assertIn("'a0000000-0000-4000-8000-000000000001'::uuid",self.sql)
if __name__=='__main__':
 unittest.main()
