# Player Profile — P3.2 Data Contract

Branch: `payment-module-finalization`

Status: P3.2 data contract; P3.4 private player-photo implementation added on 2026-10-21. Browser and role-security verification remain pending.

## 1. Purpose and scope

Extend the existing player details modal in `frontend/src/pages/Players.js`. Do not create a parallel player table, new profile route, duplicate image column, or independent payment ledger.

The profile must use existing records and preserve the current player list, edit flow, session enrollment flow, and deactivation behavior.

## 2. Shared player identity header

Source: `public.players`, with existing relationships to `academies`, `centers`, `batches`, and `parents`.

Fields:
- `players.id`: stable player identifier; use for follow-on queries.
- `players.full_name`: display name.
- `players.profile_image`: currently nullable text field; database inspection found 49 player rows with empty values and no populated player-image values to establish an existing URL/path convention. Do not assume it contains a public URL.
- `players.player_code` and `players.registration_number`: optional identifiers; display only when populated, without inventing a fallback identifier.
- `players.dob`, `gender`, `joining_date`, `player_status`, `is_active`: existing profile facts.
- Academy, center, and batch names come from existing relationships; never derive them from untrusted storage paths.

Medical notes are not part of the shared profile summary. Do not expose them as a new profile field in this phase.

## 3. Training schedule snapshot

Primary sources:
- `player_batch_schedules`: active player-to-session enrollment (`player_id`, `batch_schedule_id`, `is_active`, `enrolled_from`, `enrolled_until`, `academy_id`).
- `batch_schedules`: `day_of_week`, `start_time`, `end_time`, `session_label`, `is_active`, `batch_id`, `center_id`.
- Existing schedule relationships provide batch and center display names.

Rules:
- Show only active enrollments linked to active schedules.
- Order by day of week, then start time.
- Present day and time compactly; session label is optional and should not be required.
- If no active enrolled sessions exist, show a clear “No active sessions assigned” empty state. Do not infer a schedule solely from the player's `batch_id`.
- Scope the query to the selected player ID and rely on existing authenticated Supabase RLS. Do not load all players' enrollments and filter only in the browser.

## 4. Attendance snapshot

Source: `public.attendance`.

Relevant fields: `player_id`, `attendance_date`, `status`, `is_deleted`, `batch_schedule_id`.

Rules:
- Exclude rows where `is_deleted = true`.
- Count `present` and `absent` records; do not count soft-deleted records.
- Attendance rate = present records / (present + absent records) × 100. The unit is recorded attendance sessions, not unique calendar days, because a player may have multiple sessions on one day.
- If there are no eligible records, show “No attendance recorded” rather than 0% (which could imply missed sessions).
- Query by the selected player ID and order newest first if a recent-attendance detail is later added. The initial snapshot needs only the aggregate counts/rate.
- Verify any unexpected status values during implementation; do not silently treat them as present or absent.

## 5. Fees paid — last three calendar months

Source of truth: `public.payments`, not `payment_dues.paid_amount` and not `parent_payment_submissions.amount`.

Relevant fields:
- `player_id`
- `payment_date`
- `amount_paid`
- `payment_entry_type` (observed values: `payment`, `adjustment`)
- `related_payment_id`

Display exactly three calendar-month buckets: current calendar month and previous two calendar months, using the application user's local calendar month and explicit start-inclusive/end-exclusive boundaries. Display zero as ₹0. Sum multiple eligible entries in each month.

Accounting rules:
- Include ledger entries recorded in `payments`; pending/unrecorded UPI submissions are not payments.
- Do not also add a `parent_payment_submissions` row when it links to a payment, because that would double-count the same receipt.
- Linked adjustment entries are signed ledger deltas and must be included once in the month corresponding to the adjustment's `payment_date`. Do not count the original payment again as part of an adjustment.
- Do not assume every negative amount is a reversal or every positive amount is a receipt without checking its `payment_entry_type` and linked record.
- Before implementation, inspect the existing correction/adjustment workflow and verify whether any additional reversal/refund marker or exclusion state exists. Current inspected data contains 41 `payment` entries and one `adjustment` entry; this is not enough to prove all edge cases.
- Query only the selected player and the three-month date range. Preserve RLS. Do not show due balances or link to payment history in this compact snapshot.
- Treat database numeric amounts as numeric values, and format currency using INR locale formatting.

## 6. Role and action contract

| Role | Profile access | Photo action | Player details edit/deactivate | Fee snapshot |
|---|---|---|---|---|
| Super Admin | View across authorized academies | View only | No profile edit/deactivate action in this profile | Visible |
| Academy Owner | View players in own academy | Upload/change | Existing edit/deactivate actions remain available | Visible |
| Coach | View players in assigned batches only | View only | No edit/deactivate actions | Hidden |

The profile presentation is not a replacement for RLS. Keep every data query scoped to the selected player and preserve existing policies. Do not broaden existing policies to implement the profile.

Parent portal is outside this phase's profile integration. If player photos are later displayed there, access must be restricted to the authenticated parent's linked child.

## 7. Player image storage contract — implementation gate

- Keep `players.profile_image`; do not add another column.
- A new player-photo bucket must be private.
- Object paths should encode academy and player identifiers for organization, but path names alone are not authorization.
- Storage policies must verify the authenticated role, academy ownership, selected player's trusted database relationship, and Coach assigned-batch scope. Super Admin may read but must not upload/replace/delete.
- Use authenticated reads or short-lived signed URLs; never public bucket URLs.
- Academy Owner may upload/replace only for players in their own academy. Coach is read-only.
- Validate image type and size on the client and enforce the storage policy server-side.
- Since all 49 inspected player records have empty `profile_image` values, there is no populated legacy player-image format to migrate based on the current database snapshot. Recheck before deployment because data may change.

## 8. Query/service boundary

Introduce a focused service for profile-only reads rather than adding unrelated profile queries to the existing player create/update service. Suggested responsibilities:
- `getPlayerProfile(playerId, role context)`: identity and related names, subject to RLS.
- `getPlayerScheduleSnapshot(playerId)`: active enrolled schedules.
- `getPlayerAttendanceSnapshot(playerId)`: eligible present/absent counts.
- `getPlayerMonthlyPayments(playerId, startInclusive, endExclusive)`: ledger entries for the three-month window, with adjustment semantics verified.

Avoid accepting academy/player IDs from UI as proof of authorization. IDs select records; RLS and validated server-side policy determine access. Keep profile queries read-only in this phase.

## 9. P3.2 verification checklist

- [x] Confirmed current profile source fields and existing player-image column.
- [x] Confirmed schedule enrollment and schedule fields.
- [x] Confirmed attendance status/deletion fields.
- [x] Confirmed payment ledger and adjustment columns.
- [x] Confirmed no populated player-image values in the inspected database snapshot.
- [ ] Trace every payment correction/refund/reversal path before implementing monthly totals.
- [ ] Implement private player-photo storage policies and test with all three roles.
- [ ] Add service unit/manual checks for empty data, multiple sessions per day, three month boundaries, and linked adjustment rows.
- [ ] Browser-test profile behavior for Super Admin, Academy Owner, and Coach.
- [ ] Run build/lint and regression tests before release sign-off.

P3.2 establishes the contract only; it is not release sign-off.


## 10. P3.4 private player-photo implementation (2026-10-21)

Implemented on `payment-module-finalization`:
- Created private Storage bucket `player-photos`, with 2 MiB limit and PNG/JPEG/WebP MIME allowlist.
- Added Storage SELECT policy for authenticated users whose existing player-row RLS permits access to the player. This is intended to preserve Super Admin, Academy Owner, and assigned-batch Coach read scope; verify with role-specific sessions.
- Added Academy Owner-only insert/update/delete policies scoped to the current academy and a trusted player row.
- Object path format: `<academy-uuid>/<player-uuid>/<unique-filename>.<png|jpg|jpeg|webp>`.
- Added `frontend/src/services/playerPhotoService.js` for client-side validation, upload, storing the private object path in existing `players.profile_image`, and generating a 30-minute signed URL.
- Extended the existing Players profile modal with Academy Owner-only upload/change control; initials remain the fallback when no signed photo URL is available.
- Kept Super Admin and Coach read-only in the UI. No parent-portal photo UI was added.

Verification status:
- [x] Private bucket exists in the active Supabase project and is configured with the expected size/type limits.
- [x] Four named Storage policies exist for authorized read and owner insert/update/delete.
- [ ] Browser-test upload/change as Academy Owner.
- [ ] Verify Super Admin and assigned-batch Coach can view but cannot upload/replace/delete.
- [ ] Verify cross-academy owner access and arbitrary player IDs are denied.
- [ ] Verify signed URL expiration/refresh and image fallback behavior.
- [ ] Run frontend build/lint and regression checks.

Security note: the read policy relies on the existing RLS on `public.players`; confirm it with real role sessions before release. P3.4 is implemented but not yet release-signed-off.
