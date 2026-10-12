# AcadPro Enquiries — R3 Frontend Implementation Record

**Date:** 13 October 2026  
**Branch:** `payment-module-finalization`  
**Scope:** Enquiry service, role-aware list, quick capture, search/filters, scoped center selection and duplicate warning.

## Implemented

- Added `src/services/enquiriesService.js`:
  - Explicit-column read of `public.inquiries`, relying on the R2 RLS policy for row scope.
  - Quick create through `public.create_inquiry`; no direct table INSERT.
  - Phone normalization and client-side quick-capture validation.
  - Possible duplicate lookup by normalized parent phone, then player name or DOB match within the academy-visible result set.
- Added `src/pages/Enquiries.js` and `Enquiries.css`:
  - Protected page for Super Admin, Academy Owner and Coach.
  - Super Admin read-only list with academy filter.
  - Academy Owner list and quick capture, with optional center assignment.
  - Coach list across RLS-authorized center(s), with center required on create.
  - Search by player name/parent contact; status, source and center filters.
  - Loading, error/retry, empty state, success feedback, responsive table/form.
  - Duplicate warning allows an authorized user to proceed after review; no automatic merge/rejection.
- Registered `/enquiries` in protected routes and added sidebar navigation for Super Admin/Academy Owner and Coach. Parent navigation and routes remain excluded.
- Added validation unit tests in `src/services/enquiriesService.test.js`.

## Scope intentionally deferred

- R4: status mutation and trial-date editing. R3 displays and filters status/trial date only.
- R5: Academy Owner-only conversion into Player.
- No schema or migration changes; R2 remains the database/security foundation.
- No use of `trial_attendance`, no hard delete, no payment/player writes from enquiry capture.

## Security notes

- The UI uses R2 RPC `create_inquiry` for inserts and relies on RLS for reads. Client filters are not the authorization boundary.
- Coach duplicate lookup can only return records visible under the coach's authorized-center RLS policy. It cannot reveal enquiries assigned to another center; server-side scope remains authoritative.
- The duplicate warning is advisory and intentionally does not block legitimate sibling enquiries.
- Do not create fake/test enquiries in the active Supabase project: hard delete is intentionally not available. Use an isolated development branch or explicitly controlled fixtures for write-path acceptance.

## Validation status

- Unit tests added; execution pending.
- Production build / GitHub Actions status must be checked against the final R3 head; not assumed passed.
- Browser acceptance pending.
- Vercel preview was previously rate-limited on the current plan; do not claim preview deployment unless a current deployment is observed.

## Browser acceptance checklist

1. Super Admin can open Enquiries, view across academies and filter by academy/center/status/source; Add Enquiry is not shown.
2. Academy Owner can open Enquiries and sees only the owner's academy. Add Enquiry is available. Center can be left unassigned.
3. Coach sees only enquiries returned by RLS for authorized centers; Add Enquiry requires an authorized center. If one center is assigned, the center is preselected/fixed; if several, choose among those centers.
4. Parent cannot open `/enquiries` and has no Enquiries sidebar item.
5. Search by player name/contact and filters work together; Clear filters resets them without changing tenant scope.
6. Quick-capture validation rejects blank name, invalid phone, missing DOB and future DOB. Source and note remain optional.
7. Possible duplicate warning shows existing same-phone enquiries with matching player name or DOB; user can return to the form or explicitly continue.
8. Empty/loading/error states render accessibly; retry reloads the list.
9. Verify create only with a controlled fixture or a real intended enquiry. Confirm new records do not appear in Players, attendance, batches, subscriptions, dues, payments or Parent Portal before conversion.

Record the actual role, scenario and result for each browser test. Keep write-path and cross-tenant negative tests pending until controlled fixtures or an isolated database branch are available.
