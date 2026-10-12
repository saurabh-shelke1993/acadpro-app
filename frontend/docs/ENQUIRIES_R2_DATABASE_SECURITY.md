# AcadPro Enquiries — R2 Database and Security Record

**Status:** R2 database/security foundation applied; frontend and end-to-end workflow not implemented  
**Date:** 12 October 2026  
**Branch:** `payment-module-finalization`  
**Live migration:** `20261012035934 / enquiries_r2_database_security`

## Scope delivered

R2 evolves the existing `public.inquiries` table and introduces scoped read access plus validated mutation RPCs. It does not implement the Enquiries UI/service and does not change `public.trial_attendance`.

## Live schema changes

- `parent_name` is now nullable; it is collected during player conversion, not quick enquiry capture.
- `academy_id` and `dob` are required.
- Parent contact is normalized to digits by the create/update RPCs and validated as a 10-digit number.
- Legacy `trial_status` was renamed to `status`; the default is `new`.
- Added `trial_date`, `created_by`, `updated_at`, `converted_player_id`, `converted_at`, and `converted_by`.
- Added status/source/trial-date/conversion-link constraints, creator/conversion foreign keys, and indexes for academy/date, center/status, duplicate lookup, and unique converted-player linkage.
- Existing rows were preflighted before enforcing required fields. Both `inquiries` and `trial_attendance` had zero rows at migration time; no enquiry/player/payment/attendance business records were created or changed.
- `trial_attendance` remains unchanged and deny-by-default for V1; V1 stores one optional `trial_date` on the enquiry.

## Access model

### Direct table access
- RLS remains enabled.
- `authenticated` has SELECT only on `public.inquiries`; no direct INSERT, UPDATE or DELETE.
- `anon` has no table privileges.
- The SELECT policy allows:
  - Super Admin: all academies, read-only.
  - Academy Owner: own academy.
  - Coach: only enquiries in the coach's own academy and active authorized centers.
- Unassigned-center enquiries remain visible to their Academy Owner but not coaches.
- Parent and anonymous access is denied.

### Coach scope
The private helper `private.inquiry_can_access_center(uuid)` derives scope from the authenticated coach account through `coaches.user_id`, active `coach_batch_assignments`, active batches, and active centers. It returns only a boolean and uses an empty search path. Read-only smoke testing under the authenticated role confirmed an authorized center returns true and a center belonging to another academy returns false.

### Mutation RPCs
All three public RPCs are SECURITY DEFINER with an empty search path and explicit role/academy/center validation:
- `create_inquiry(text,text,date,text,uuid,text)`: Academy Owner or Coach only; center is derived/validated against role scope; creates status `new`.
- `update_inquiry(uuid,text,text,date,text,uuid,text,text,date)`: Academy Owner or authorized Coach only; validates fields/status, requires a trial date for `trial_scheduled`, disallows ordinary conversion, prevents edits to converted enquiries, and restricts reopening Lost enquiries to the owner.
- `record_inquiry_conversion(uuid,text,text,text,text,date,uuid,uuid)`: Academy Owner only; locks the enquiry row, validates the center and batch, calls the existing `create_player_transactional` workflow, then links the created Player and marks the enquiry converted in the same transaction. Repeated conversion returns the existing linked player instead of creating another.

The RPCs revoke PUBLIC and anon execution and explicitly grant authenticated execution. Supabase's function ACL also reports service_role execution due the project's privileged server role/default grants; service_role is trusted server-side and is not available to browser clients. The functions still validate the authenticated role and academy before doing work.

## Verification performed

- Migration applied successfully to the active Supabase project.
- Live migration list confirms `20261012035934 / enquiries_r2_database_security`.
- Live schema confirms required/optional columns, new foreign keys, checks and indexes.
- Live RLS policy confirms the intended Super Admin / owner / coach read scope.
- Live table privileges confirm anon has no access and authenticated has SELECT but no direct INSERT/UPDATE/DELETE.
- Live function inspection confirms the three RPCs are SECURITY DEFINER, use an empty search path, deny anon execution and grant authenticated execution.
- Read-only role simulation confirmed coach role/academy resolution and active-center scope (authorized center true; foreign-academy center false).
- Security Advisor after R2 reports 13 authenticated SECURITY DEFINER warnings, including these three intentionally authenticated, scope-validating RPCs. The prior 10 warnings remain. The `inquiries` no-policy INFO finding is resolved; two unrelated intentional no-policy INFO findings remain for `trial_attendance` and `payment_number_counters`. Leaked-password protection remains unavailable on the current plan.
- Live counts remain zero for both `inquiries` and `trial_attendance`.

## Not yet verified / release gates

- No live create/update/conversion smoke test was run because it would create real lead/player records in the active database. Use controlled test fixtures or an isolated Supabase development branch for transactional tests.
- No frontend service/page exists yet; RLS behavior through the final app has not been browser-tested.
- Must test create/update authorization, cross-academy and center tampering, trial-date constraint, Lost/Converted transitions, conversion rollback, retry/concurrency, parent reuse, and player-batch invariants in a controlled environment.
- R3 is the next phase: enquiry service, list, quick-create form, search/filter, duplicate warning and role-aware UI. Do not broaden scope into multi-session trials, payment, or unrelated modules.

## Migration-history rule

The repository migration file is `supabase/migrations/20261012035934_enquiries_r2_database_security.sql`, aligned to the live ledger version/name. No historical migration or ledger row was edited, replayed, or removed.
