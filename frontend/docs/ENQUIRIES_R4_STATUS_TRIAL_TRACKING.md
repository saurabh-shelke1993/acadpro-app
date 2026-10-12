# AcadPro Enquiries — R4 Status and Trial Tracking

**Date:** 13 October 2026  
**Branch:** `payment-module-finalization`  
**Scope:** Status and optional trial-date editing only. Player conversion remains R5.

## Implemented

- Added an inline status editor to each non-converted enquiry row for Academy Owner and Coach.
- Status updates call the existing `public.update_inquiry` RPC, passing the current enquiry details and the chosen status/trial date. No direct table mutation and no migration were added.
- `trial_scheduled` requires a trial date in the client validation; the existing RPC and database check remain authoritative.
- `converted` is not offered in the ordinary status editor; converted rows have no update action.
- Academy Owner can reopen a Lost enquiry. Coach cannot reopen Lost. Super Admin remains read-only.
- Added unit tests for status validation, required trial date and excluding Converted from ordinary edits.
- Updated project status and backlog.

## Security / data invariants

- Existing R2 RPC remains the authorization boundary for updates; UI restrictions are not relied upon for security.
- Coach updates must pass R2 academy and authorized-center checks.
- No delete workflow exists. A lead that will not proceed should be marked Lost, consistent with the frozen V1 specification.
- No new table, migration, player record, payment record or trial-attendance row was introduced by R4.

## Validation status

The code and tests are committed, but Jest, production build, CI and browser acceptance have not been run/confirmed for the final R4 head. Do not mark R4 verified until they pass.

## Browser acceptance checklist

1. As Academy Owner, open an existing non-converted enquiry and change New → Contacted; confirm the saved status remains after refresh.
2. Change status to Trial Scheduled without a date; save must be blocked with a clear message.
3. Add a trial date, save Trial Scheduled, refresh, and confirm status/date persist.
4. Change to Trial Completed or Follow-up Required and confirm an empty trial date is allowed.
5. Mark a controlled fixture Lost as Academy Owner; verify the owner can reopen it to an active status.
6. As Coach, verify a Lost enquiry cannot be reopened; other authorized-center enquiries can be updated.
7. As Super Admin, verify no update action is displayed.
8. Verify Converted enquiry is immutable and no ordinary status editor is offered.
9. Verify a Coach cannot update an enquiry outside their authorized center and an Owner cannot update another academy's enquiry. Prefer an isolated database branch or controlled fixtures; do not attempt unauthorized writes against real records.
10. Confirm no hard-delete option and no Player/payment/batch side effects from status changes.

## Existing enquiry data

A user-created enquiry is visible in the user's supplied browser screenshot. It is treated as an intentional business record and is **not deleted**. The frozen V1 policy explicitly says not to delete enquiries to represent a failed lead; use Lost instead.
