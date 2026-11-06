# AcadPro Architecture

**Last Updated:** 6 November 2026 (Attendance AM7.3 pagination checkpoint; other sections historical)  
**Current Branch:** `payment-module-finalization`

## 1. Platform

AcadPro is a football academy management SaaS platform built with React, JavaScript, React Router, Supabase Authentication, Supabase PostgreSQL, Git/GitHub and Vercel. The system is multi-tenant at the academy level.

## 2. Roles and scope

| Role | Scope |
|---|---|
| `super_admin` | Entire platform |
| `academy_owner` | Own academy |
| `coach` | Assigned batches and players |
| `parent` | Own account and linked player(s) |

## 3. Data hierarchy

```text
Academy → Center → Batch → Player → Parent
```

Parent linkage is represented by `players.parent_id → parents.id`. Parent authorization is player-scoped, not merely academy-scoped.

## 4. Authentication and routing

- Super Admin / Academy Owner: `/dashboard`
- Coach: `/coach-dashboard`
- Parent: `/parent-portal`

The Parent Portal is protected by a parent-only route guard. Supabase Auth handles authentication; role and academy information is stored in `public.users`.

### Attendance workspace routing (AM5)

- The **canonical attendance entry route** is `/attendance?view=mark|history`. `AttendanceWorkspace.js` resolves the authenticated database-backed user role and mounts the existing Owner `Attendance.js`, Coach `CoachAttendance.js`, or role-scoped `AttendanceHistory.js` view. Their existing Layout, filtering, session selection, inserts/updates and History soft-deletion are preserved.
- Academy Owners and Coaches default to `?view=mark`; Super Admin defaults to `?view=history`. Any Super Admin request for Mark is normalized to History. Parent is denied all Attendance management routes.
- Former `/attendance-history` and `/coach-attendance` paths still have their original role guards and now redirect via `LegacyAttendanceRedirect` to the appropriate canonical view. Query parameters (centerId/batchId/scheduleId/date and any others) and URL hashes are preserved during these redirects. The existing Owner `/attendance` links normalize to Mark without losing dashboard parameters.
- Sidebar, view cards, Coach Dashboard, Academy Owner Dashboard and generic Dashboard navigation now use canonical links. The page views still mount/unmount on selection, so unsaved draft selections are not retained across views.
- Route and visual permissions **do not replace Supabase RLS**. Super Admin is history-only for creation, Coach marking remains assigned-session scoped, and Coach edits are limited to the seven UTC calendar dates ending today. No new table, RLS policy, service-role access or privileged RPC was introduced.
- AM5 routing source acceptance at its original checkpoint was pending. AM6.6 focused CI subsequently passed 10 Jest suites / 82 tests and React build on `728652df`, but role/browser/tenant/release acceptance remains pending. See `ATTENDANCE_AM5_ROUTING_20261105.md` and `ATTENDANCE_AM6_MARK_UX_20261105.md`.

### Attendance AM6.6 — compact context and recurring training days

- Academy Owner page `Attendance.js` keeps current academy context and four date-specific Mark filters while removing the space-consuming Daily Operations and roster headings. It calls `getActiveBatchAttendanceDays(batchId, centerId)` in `scheduleViewService.js`, which reads **active** `batch_schedules.day_of_week` with existing RLS and batch/center predicates; it does not infer weekdays from the selected date or change `getAttendanceSessionsForBatch`.
- Coach page `CoachAttendance.js` uses the already fetched authorized `getCoachAttendanceSessions` records (including `batches`, `centers`, weekday/start/end time) to identify the training session in the option label and compact context; **no additional Coach fetch**.
- `attendancePresentation.js` formats recurring weekdays and Coach option text. Load/empty/error day states do not permit or block writes: schedule selection and backend attendance RLS remain authoritative. Neither marking component's existing Save/Update calls, role guards, History edits/soft deletes nor any database objects changed.
- Source reviewed and focused CI passed; live browser/negative-RLS and release acceptance pending.

### Attendance AM7 — History presentation (no data-contract change)

- `AttendanceHistory.js` retains existing History query flow: `attendance` scoped by authenticated role's RLS, optional academy/batch/center/date filters, client Player/Status filtering and `PAGE_SIZE = 5` slicing. AM7.1–AM7.2 change presentation and scoped filter controls only, not authorization or database API calls.
- The Academy select renders only to Super Admin; Owner and Coach see their read-only academy name. Native record table rows become mobile/tablet presentation cards through CSS; all Date/Player/Center/Batch/Session/Status/Marked By/Actions cells remain present and accessible. Buttons continue using existing `canEditAttendanceRecord` and `canDeleteAttendance`.
- `formatAttendanceSessionLabel` is reused for non-legacy History schedule time presentation. Coach seven-UTC-date existing-record edit restrictions and Owner/Admin historical edit/delete remain unchanged.
- AM7 focused CI passed **10 suites / 86 Jest tests and React build** on `c5e9f9e`; live role/browser/RLS acceptance pending. A server-paginated scalable History contract is **not** implemented; any future AM7.3 change requires an explicit review of Supabase filtering, relationship selection, count, cross-tenant RLS and pagination consistency.

### Attendance AM7.3 — server-side, RLS-scoped History pagination

- `frontend/src/services/attendanceHistoryService.js` is a new **read-only authenticated Data API wrapper**. It selects only the five current records with `count: "exact"`, `.order("attendance_date", { ascending: false })`, `.order("id", { ascending: false })`, then `.range((page - 1) * 5, (page - 1) * 5 + 4)`. No service-role key, new endpoint, SQL migration or privileged RPC is introduced.
- Academy Owner and Coach queries require their own profile `academy_id`, reject mismatched academy-filter parameters before requesting data, and still depend on `public.attendance` RLS. Super Admin may select a platform-wide scope or specific academy; Parent is denied this management service. Coach has no expanded permissions. Selected center is converted to authorized batch IDs via existing `getAccessibleBatches` rather than assuming legacy `attendance.center_id` is populated.
- Batch, status and inclusive date bounds filter at PostgREST. History's former Player-ID dropdown is replaced with a debounced **player-name substring filter**, backed by `players!inner(full_name)` and `ilike`, applied **before** exact count and paging. No player-data scan is transferred to the browser.
- History view stores only current rows and count; a sequence counter drops stale responses. Save/Delete refresh the active server page and page number clamps when a deletion empties the last page. Existing `canEditAttendanceRecord`, `canDeleteAttendance`, `updateAttendanceStatus`, `softDeleteAttendance` and 7-UTC-date policy remain unchanged.
- Focused CI validated **11/11 suites, 98/98 tests and production React build at `98cb6cb1`**. Active Supabase read-only schema and page-count SQL were inspected. **Live logged-in role/RLS and high-volume performance verification remain pending**. No index creation was made; evaluate query plans if dataset growth justifies it.

## 5. Authorization layers

```text
Role Matrix → Frontend permissions → Route guards → Centralized data scope → Supabase RLS → PostgreSQL
```

Frontend filtering is not a security boundary. Database policies enforce role, academy, assignment and parent/player restrictions.

## 6. Data-scope model

- Super Admin: platform-wide permitted data
- Academy Owner: own academy
- Coach: assigned batches and their players
- A batch may have multiple active coach assignments; each active assigned coach can work with that batch.
- Parent: linked player(s)

This scope applies to players, attendance, subscriptions, payment dues, payments, receipts, analytics and the Parent Portal.

## 7. Player data integrity architecture

The Player module uses the following current-batch model:

```text
players.batch_id
      ↓
current player batch

player_batches
      ↓
current operational mapping
```

For active players:

- A non-null `players.batch_id` requires exactly one matching `player_batches` row.
- A null `players.batch_id` requires zero `player_batches` rows.
- Inactive players are excluded from this active invariant.
- A unique constraint prevents duplicate current player-batch mappings.

Player create/update operations use secured transactional PostgreSQL functions so that player, parent and current batch mapping changes are committed atomically.

The database also validates the invariant through deferred constraint validation and uses advisory locking around sensitive player/parent writes.

## 8. Bulk Player Import architecture

Bulk import is a Super Admin-only workflow.

```text
Excel workbook
    ↓
Parser
    ↓
Row normalization
    ↓
Validation
    ↓
Preview / confirmation
    ↓
import_players_bulk RPC
    ↓
Atomic parent + player + player_batch writes
```

The import layer includes:

- Excel template and instructions
- Worksheet selection
- Required-column validation and aliases
- Excel date and phone normalization
- Row-level validation with source-row references
- Center/batch scope validation
- Parent reuse/create logic
- Duplicate player protection
- Maximum 1000 rows per request
- Advisory locking by academy/parent phone
- Atomic rollback if any row fails
- Import summary for imported players and parent reuse/creation

No database writes occur during parsing or validation/preview.

## 9. Implemented modules

- Authentication and RBAC foundation
- Academy, center and batch management
- Player and coach management
- Coach-batch assignments
- Player transactional CRUD and data-integrity hardening
- Bulk Player Import
- Attendance and attendance history
- Subscription plans and player subscriptions
- Payment dues and payment collections
- Receipt management
- Dashboard analytics
- Parent Portal foundation

Planned modules include Parent Portal completion, Player Performance, Reports, Notifications and Razorpay/online payments.

## 10. Security and RLS status

Phase 5.1 security validation is complete:

- Role and academy access review
- Centers and player-batches mutation-policy hardening
- Cross-academy isolation testing
- Coach assignment isolation validation
- Parent isolation foundation and validation
- Database policy and Security Advisor findings review

RLS is enabled on the major role-sensitive tables, including `academies`, `attendance`, `batches`, `centers`, `coach_batch_assignments`, `coach_batches`, `coaches`, `parents`, `payment_dues`, `payments`, `player_batches`, `player_subscriptions`, `players`, `subscription_plans` and `users`.

Phase 7 Security Advisor remediation (11 October 2026):
- RLS is enabled on `public.inquiries` and `public.trial_attendance`; direct `anon` and `authenticated` table privileges have been revoked. Both tables were empty when inspected and remain deny-by-default until an explicit access model is needed.
- `public.payment_number_counters` remains RLS-enabled with direct client privileges revoked; it is intended for server-side/database use.
- The Security Advisor reports nine authenticated `SECURITY DEFINER` RPC findings: seven pre-existing functions plus the two P1.4 parent UPI submission/review RPCs. The P1.4 functions use empty `search_path`, deny anonymous/PUBLIC execution, and validate role and scope before mutation. Authenticated execution is required by the application; do not change grants or security mode without reviewing dependencies and regression-testing.
- `update_my_coach_profile(...)` is the next candidate for explicit authentication/coach-role and input validation review. No hardening change has yet been applied.
- Leaked-password protection is unavailable on the current Supabase Free plan and is deferred until a plan upgrade is justified.
- Performance-advisor findings are tracked separately from authorization completion.

See `docs/PHASE_7_SECURITY_ADVISOR_REMEDIATION.md` for the live finding inventory and `supabase/MIGRATION_RECONCILIATION.md` for the migration-history discrepancy and safety rules.

## 10C. Parent UPI Payment Submission and Review (P1.4)

Parents can submit a claim against an outstanding due from Parent Financial Overview when UPI settings are enabled. The `public.parent_payment_submissions` table stores the claim and review audit state separately from the payment ledger. `submit_parent_upi_payment(...)` validates parent-to-player and due-to-player scope, remaining balance, UTR uniqueness and date/amount rules. `review_parent_upi_payment(...)` is Academy Owner-only, rechecks balance before acceptance, and requires a rejection reason. Super Admin can read claims but cannot review them. Parents see their own claims; Coach and anon access is denied.

The table grants authenticated clients SELECT only; mutations use controlled SECURITY DEFINER RPCs with empty search paths and explicit authorization checks. One active pending/accepted claim is allowed per due. **Accepting a claim does not create a row in `payments`, update `payment_dues`, or issue a receipt.** P1.5 will implement safe posting through the existing secured collection workflow. See `docs/P1.4_PARENT_UPI_SUBMISSION_REVIEW.md`.

## 10B. Parent UPI QR and WhatsApp Sharing (P1.3)

The parent portal embeds `ParentUpiPaymentDetails` for the selected linked child, in addition to the same component on Parent Financial Overview. It reads enabled settings through the academy-scoped `academy_payment_settings` RLS policy. A user-initiated WhatsApp link shares academy name, payee, optional UPI ID and the public QR image URL. It does not create a payment submission or alter the payment ledger. No schema or Storage changes are part of P1.3. See `docs/P1.3_PARENT_UPI_WHATSAPP_SHARING.md`.

## 10A. Academy UPI Settings (P1.2)

The `public.academy_payment_settings` table stores one row per academy for UPI ID, payee name, QR object path, enabled state and audit timestamps. RLS grants owner-scoped create/update, Super Admin read-only access, and Parent read access only to enabled settings for academies of linked children. Coach and anon access is denied.

The `academy-upi-qr` Storage bucket is public-read so parent pages can display QR images; uploads/replacements/deletes are restricted by Storage RLS to the authenticated Academy Owner and the academy UUID path prefix. Images are PNG/JPEG/WebP up to 2 MiB. Public-read means anyone with the QR URL can view the image; it must not contain sensitive information.

The parent-facing component is displayed in Parent Financial Overview for the currently selected linked child. It is display-only and does not create payment records or change dues. Parent UPI submission/UTR verification is covered by P1.4; ledger posting remains P1.5. Razorpay remains future work. See `docs/ACADEMY_UPI_SETTINGS.md`.

## 11. Parent Portal architecture

Current V1 scope is complete:
- Parent role, authentication, login and route protection
- Parent-to-player association and linked child/player summary
- Academy, center, batch and training details
- Attendance summary/history, pending dues, payment history and receipt workflow
- Parent-safe coach lookup/profile data for coaches assigned to linked players' current batches
- Parent-specific RLS validation, cross-parent isolation and end-to-end regression

Parent coach details are provided through dedicated RPCs that scope results to the current parent and linked players. No direct parent access to coach-management tables is granted.

## 12. Production principles

Before production, AcadPro must complete full module regression, negative authorization testing, parent/player isolation testing, authentication/session review, environment hardening, development-feature removal and production security review.
