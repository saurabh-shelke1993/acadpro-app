# AcadPro Enquiries — R5 Atomic Player Conversion

**Date:** 13 October 2026  
**Branch:** `payment-module-finalization`  
**Scope:** Academy Owner-only conversion of an enquiry into an existing AcadPro Player workflow.

## Implemented

- Added `convertEnquiryToPlayer` service using the existing `public.record_inquiry_conversion` RPC.
- Added conversion validation for required parent name, supported gender, joining date, center and batch.
- Added an Academy Owner-only **Convert to Player** action for enquiries that are neither Lost nor Converted.
- Added a conversion dialog that pre-fills the enquiry's player name, phone and DOB as a read-only summary.
- Collects enrollment details not captured during quick enquiry: parent name (required), gender (required), joining date (required), center (required), batch (required), parent email (optional), and parent address (optional).
- If the enquiry already has a center, the conversion center is fixed to that center. If the enquiry has no center, the owner selects one. The batch list is loaded for the selected center.
- Shows saving/error states and refreshes the enquiry list after successful conversion.
- Adds unit tests for conversion form validation.
- No new migration or direct table mutation was added.

## Transaction / security design

The UI calls only `record_inquiry_conversion`; it does not separately create a Player and then update the enquiry. The existing R2 SECURITY DEFINER RPC:

1. Requires the authenticated Academy Owner role and current academy.
2. Locks the enquiry row with `FOR UPDATE`.
3. Returns the existing player link if already converted, avoiding duplicate conversion on retries.
4. Rejects Lost enquiries until an Academy Owner reopens them.
5. Validates center and active batch belong to the current academy, and requires an assigned enquiry center to match the conversion center.
6. Calls the existing `create_player_transactional` workflow, preserving parent reuse/create and player-batch invariants.
7. Links the returned player and marks the enquiry Converted within the same database transaction.

The database RPC, not the UI, is the authorization boundary. Super Admin, Coach, Parent and anonymous users must not be able to execute a successful conversion.

## Scope intentionally excluded

- No direct player/parent inserts from the browser.
- No separate update after player creation.
- No conversion of Lost enquiries without first reopening them.
- No editing or reconverting already Converted enquiries.
- No changes to payment, subscriptions, attendance, trial attendance or unrelated modules.
- No test Player/enquiry was created by implementing this feature.

## Validation status

The conversion service, dialog and validation tests are committed. Jest, production build, GitHub Actions and browser acceptance have **not** been confirmed for the final R5 head. R5 is implementation-complete but not verified/release-ready until those checks pass.

## Browser acceptance checklist

Use the user's existing genuine enquiry for non-destructive UI checks. Only convert a genuine lead if the academy intends to enroll that player; otherwise use an isolated Supabase development branch or controlled fixtures. Do not create fake records in the active database.

1. Super Admin: no conversion action; RPC direct invocation must be denied.
2. Coach: no conversion action; RPC direct invocation must be denied.
3. Academy Owner: conversion action appears for New/Contacted/Trial Scheduled/Trial Completed/Follow-up Required.
4. Lost enquiry: no conversion action until owner reopens it.
5. Converted enquiry: no conversion action or ordinary status editor; repeated RPC call returns the existing player link without creating a second player.
6. Parent name, gender, joining date, center and batch are required; email and address are optional.
7. For an assigned-center enquiry, conversion center is fixed and batch options belong to that center.
8. For an unassigned-center enquiry, owner can select an active center and then a batch belonging to it.
9. Successful conversion creates exactly one Player and the required parent/batch relationship, links the enquiry, and persists Converted status after refresh.
10. Verify parent reuse/create behavior and that player, parent and batch invariants remain consistent.
11. Verify failed validation/transaction leaves no partial Player and does not mark the enquiry Converted.
12. Verify the resulting Player appears in Players and only then participates in normal player workflows; no payment or attendance records are auto-created.
13. Test retry/concurrency and cross-academy center/batch tampering with controlled fixtures in an isolated environment.
14. Run Jest, production build, CI and existing Player CRUD/payment/attendance regression tests before release.
