# AcadPro Enquiries Module — Frozen V1 Specification

**Status:** Specification frozen; implementation not started  
**Branch:** `payment-module-finalization`  
**Specification date:** 12 October 2026  
**Scope:** Enquiry capture, center-scoped visibility, simple follow-up/trial tracking, and Academy Owner-only conversion into an existing AcadPro Player workflow.

## 1. Product objective

Capture prospective players before enrollment. An enquiry is a lead, not a Player record. It must not appear in player lists, attendance, batch rosters, subscriptions, fees, dues, payments, or parent portal views until an authorized Academy Owner converts it into a Player.

Enquiry creation must be quick. The only required human-entered lead details are:
1. Player name
2. Parent contact number
3. Player date of birth

Academy, creator, timestamps and authorized center scope are system/context fields, not additional personal details required from the person registering the enquiry.

## 2. Frozen decisions

- Coach visibility: all enquiries associated with the coach's authorized center(s), not only enquiries created by that coach.
- Conversion permission: Academy Owner only.
- Super Admin: platform-wide read-only enquiry visibility; no conversion in V1.
- Trial tracking: one optional trial date and a simple enquiry status. No multi-session trial scheduler, trial attendance workflow, or coach feedback in V1.
- Enquiry source is optional.
- A potential duplicate produces a warning; it does not automatically reject or merge the enquiry.
- Do not delete enquiries to represent a failed lead. Use the Lost status.
- No public/anonymous enquiry form, Facebook/Instagram API integration, WhatsApp integration, notifications, or marketing automation in V1.
- No Enquiry-to-Batch assignment is required in V1.
- Use the existing database foundation; do not create a second competing enquiry table.

## 3. Repository and live database audit

Audited repository branch `payment-module-finalization`, HEAD `7d26873e6ebdfa5a7c7e1d8d5bcd6f8331a265a6`.

Findings verified against the live Supabase project on 12 October 2026:
- `public.inquiries` exists and currently contains zero rows.
- `public.trial_attendance` exists and currently contains zero rows.
- RLS is enabled on both tables.
- Direct privileges for `anon` and `authenticated` are revoked on both tables; no RLS policies currently exist. This is the intentional Phase 7 deny-by-default state.
- No enquiry page, route, service or sidebar entry was found in the current frontend tree/search.
- Existing `public.inquiries` fields include `id`, `academy_id`, required `parent_name`, required `player_name`, required `phone`, nullable `dob`, `inquiry_source`, nullable `assigned_center_id`, nullable `assigned_batch_id`, `trial_status` (default `pending`), `notes`, and `created_at`.
- Existing foreign keys link the enquiry to an academy, optional center and optional batch. `trial_attendance.inquiry_id` references `inquiries.id`.
- Existing player creation uses `create_player_transactional`, which validates academy/center/batch, reuses a unique active parent by phone when possible, creates player + parent as needed, inserts the current `player_batches` mapping, and returns `playerId`/ `parentId`. It requires full enrollment details including parent name, center, batch, DOB and joining date, so the conversion form must collect the missing enrollment fields.
- The current transactional player RPC authorizes Super Admin and the Academy Owner for that academy. The Enquiries product permission is narrower: only the Academy Owner may convert; do not expose conversion to Super Admin.
- Coach-to-center scope must be derived through the coach's active `coach_batch_assignments` joined to active batches and their centers. Never trust a client-supplied academy or center ID without server-side validation.

**Safety rule:** keep the existing Phase 7 lockdown in place until the new RLS/RPC authorization has been implemented and tested. Do not grant broad direct table access or add frontend-only filters as a substitute for database authorization. Do not edit/replay historical migrations or mutate the live migration ledger.

## 4. Data model direction

Extend `public.inquiries`; keep the database table name for compatibility with the existing schema, while using “Enquiries” in the product UI.

### Existing fields to retain
- `id`: generated UUID primary key.
- `academy_id`: required tenant scope, validated against the authenticated role.
- `player_name`: required, trimmed.
- `phone`: required, normalized to digits for validation/storage.
- `dob`: required for new enquiries; no future DOB.
- `inquiry_source`: optional controlled source value.
- `assigned_center_id`: optional for owner-created leads that are not yet center-specific; required for coach-created enquiries and must be within that coach's authorized center scope.
- `notes`: optional internal note; not required at quick capture.
- `created_at`: creation timestamp.

### Schema adjustments required
- Make `parent_name` nullable; it is not part of enquiry capture and is collected during conversion.
- Make `dob` NOT NULL after a migration preflight confirms no rows need backfilling. Live row count is currently zero, but the migration must fail safely if that assumption changes.
- Rename the unused `trial_status` column to `status` only after checking live schema and dependencies; the table has no current frontend references and is empty as of the audit. Use a database CHECK constraint for supported status values.
- Add optional `trial_date`.
- Add `created_by` referencing `public.users(id)`.
- Add `updated_at` with a reliable update strategy.
- Add nullable `converted_player_id` referencing `public.players(id)`, plus `converted_at` and `converted_by` for conversion audit.
- Add appropriate indexes for academy/center, status, created time, and normalized phone lookup.
- Preserve the existing academy/center foreign keys. Validate that the selected center belongs to the same academy. Avoid adding a second independent batch requirement to the enquiry model.

Exact SQL and constraint design must be reviewed against the live schema immediately before implementation. Use a new forward migration with a new timestamp; never edit an applied migration.

## 5. Source values

The optional UI dropdown uses these normalized values:
- Facebook
- Instagram
- Phone Call
- Walk-in / On-premises
- Referral
- Other

Default: blank / “Not specified”. Source is not a required field. Do not claim automatic source attribution from Facebook or Instagram; the V1 value is manually selected by the person recording the enquiry.

## 6. Status lifecycle

Allowed statuses:
- `new`: default on creation.
- `contacted`: parent has been contacted.
- `trial_scheduled`: a trial date is arranged; `trial_date` is recommended and must be set for this status.
- `trial_completed`: the trial happened; enrollment decision is pending.
- `follow_up_required`: another contact or decision is pending.
- `converted`: a Player was created and linked successfully.
- `lost`: the lead will not proceed.

Use readable labels in the UI: New, Contacted, Trial Scheduled, Trial Completed, Follow-up Required, Converted, Lost.

V1 uses one optional trial date only. No `trial_attendance` rows are created by this workflow. A future phase may introduce multiple trial sessions; that is explicitly out of scope.

Lost reason is optional in V1; do not introduce a large required CRM form. Status transitions and conversion invariants must be validated server-side. A converted enquiry cannot be converted again or moved back to an active status through ordinary edits. Reopening a lost lead is an Academy Owner action and must not create a duplicate Player.

## 7. Roles and authorization matrix

| Capability | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| Read enquiries | All academies, read-only | Own academy | Authorized center(s) only | No access |
| Create enquiry | No in V1 | Yes | Yes, authorized center only | No access |
| Edit lead details | No | Own academy | Only within authorized center(s) | No access |
| Update status / trial date | No | Own academy | Within authorized center(s) | No access |
| Convert to Player | No | Own academy only | No | No access |
| Delete enquiry | No | No hard delete in V1; mark Lost | No | No access |

Owner-created enquiries may have no center initially. They remain visible to the owner, but are not visible to coaches until a center is assigned. A coach must have an active assignment to at least one active batch at that center to access the enquiry. If the coach has multiple authorized centers, show a center selector limited to those centers. The backend must validate the assignment at write and read boundaries.

Super Admin may filter by academy/center but is read-only. Parents must never access enquiries.

## 8. UX requirements

### Enquiries list
- Page title: Enquiries.
- “Add Enquiry” action for Academy Owner and Coach only.
- Search by player name or parent contact.
- Filters: status, source, center; Super Admin also gets academy filter.
- Display player name, masked or appropriately visible parent contact, DOB/age, source, center, status, optional trial date, created date and creator where appropriate.
- Owner sees all enquiries for their academy, including unassigned-center leads.
- Coach sees all enquiries in their authorized center(s), regardless of creator.
- Super Admin sees platform-wide data read-only.
- Empty state and loading/error states must be clear and accessible.
- Counts, if shown, must be derived from the scoped result set and must not leak other tenants' totals.

### Quick-create form
Required: Player Name, Parent Contact, DOB.
Optional: Source and internal note.
Context: Center is automatically fixed for a single-center coach, or selected from the coach's authorized centers if there are multiple. Owner may optionally assign a center.
No parent name, email, address, gender, batch, subscription, payment, or full registration form during enquiry capture.

Validation:
- Trim player name; reject blank.
- Normalize parent contact for comparison/storage and validate a 10-digit Indian mobile number, consistent with current player registration.
- DOB required, valid date, and not in the future.
- Source must be one of the supported values or null.
- Never accept academy/center scope solely because it was passed from the browser.

### Enquiry details / edit
- Show the three required details, source, center, status, trial date, created-by/created-at and updated-at.
- Owner and authorized coach can update permitted lead fields and status.
- Marking Trial Scheduled requires a trial date.
- Marking Converted is not an ordinary status dropdown action; it uses the conversion flow.
- Lost is a terminal operational outcome; preserve the record.

## 9. Duplicate detection

Before creating an enquiry, show possible matches within the same academy based on normalized parent phone and player name/DOB. Use a warning and allow the authorized user to continue after reviewing it.

Do not impose a unique constraint on phone alone: one parent may have siblings. Do not automatically merge or overwrite records. The database should prevent duplicate conversion of the same enquiry, while possible duplicate enquiries remain a guided user decision.

## 10. Player conversion flow

Only Academy Owner can convert. Conversion opens the existing player enrollment workflow with these fields prefilled:
- Player name
- DOB
- Parent phone
- Academy
- Center, if already assigned

The owner must complete the remaining required player fields, including parent name, center, batch and joining date; optional fields include gender, parent email and address. Center and batch must be active and belong to the enquiry's academy and selected center. Parent matching must reuse the existing secured transactional player workflow and must not create a duplicate active parent for a unique phone.

### Atomicity and exactly-once behavior
- Conversion must be a single database transaction: validate owner scope and enquiry status, create the player using the established transactional logic, write `converted_player_id`, `converted_at`, `converted_by`, and set status to `converted`.
- If any step fails, roll back the player, parent/player-batch writes, and enquiry update together.
- A row lock or equivalent concurrency guard must prevent two concurrent conversions of one enquiry.
- A converted enquiry cannot create another player on retry or double-click. Return the already-linked player as a safe result or show a clear already-converted response; never create a second record.
- Conversion must not mark the enquiry Converted before the player exists and is linked.
- Preserve the existing player creation validation, duplicate protections, parent reuse rules and player-batch invariant. Do not weaken `create_player_transactional` authorization to enable this feature.
- Super Admin remains read-only for enquiries and cannot invoke the conversion workflow, even though the existing generic player RPC permits Super Admin player creation.

The exact wrapper design must be reviewed against the live function body, grants and RLS before implementation. Avoid a two-request frontend sequence that can leave a Player created while the enquiry remains unconverted, or vice versa.

## 11. Security architecture

- Keep RLS enabled on `public.inquiries`.
- Implement explicit least-privilege policies/grants or controlled RPCs for read/create/update. Do not grant direct unrestricted INSERT/UPDATE to authenticated users.
- Authorization must validate authenticated identity, role, academy, and coach-to-center assignment server-side.
- Use the existing `private.current_user_role()`, `private.is_super_admin()` and established scope helpers only after verifying their live definitions and grants.
- If SECURITY DEFINER RPCs are used, set an empty/fixed safe search path, revoke EXECUTE from PUBLIC/anon, grant only the required role, and explicitly validate every authorization boundary.
- Keep Super Admin read-only for enquiry operations; UI hiding alone is not authorization.
- Parent and anonymous access must be denied.
- Validate that a center belongs to the enquiry academy; reject cross-academy and forged center IDs.
- Use server-side constraints for status values, required fields, conversion linkage, and immutable converted state.
- Do not expose unnecessary personal details in list views or logs. Do not log full parent phone numbers.
- Re-run Security Advisor and regression-test all dependent RPCs if any shared function or grant is changed.

## 12. Implementation phases

### R1 — Specification and audit
Complete this document and verify live schema, table rows, policies/grants, role helpers, coach assignments, player transaction RPC and frontend routes. No feature code in R1.

### R2 — Migration and security
Add a forward migration to evolve `public.inquiries`, add constraints/indexes/audit fields, and introduce explicit least-privilege RLS/RPC authorization. Verify migration source against the live schema before applying. No broad client grants.

### R3 — Service, create form and list
Create an enquiry service and role-aware Enquiries page; implement quick capture, source, search, filters, scoped center selection, duplicate warning and accessible states.

### R4 — Status and trial date
Implement allowed status changes, optional trial date, status/date validation, and audit timestamps. Do not implement multi-session trials.

### R5 — Atomic conversion
Add Academy Owner-only conversion to the existing player workflow; prefill enquiry details, preserve transactional player/parent/batch behavior, link the player and enforce exactly-once conversion.

### R6 — Regression and release
Test Super Admin, Academy Owner, Coach, Parent and unauthenticated access; cross-academy/center ID tampering; center assignment changes; duplicate warnings; DOB/phone validation; status transitions; conversion success/rollback/retry/concurrency; parent reuse; player-batch invariant; existing player CRUD and other modules. Run Jest, production build, CI and browser acceptance. Update project docs and migration reconciliation without rewriting historical ledger entries.

## 13. Acceptance criteria

1. A coach can create an enquiry using only player name, parent contact and DOB, with center context supplied from authorized scope.
2. The new enquiry is visible to the Academy Owner and to all coaches authorized for its assigned center, regardless of creator.
3. A coach cannot view or mutate an enquiry belonging to another academy or an unauthorized center, including by direct ID/API calls.
4. An owner can create an enquiry without assigning a center; it remains owner-visible and is not exposed to coaches until assigned.
5. Super Admin can view all enquiries and cannot create, edit, change status or convert them.
6. Parent and anonymous users cannot read or mutate enquiries.
7. Source is optional; only supported source values are accepted.
8. Status defaults to New; Trial Scheduled requires a date; DOB cannot be missing or in the future.
9. Duplicate candidates trigger a warning without automatically merging/rejecting legitimate sibling enquiries.
10. Conversion pre-fills existing details, requires missing enrollment fields, and uses existing transactional player/parent/batch logic.
11. Successful conversion creates exactly one Player and links it to exactly one enquiry; failure leaves no partial Player or Converted status.
12. Converted enquiries cannot be converted twice or edited back to an active status through ordinary actions.
13. No enquiry appears as a Player or affects attendance, batches, subscriptions, dues, payments, receipts, analytics, or Parent Portal before conversion.
14. Existing Phase 7 deny-by-default behavior remains until the new policies/RPCs are installed; no unrelated modules or historical migrations are changed.
15. Documentation, tests, build, CI and browser acceptance are reported separately; no result is claimed unless actually observed.

## 14. Explicitly out of scope for V1

- Facebook/Instagram lead ingestion or APIs
- WhatsApp messaging or automated reminders
- Public/anonymous lead forms
- Multi-session trial scheduling and trial attendance
- Trial coach feedback/scoring
- Batch reservation or enrollment before conversion
- Fee quotes, payment collection, subscriptions or receipts on enquiries
- Advanced CRM campaigns, lead scoring, exports or dashboards
- Hard-delete workflow
- Parent Portal enquiry access

## 15. R1 exit decision

**Specification frozen; coding may start only after the implementation plan is reviewed against this document.** R2 must begin with a final live-schema/function/policy check and a new forward migration. No schema or application mutation was performed during the R1 audit.
