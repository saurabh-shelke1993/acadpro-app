# Kheltriva — B3.7A Historical Helper Chronology

**11 November 2026 · payment-module-finalization · Supabase ulyealhkmlorsbdiknrh**

**Read-only original-source review completed. Full source-based reconstruction and B4 integration remain BLOCKED.**

The live migration ledger contains **82 versions and 168 SQL elements**. An original-text scan found no recorded initial creation of the 11 B2.9 private authorization helpers or CREATE SCHEMA private. The first identifiable GRANT USAGE ON SCHEMA private occurs in `20260903173804`, where private helpers are already referenced. This is a bounded source-text finding, not proof of the original functions' historical contents.

All **11/11** current private function-body SHA-256 hashes, ownership, SECURITY DEFINER status, configured search paths and effective EXECUTE rights match the pinned B2.9 current-state manifest. The current snapshot is not authentic historical creation evidence.

## Helper call chronology

| Current foundational helper | Earliest recorded qualified call | Original CREATE |
|---|---|---|
| `batch_academy_id` | 20260903173804 | Not found |
| `can_access_batch` | Not found | Not found |
| `can_access_center` | Not found | Not found |
| `can_access_coach` | Not found | Not found |
| `can_access_coach_batch` | Not found | Not found |
| `current_academy_id` | 20260903173804 | Not found |
| `current_user_role` | 20260907180752 | Not found |
| `is_super_admin` | 20260903173804 | Not found |
| `is_academy_owner` | 20260903173804 | Not found |
| `is_coach` | 20261012035934 | Not found |
| `is_coach_assigned_to_batch` | 20260907180752 | Not found |

**Parent dependency:** The original `private.current_parent_id()` function at `20260908062059` uses an email-based parent lookup; it does not depend on `parents.user_id`. That column and a revised helper arrive in `20260912142706`. Do not insert the modern helper early, suppress function-body validation, or treat the 11-helper current-state fixture as an original migration.

**Security:** Seven current helpers have PUBLIC EXECUTE, but anonymous users lack USAGE on the private schema. These rights, historical helper bodies, callers and RLS predicates require disposable role-negative tests. Existing PostgreSQL 17 B2.9 synthetic tests do not prove full Supabase Auth/RLS/Storage parity.

**No original SQL bodies, personal identifiers, credentials, schema mutations, migration history repairs or payment operations were introduced.** The [sanitized audit](../../supabase/recovery/historical-baseline/b3_7a_helper_history_20261111.json) leaves all approvals false.

**Next stop:** B3.7B original helper creation/grant dependency disposition. The original provenance gap cannot be assumed resolved. B3 full original-history replay, the 22 legacy agreement approvals, and B4 integration require later explicit security and Owner acceptance.
