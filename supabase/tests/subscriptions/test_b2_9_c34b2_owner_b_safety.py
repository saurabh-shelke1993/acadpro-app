"""Static C3.4B2 local-only Owner B fixture checks. No actual Auth calls."""
import re
import unittest
from pathlib import Path
DIR=Path(__file__).resolve().parents[0]
class OwnerBGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.sql=(DIR/"ps_l2_3_b2_9_c34b2_owner_b_mapping.sql").read_text()
  cls.ps=(DIR/"b2_9_c34b2_owner_b_local.ps1").read_text()
 def test_exact_target_and_one_signup(self):
  for s in ("kheltriva-b29-disposable","supabase_db_kheltriva-b29-disposable","http://127.0.0.1:54321","2|1|0|0|0|2|11","3|2|0|0|0|2|11"):
   self.assertIn(s,self.ps)
  self.assertEqual(self.ps.count("/auth/v1/signup"),1)
  self.assertEqual(self.ps.count("/auth/v1/user"),1)
  self.assertNotIn("supabase.co",self.ps)
 def test_prior_owners_preserved_and_new_owner_scoped(self):
  for s in ("b29-c34a-%@example.test","b29-c34b1-ao-a-%@example.test","b29-c34b2-ao-b-%@example.test","'a0000000-0000-4000-8000-000000000001'::uuid","'a0000000-0000-4000-8000-000000000002'::uuid","auth.users)<>3","public.users)<>2"):
   self.assertIn(s,self.sql)
  self.assertEqual(len(re.findall(r"\bINSERT\s+INTO\s+public\.",self.sql,re.I)),1)
 def test_no_auth_or_rls_changes(self):
  self.assertIn("c.relrowsecurity",self.sql)
  self.assertIn("n<>5",self.sql)
  self.assertIn("n<>11",self.sql)
  self.assertNotRegex(self.sql,re.compile(r"(?im)^\s*(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?auth\."))
  self.assertNotRegex(self.sql,re.compile(r"(?im)^\s*(?:CREATE|ALTER|DROP)\s+(?:ROLE|POLICY|FUNCTION)\b"))
 def test_single_transaction_and_no_secrets(self):
  for s in ("--single-transaction","ON_ERROR_STOP=1","PUBLISHABLE_KEY","$ownerACountQuery","[guid]::Parse","$mappingReadSql"):
   self.assertIn(s,self.ps)
  for banned in ("sb_secret_","supabase link","supabase db push"):
   self.assertNotIn(banned,self.ps)
 def test_success_marker_agrees_with_sql(self):
  sql_marker="B2.9-C3.4B2 OWNER B MAPPING VERIFIED"
  self.assertIn("SELECT '"+sql_marker+"'",self.sql)
  self.assertIn("$mappingResult -notmatch 'B2\\.9-C3\\.4B2 OWNER B MAPPING VERIFIED'",self.ps)
  self.assertNotIn("$mappingResult -notmatch 'B2\\.9-C3\\.4B1 OWNER A MAPPING VERIFIED'",self.ps)
 def test_fail_stop(self):
  self.assertIn("STOP, never retry automatically",self.ps)
  self.assertIn("C3.4B2",self.sql)
if __name__=="__main__":
 unittest.main()
