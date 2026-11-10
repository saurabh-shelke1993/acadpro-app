# AcadPro Product Backlog

**Last Updated:** 10 November 2026 (PS-L2.3B B2.6 historical SQL source triage)
**Current Branch:** `payment-module-finalization`

Security and data isolation are prerequisites for production.

# ✅ Completed

## Active blocker — PS-L2.3B B2.6 historical SQL source risk review (10 November 2026)

**Implemented/tested:** SELECT-only inspection of all 82 migration SQL bodies; 11 migrations with 20 direct top-level data-changing statements, 7 with procedural DO blocks. Offline risk inspection and CI **28 tests PASS** ([run 42748372167](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42748372167)). No production data or migration change.

**Pending:** Protected immutable historical SQL archive and manual source review, reconciliation of changed quoted literals in historical player data fixes, source of 11 private security helpers, and complete disposable-only Supabase replay. Subscription expiry, renewal and automatic payment-due generation are still **not deployed**.

## Active blocker — PS-L2.3B historical migration recovery (10 November 2026)

**Source tooling / tests:** Recovery inventory, content fingerprint parity, dependency analyzer and non-executable review gate implemented; [CI 42744787611](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42744787611) **PASS (21 tests)**.

**Outstanding, not completed:** Review full private historical SQL, reconcile six same-version SQL differences (two with changed player-specific quoted literals), verify 11 `private` helper origins, approve a disposable-only migration baseline and pass real Supabase Auth/RLS/finance replay. No renewal engine, subscription expiry automation or new payment-due generation deployed. No production database changes authorized.

## Authentication and Core Security Foundation

- Login system
- Supabase Authentication
- RBAC foundation
- Academy-level multi-tenancy
- Centralized permissions and data scope
- Protected role-aware routes

## Academy, Player and Coach Management

- Academy CRUD
- Center CRUD
- Batch CRUD
- Player CRUD
- Parent CRUD
- Player search
- Player-batch mapping
- Current player-batch integrity enforcement
- Transactional player create/update
- Soft delete
- Coach CRUD
- Coach-batch assignment
- Bulk Player Import for Super Admin

## Player Module Hardening and Bulk Import

### Player hardening

- Transactional player creation and update through secured PostgreSQL functions
- Server-side validation for academy, center, batch, parent, phone, email and gender
- Academy Owner scope enforcement and Super Admin authorization
- Advisory locking for player/parent-sensitive writes
- Duplicate player protection
- Current player-batch invariant:
  - Active player with a current batch must have exactly one matching `player_batches` row
  - Active player with no current batch must have zero `player_batches` rows
  - Inactive players are excluded from the active invariant
- Deferred database constraint validation for player/batch consistency
- Unique active mapping enforcement
- Reconciliation of previously inconsistent active player mappings
- Cleanup of duplicate active parent records without deleting player rows
- Transaction rollback regression validation
- PostgreSQL function EXECUTE privilege hardening for transactional player functions and invariant validation

### Bulk Player Import

- Excel template generation
- Dedicated import instructions sheet
- Worksheet selection
- Column aliases and normalization
- Excel date handling
- Phone normalization
- Source-row tracking for validation errors
- Row-level validation before database writes
- Academy, center and batch scope validation
- Parent reuse/create logic
- Duplicate player detection
- Super Admin-only import access
- Transactional bulk insertion
- Maximum 1000 rows per import request
- Advisory locking by academy/parent phone
- Atomic player + player-batch creation
- Transactional rollback when any row fails
- Import summary showing imported, created-parent and reused-parent counts

### Verification

- Browser regression for player create/edit/batch-change/RBAC scenarios
- Invalid center/batch rejection verified
- Duplicate player rejection verified
- Forced transaction rollback verified
- Academy Owner cross-academy create/edit restrictions verified
- Super Admin bulk import verified
- Bulk import rollback verified
- Jest: 34/34 tests passed
- Production build completed successfully

## Attendance and Subscriptions

- Attendance marking, editing and history
- Soft delete
- Duplicate prevention
- Seven-day coach editing rule
- Attendance role security
- Subscription plans
- Player subscriptions

## Payment and Receipt Modules

- Payment due generation and editing
- Duplicate due prevention
- Pending/partial/paid status
- Remaining amount calculation
- Partial/full payments
- Overpayment validation
- Payment history and transaction reference
- Automatic status updates
- Sequential receipt numbers
- Receipt modal and printable receipts

## Dashboard Analytics

- Role-aware KPI cards
- Attendance and collection analytics
- Trends, percentages, formatting, tooltips and labels
- Empty states
- Academy Owner, Coach and Super Admin data scope

## Parent Portal

- Parent role and authentication
- Parent route and RBAC protection
- Parent-to-player association
- Linked children/player summary
- Academy, center, batch, age group and training-time details
- Multiple active coach visibility
- Attendance summary and attendance history
- Pending dues and outstanding amount
- Payment history and transaction reference
- Receipt details
- Parent receipt Print / Save PDF workflow
- Parent-specific RLS isolation
- Parent-safe coach lookup RPC
- Cross-parent isolation validation
- Parent end-to-end regression

## Phase 5.1 — Role Security and RLS Validation

- [x] 5.1.1 Role and academy access review
- [x] 5.1.2 Centers and player-batches mutation-policy hardening
- [x] 5.1.3 Cross-academy isolation tests
- [x] 5.1.4 Coach assignment isolation validation
- [x] 5.1.5 Parent isolation foundation and validation
- [x] 5.1.6 Database policy and security-findings review

Validation covered role scenarios, cross-academy access, mutation attempts and direct ID/URL tampering.

## Player Performance V1 — COMPLETE

- [x] Player performance profile
- [x] Performance metrics
- [x] Player-level analytics
- [x] Historical performance tracking
- [x] Role-aware performance visibility
- [x] Functional requirements and V1 data model
- [x] Multiple same-day assessments supported
- [x] Inactive players/batches excluded from operational selection
- [x] Coach assessment ownership enforced in UI and database
- [x] Role-aware assessment management
- [x] Parent read-only performance visibility
- [x] Cross-academy RLS regression
- [x] Coach-to-coach mutation isolation
- [x] Parent mutation denial
- [x] Super Admin cross-academy management
- [x] Coach attribution verification

# 🔴 HIGH PRIORITY

## 1. Payment Module Regression

### P1 — Database Financial Foundation: COMPLETE

- [x] Immutable payment-event foundation
- [x] System-generated transaction references
- [x] System-generated receipt numbering with unique database enforcement
- [x] Legacy manual transaction references preserved as external references
- [x] Collector identity support via application user ID
- [x] Atomic payment collection database function
- [x] Payment overpayment guardrail
- [x] Coach assigned-player payment read scope
- [x] Payment correction request/approval/rejection workflow foundation
- [x] Direct payment INSERT/UPDATE/DELETE removed from authenticated RLS path
- [x] Legacy receipt numbers backfilled where missing
- [x] Reconcile 4 pre-existing overpaid dues

### P2 — Frontend Payment Collections Regression

- [x] Replace direct payment INSERT/UPDATE flow with collect_payment RPC
- [x] Remove manual transaction-reference input
- [x] Display generated transaction reference
- [x] Use stored receipt number for receipt modal/print
- [x] Correction request UI
- [x] Correction approval/rejection UI
- [x] Restrict payment collection and correction requests to Super Admin / Academy Owner
- [x] Remove Coach payment collection route and sidebar access
- [x] Remove Coach payment ledger/correction RLS access
- [x] Negative authorization testing for Coach payment access

### P2 verification: COMPLETE

### P3 — Legacy Payment Data Reconciliation: COMPLETE

- [x] Audited all four pre-existing overpaid dues
- [x] Confirmed the anomalies had no corresponding payment ledger rows
- [x] Normalized paid amount to total amount
- [x] Cleared negative remaining amounts through the database-generated value
- [x] Preserved the payment ledger without inventing historical payment events
- [x] Verified zero remaining overpaid dues
- [x] Verified zero negative remaining amounts

- [x] Payment dues and generation
- [x] Duplicate prevention
- [x] Due editing
- [x] Partial/full payments
- [x] Overpayment validation
- [x] Remaining amount and status transitions
- [x] Payment history
- [x] Receipt generation and numbering
- [x] Role restrictions
- [x] Academy/data-scope isolation
- [x] Negative authorization testing
- [x] Coach protected-route denial verified
- [x] Coach payment sidebar access removed
- [x] Production build passed after P2 role changes

## 2. Automated Payment Reminders

- [ ] Reminder eligibility rules
- [ ] Scheduling and due-date rules
- [ ] Parent recipient resolution
- [ ] Notification delivery abstraction
- [ ] Delivery/failure tracking
- [ ] Duplicate prevention
- [ ] Reminder history

## 3. Razorpay Production Flow

- [ ] Account/configuration
- [ ] Order creation and checkout
- [ ] Server-side verification
- [ ] Success/failure handling
- [ ] Webhooks
- [ ] Payment finalization
- [ ] Idempotency and duplicate protection
- [ ] Receipt generation
- [ ] Production credentials and testing

# 🟡 MEDIUM PRIORITY

## Dashboard Enhancements

- [ ] Additional operational actions
- [ ] UX polish
- [ ] Performance optimization
- [ ] Responsive refinement

## Notification Infrastructure

- [ ] Notification model
- [ ] Notification service abstraction
- [ ] Due and attendance notifications
- [ ] Email, WhatsApp and push planning

## Error, Loading and Responsive Quality

- [ ] Standard loading and empty states
- [ ] Consistent error and retry handling
- [ ] Form validation consistency
- [ ] Responsive navigation, tables, forms and dashboard
- [ ] Tablet/mobile usability review

# 🔵 BEFORE PRODUCTION

- [ ] Full module and role regression
- [ ] Negative authorization testing
- [ ] Parent/player isolation review
- [ ] Authentication and session review
- [ ] Environment and deployment hardening
- [ ] Supabase Security Advisor review
- [ ] Remove Dev Toolbar and development-only access
- [ ] Error monitoring and backup/recovery plan
- [ ] Documentation synchronization

# ⚪ FUTURE / LOWER PRIORITY

- Reporting and exports
- Audit logs and system settings
- PDF/email receipt enhancements
- Academy branding
- QR attendance and receipts
- Digital ID cards
- Coach performance dashboard
- Tournament management
- Match scheduling
- Ground booking
- Inventory management

# Product Vision — V1.0

AcadPro V1.0 aims to provide academy administration, center and batch management, player and coach management, attendance, subscriptions, payments, receipts, dashboard analytics and a secure Parent Portal. The immediate roadmap is Player Performance, payment reliability, automated reminders, Razorpay and production QA.


## P1.6 — UPI Payment Integration Release Gate (12 October 2026)

**Scope:** Regression testing, role/security verification, documentation and release readiness for P1.2–P1.5 only. No Expenses feature work is in scope.

- [x] Document the end-to-end release checklist in `docs/P1.6_UPI_RELEASE_CHECKLIST.md`.
- [x] Document P1.5 accepted-claim recording and current live schema/grant verification in `docs/P1.4_PARENT_UPI_SUBMISSION_REVIEW.md`.
- [x] Align project status and migration reconciliation notes with the approved scope correction.
- [x] Previously recorded CI after rollback passed: 13 Jest suites / 86 tests and production build (run 38199699967).
- [ ] Re-run CI for the current documentation head and confirm the result.
- [ ] Complete P1.2–P1.5 browser acceptance across Academy Owner, Super Admin, Parent, Coach and anonymous scenarios.
- [ ] Verify exactly-once payment recording, external UTR linkage, receipt generation, due balance/status updates and atomic rollback using controlled test fixtures.
- [ ] Re-run Security Advisor and compare against the documented baseline.
- [ ] Complete final diff/status review and mark release ready only after all required gates pass.

**Current release state: BLOCKED.** Browser acceptance and CI for the final documentation head are pending. See `docs/P1.6_UPI_RELEASE_CHECKLIST.md`.


## AcadPro Enquiries V1 — R1/R2 Progress (12 October 2026)

- [x] R1 — Freeze V1 specification in `docs/ENQUIRIES_MODULE_SPEC.md`.
- [x] R2 — Extend existing `public.inquiries` schema, add audit/conversion linkage, status/source constraints and indexes.
- [x] R2 — Add RLS-scoped read access, deny direct authenticated mutations, and add scoped create/update RPCs plus Academy Owner-only atomic conversion RPC.
- [x] R2 — Apply live migration `20261012035934 / enquiries_r2_database_security`; verify live schema, grants, policies, function search paths and coach center scope.
- [x] R3 — Enquiry service, role-aware list, quick-create form, search/filter, scoped center selection and duplicate warning implemented.
- [ ] R3 validation — Run Jest, production build, CI and browser acceptance; validate role/data scope with controlled fixtures.
- [x] R4 implementation — Add status and optional trial-date editor using the secured update RPC; Lost reopen is Academy Owner-only and Converted is immutable.
- [ ] R4 validation — Jest, production build, CI and browser/RBAC acceptance.
- [ ] R5 — Integrate Academy Owner conversion with existing player enrollment fields and transactional workflow.
- [ ] R6 — Run controlled transactional/RBAC regression, Jest, production build, CI and browser acceptance.

**Current state:** R2 database/security foundation and R3 frontend implementation are committed. R3 automated validation and browser acceptance remain pending. R4 status/trial-date editing is implemented but automated/browser validation remains pending; R5 owner-only atomic conversion is implemented; automated, CI and browser/transaction validation remains pending. Do not test conversion by creating ad-hoc records in the active database; use controlled fixtures or an isolated development branch.


## AcadPro Enquiries V1 — Current Development Checkpoint (13 October 2026)

**Implementation status:** R1–R5 implemented. **R6 release validation is deferred by the user so development can continue; do not mark the feature release-ready.**

- [x] R1 — Freeze Enquiries V1 specification.
- [x] R2 — Database/security foundation applied and live-verified; existing `public.inquiries` table reused.
- [x] R3 — Role-aware list, quick capture, filters and duplicate advisory.
- [x] R4 — Status/trial-date editor, trial date required for Trial Scheduled, Lost reopen Owner-only and Converted immutable.
- [x] R5 — Academy Owner-only atomic conversion through `record_inquiry_conversion`.
- [x] Automated frontend validation on code commit `fa87d7d79152a3807f7c86e070d4b3be9ec97b50`: 14 Jest suites / 101 tests passed; production build compiled successfully.
- [x] Vercel combined status for the tested code HEAD reported success; user confirmed latest Preview renders Enquiries and Parent UPI Payment Claims for Academy Owner.
- [x] Read-only live inquiry grants/RLS/RPC configuration reviewed; existing converted record's Player/Parent/player-batch linkage verified.
- [ ] Isolated transaction tests: success, idempotent retry, concurrency, rollback, parent reuse and no unintended financial/attendance side effects.
- [ ] Runtime authorization tests for Super Admin, Owner, Coach, Parent, anonymous and cross-academy/center tampering.
- [ ] Full Enquiries browser lifecycle and role acceptance.
- [ ] Existing Player, Attendance, subscriptions, payment/receipt, Parent Portal and UPI regression.
- [ ] Final diff/status and Production release review.

**Data safety:** live project has existing business records; do not create fake enquiries/players or run destructive/rollback/concurrency tests against it. No Supabase development branches were listed during the 13 October inspection. See `frontend/docs/ENQUIRIES_R6_REGRESSION_RELEASE_CHECKLIST.md` for the full gate and exact observed evidence.

### Next development task
The next product feature has not yet been selected after Enquiries implementation. Expenses was previously excluded from the P1.6 UPI release scope; that exclusion did not authorize adding Expenses to P1.6. If selected now, Expenses must be handled as its own feature/phase with separate scope and regression checks.


## Kheltriva Player Profile PP1–PP5 — Development checkpoint (4 November 2026)

- [x] **PP1–PP2 implementation** — Compact identity/action header; separate Player and Parent contact facts; consistent DOB/joining date labels.
- [x] **PP3 implementation** — Compact training schedule, explicitly overall attendance and existing three-month net-fee summary.
- [x] **PP4 implementation** — Authorized player Performance Report link, empty/error states and responsive layout.
- [x] **PP5 implementation** — Modal Escape, focus containment/restore, nested table-row keyboard safety, narrow-width/long-text improvements.
- [x] **PP5 test and CI source** — 8 new Player Profile component cases plus 5 existing presentation tests; focused GitHub Actions workflow authored.
- [ ] **PP5 runtime acceptance** — Confirm exact-HEAD Jest and production build, 320/375/430px, tablet and desktop UX, and Owner/Coach/Super Admin/Parent role/browser scenarios.
- [ ] **PP5 negative authorization** — Controlled cross-academy/assigned-batch/Parent direct-route tests; no live business-record mutations.
- [ ] **Player photo PH5 release checks** — Separate 25 authored photo tests still require execution and controlled replacement/Storage validation.

**Status:** PP1–PP5 source implementation complete, **NOT** production-accepted. Role-permission matrix and Supabase RLS are unchanged. Reference: `frontend/docs/PLAYER_PROFILE_PP5_REGRESSION_20261104.md` and repository-root `DEVELOPMENT_CONTINUITY.md`.


## Attendance merge AM1–AM7 — Single Attendance workspace (5 November 2026)

- [x] **AM1 — Unified navigation** — One Attendance sidebar entry for Owner, Coach and Super Admin; shared Mark Attendance / Attendance History cards over the current routes, with existing role selection preserved.
- [x] **AM1 — Test source / CI** — Selection-card and sidebar role/navigation regression cases authored, targeted GitHub Actions workflow configured.
- [ ] **AM1 — Runtime/visual acceptance** — Confirm latest-head Jest/build, desktop/tablet/phone, Owner/Coach/Super Admin/Parent navigation and both dashboard deep links.
- [x] **AM2 — Owner/Admin mark integration (source)** — Super Admin direct `/attendance` redirects to History; Owner-only creation and UTC future-date guard; existing Owner dashboard route and save preserved.
- [x] **AM3 — Coach mark integration (source)** — Assigned-session verification before roster query, older existing records read-only outside UTC seven-date policy, update zero-row detection; Coach deep links, insert/update kept.
- [x] **AM4 — Attendance History integration (source)** — Coach per-record Edit only within seven dates, older Read-only; Owner/Admin edit/delete, filters, soft-delete, pagination 5 preserved. Fail on zero-row RLS update.
- [x] **AM5 — Canonical routing (source)** — `/attendance?view=mark|history` selects existing Owner/Coach/History views by trusted role; legacy routes redirect with query/hash preserved; dashboard/sidebar links updated; integrated role/redirect Jest test source and AM1–AM5 CI authored. **Execution/browser acceptance pending.**
- [x] **AM6.1–AM6.5 — Mark Attendance UX (source)** — Owner academy context + 4-field compact filters, Owner/Coach 12-hour session labels, one shared live roster summary, accessible larger P/A, local-only Mark All/Reset, guarded Save/Update and responsive layout. **Tests authored; runtime/owner browser acceptance pending.**
- [x] **AM6.6 — Compact selection context (source + focused automated validation)** — Remove tall Owner/Coach Daily Operations and extra roster headings; Owner displays selected batch's active weekdays, Coach option/context shows batch, weekday, 12-hour time and center. Fixed Attendance/History and legacy Sidebar accessibility tests. **CI at `728652df`: 10 suites / 82 tests and React build passed. Browser/RBAC acceptance pending.**
- [x] **AM7.1–AM7.2 — History UX implemented + focused validated** — Compact Academy-aware filters/Reset, concise records heading, 12-hour session text, responsive full-detail row cards on tablets/phones, original five-row pagination and edit/soft-delete role rules. CI at `c5e9f9e` **PASS: 10 Jest suites, 86 tests, React build**. **Browser / RBAC / release acceptance pending**.
- [x] **AM7.3 — Server-side History filtering/pagination (source + focused CI)** — Exact filtered count; five records per request, stable date/id ordering; Owner/Coach academy and center/batch scope; Status/From/To server filters; debounced player-name search across all authorized records; stale request protection and last-page clamping. **98/98 focused tests and React build passed on `98cb6cb1`.** No migration/RPC/RLS changes. **AM7.3 live browser/negative-RLS/performance acceptance pending.**

- [x] **AM2–AM4 regression test source** — 22 newly authored cases (Owner/SA direct route, Coach session scope and read-only window, History permissions, service denial, UTC date boundaries); combined AM1–AM4 40 authored cases and CI/build workflow. **Execution pending**.
- [ ] **AM1–AM4 combined acceptance** — Exact-head Jest/build, controlled Owner/Coach/Super Admin/Parent browser tests, dashboard deep links, 320/375/768px responsive review and negative tenant/RLS checks.
- [ ] **Coach update transaction follow-up** — Original per-row Coach updates remain non-transactional; inspect partial-failure scenarios independently before proposing an RPC.
- [ ] **History load/performance monitoring (release follow-up)** — When datasets become materially larger, measure exact-count query latency and composite-index need with representative authorized workloads. AM7.3 server pagination is implemented; this is **not** a remaining AM7 feature.

- [x] **AM5 regression source / architecture** — Added `AttendanceWorkspace.test.js` for actual ProtectedRoute/redirect behavior, updated old selectors and links, extended scoped CI; architecture/status/continuity checkpoint updated.
- [ ] **AM1–AM5 release acceptance** — Confirm exact-HEAD Jest and build status; Owner/Coach/Admin/Parent navigation, old bookmarks, query/hash/deep links, browser history, 320–1440px responsive layout and live negative cross-academy/session RLS.
- [ ] **AM5 routing load/performance follow-up** — Canonical wrapper obtains the current database role again after `ProtectedRoute`; acceptable interim but can optimize only after comparing actual network behavior, without relaxing security.

- [x] **AM6 regression source** — Five pure time/tally tests plus three new Owner and three new Coach component cases; the AM1–AM6 CI workflow includes scoped Jest and React build.
- [ ] **AM6 owner combined acceptance** — Focused Jest/build **passed on `728652df`**; Owner/Coach live browser bulk marking, Reset restore/clear, Save gating, recorded read-only behavior, weekday/session labels, Center/Batch/Date/Session filters and 320–1440px layouts remain pending.
- [ ] **AM1–AM6 negative authorization/release gate** — Confirm SA history-only, Parent denial and Coach assigned-session / seven-date RLS in controlled browser plus exact SHA/deployment.

**Current status:** **AM1–AM7.3 development implementation COMPLETE with focused automated validation** (11/11 suites, 98/98 Jest tests, React build at `98cb6cb1`). AM7.1–AM7.2 **Owner visually accepted**. AM7.3 live role/tenant browser, load and deployment acceptance remain a separate, **open release QA gate**. Full-app Jest still fails 16/304 unrelated cases. No attendance schema/RLS migrations. See `frontend/docs/ATTENDANCE_AM7_HISTORY_UX_20261106.md`.

## Subscriptions unified workspace — SM1–SM6 (6 November 2026)

- [x] **SM1 — Existing implementations + active database inspection.** Verified current routes/sidebar, Plan CRUD/active status, Player assignment/edit/deactivate, five/seven pagination, plan/player FK, existing RLS, and management roles. No DB modifications.
- [x] **SM2 — Shared Subscriptions view selector.** Accessible Player Subscriptions (default) and Subscription Plans cards reuse the original components; view-card navigation prompts before discarding a modified/edited form. No business logic rewrite.
- [x] **SM3 — Single sidebar + canonical/legacy URLs.** One Finance **Subscriptions** link, `/subscriptions?view=players|plans`, protected old-path redirects preserving query/hash, only Owner/Super Admin.
- [x] **SM4 — Focused automated regression.** [GitHub CI 42153066796](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42153066796) at `da0cdb55`: **18/18 workspace and 24/24 sidebar tests PASS; React build PASS**. Full-app Jest has unrelated Coach Profile/Player Performance failures.
- [ ] **SM5 — Manual acceptance and release gate.** Owner and Super Admin test view switching, forms, plan CRUD, player assignment/update/deactivate, relevant old bookmarks, mobile 320–1440px, Coach/Parent denial, cross-academy scope, and current payment-linked subscription behavior on controlled data. **Not yet accepted**.
- [x] **SM6 — Source/design documentation checkpoint.** Updated `PROJECT_STATUS`, `PROJECT_ARCHITECTURE`, `PRODUCT_BACKLOG`, `DEVELOPMENT_CONTINUITY` and `SUBSCRIPTIONS_SM1_SM3_WORKSPACE_20261106.md`; source and CI commits already pushed. Confirm final documentation commit in GitHub.

**Scope boundary:** Navigation integration is implemented; no migrations, changes to Plan or Player Subscription writes, duplicate prevention hardening, UI redesign, or financial billing logic changes. Improve Player Subscriptions and Subscription Plans as **two separate** later phases only after SM5 acceptance.

## Player Subscriptions optimization — PS series (6 November 2026)

- [x] **PS1 — Compact Owner scope and assignment form (source + focused CI).** Read-only Owner academy context, dense Center/Batch filters, shortened redundant heading, unchanged Player/Plan/Start date controls and assignment preview, conditional Clear form and Cancel edit. List count now describes filtered *matching* rows. **Git SHA `92f28d8`: 45/45 targeted Jest tests + React production build PASS.** No subscription business logic or database changes.
- [ ] **PS1 manual acceptance.** Owner/Super Admin check academy context, field options, Clear form/Cancel edit, assignment/create/update/deactivate and 7-row paging, mobile 320/375/430/768px and desktop; use controlled records. No live negative-RLS path test completed by this change.
- [ ] **PS2 — Mobile subscription ledger details/actions.** Inspect positional column-hiding CSS and preserve clear access to Center/Batch, Player, Plan, Amount, Start/End, Status and Edit/Deactivate at small widths without horizontal overflow. Implement/test separately.
- [ ] **PS3 — Player Subscriptions data-loading/error/performance review.** Consider server-side filtering/pagination and active-duplicate integrity only after schema/RLS and payment-linked behavior contract review; no database migration approved.
- [ ] **Subscription Plans independent optimization.** Start after Player Subscriptions PS-series visual/functional acceptance; do not couple plan mutation rules to the navigation layout.

See `frontend/docs/PLAYER_SUBSCRIPTIONS_PS1_20261106.md`. Original SM1–SM3 combined Subscriptions navigation and legacy redirects are preserved.

## Player Subscription Lifecycle — PS-L0 to PS-L6 (6 November 2026)

- [x] **PS-L0A — Product lifecycle contract approved and documented:** 1/3/6/12-month date-only calendar cycles; Owner free extension; automatic future renewal and pending due; freeze/restore on pause; Paused badge in attendance; reconcile legacy data and do not retroactively bill. Read-only source/schema audit conducted. See `frontend/docs/PLAYER_SUBSCRIPTIONS_LIFECYCLE_CONTRACT_20261106.md`.
- [x] **PS-L0B — Read-only legacy reconciliation AUDIT complete:** 22 active agreements, 26 dues; four academy mismatches, four players with two active subscription rows, one inactive player, five subscriptions with no dues, ten Paid dues without directly linked payment rows. Pseudonymous per-record report `frontend/docs/PLAYER_SUBSCRIPTIONS_PS_L0B_RECONCILIATION_20261106.md`. No data, payment or migration writes.
- [ ] **PS-L0B Owner reconciliation acceptance:** 10 P0 integrity records, 1 P1 missing due, 11 P2 standard review. Confirm each agreement's correct plan, locked recurring price, paid-through date and prospective activation. **All 22 remain renewal-ineligible until approved.**
- [x] **PS-L1 — Pure calendar subscription calculator + unit tests implemented.** Month-end anniversary anchors, leap years, 1/3/6/12-month periods, free extension, verified-paid pause entitlement and resume rebasing. **86/86 new tests + 45/45 Subscriptions/Sidebar tests + React build PASS** in [CI 42163864483](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42163864483) at `387e1210`. **Not integrated to UI/DB.** No migrations or business writes. See `frontend/docs/PLAYER_SUBSCRIPTIONS_PS_L1_CALCULATOR_20261106.md`.
- [x] **PS-L1P0 — Alignment decision approved:** Both fixed-calendar-month and anniversary-based monthly billing configurable by academy, partial first fixed month eligible for proration.
- [x] **PS-L1P1 — Pure calculator and tests:** Explicit calendar-day/scheduled-session method, strict dates, eligible player enrollment, session exclusions and accurate paise rounding. **61/61 new + 86/86 PS-L1 + 45/45 previous = 192/192 targeted tests and React build PASS**, [run 42167075145](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42167075145), code SHA `00eb8d3`. No UI, academy setting or DB/payment writes. See `frontend/docs/PLAYER_SUBSCRIPTIONS_PS_L1P1_PRORATION_20261106.md`.
- [x] **PS-L1P2 — Read-only Player Subscriptions fee preview implemented and focused-tested:** Separate responsive `SubscriptionFeePreview`, explicit fixed/anniversary and session/day choices, scoped read-only active schedule mapping, same-academy check, clear estimate-only warning; no end date/discount/due/setting persistence. **10/10 new preview + 4/4 Player Subscriptions + 189/189 remaining targeted tests = 203/203 PASS; React build PASS** at `7e0ddb4` ([CI 42169267470](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42169267470)). See `frontend/docs/PLAYER_SUBSCRIPTIONS_PS_L1P2_PREVIEW_20261106.md`.
- [ ] **PS-L1P2 manual acceptance:** Owner/Super Admin sample fixed calendar/anniversary quotes, 7/13 session mapping, missing/failed enrollment, cross-academy mismatch, 320–1440px, confirm no payment/due/save change. **Not yet tested by Owner.**
- [ ] **PS-L1P3 / PS-L2 policy and schema design:** Decide academy's default proration method and holiday/cancellation handling; design future explicit saved alignment, immutable rate/period basis, authoritative RLS checks and idempotent due linkage. **No migration approved.**
- [x] **PS-L2.1 architecture REVIEW DONE (documentation only):** Live read-only schema, grants/RLS/FKs/RPC and UI dependencies inspected; proposed stable agreement, period price ledger, lifecycle audit, academy policy and due idempotency. Flagged cascade deletion, broad TRUNCATE grants, Coach subscription-policy mismatch and 3 current vs 4 historic academy mismatches. No migrations, code or records changed. See frontend/docs/PLAYER_SUBSCRIPTIONS_PS_L2_1_ARCHITECTURE_REVIEW_20261106.md.
- [x] **PS-L2.2 DETAILED DESIGN WRITTEN (not implemented/approved):** Versioned academy policy, agreement price/HOLD, period and immutable lifecycle event schemas, nullable one-due-per-period FK, exact paise/ratio, scope/RLS/GRANT matrix, secure atomic Create/Renew/Pause/Resume/Extend/Reprice RPC contract, manual Due collision, cascade/TRUNCATE hardening, rollback and isolated test matrix. **Docs only; no DDL, code, billing or tests.** See `frontend/docs/PLAYER_SUBSCRIPTIONS_PS_L2_2_SCHEMA_SECURITY_TRANSACTIONS_20261106.md`.
- [x] **PS-L2.2 Owner business architecture D1–D7 approved:** Exclusive non-overlapping regular tuition periods across agreements, separate camp add-on enrolments with pricing TBD, academy scheduled-session proration default/calendar-day alternative, approved cancellations, locked terms, zero-session defer/manual exception, Coach Paused roster-only, separately approved FK/grants hardening. **No migrations or financial implementation.** Decision: `frontend/docs/PLAYER_SUBSCRIPTIONS_PS_L2_2_OWNER_DECISIONS_20261106.md`.
- [x] **PS-L2.3 regular tuition schema CANDIDATE AUTHORING + SYNTHETIC DB TESTS:** `supabase/proposals/subscriptions/ps_l2_3_foundation.sql` (NOT under migrations), disposable Postgres fixture/assertions, [isolated CI run 42195789707](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42195789707) **PASS** at `5afae2a`. New policy/contract-HOLD/period/event/period-due structures, cross-agreement player/academy GiST exclusion, RLS and composite tenant/due/event guards. **Not applied to live Supabase; no renewal/due RPC or financial feature.** Report: `frontend/docs/PLAYER_SUBSCRIPTIONS_PS_L2_3_ISOLATED_CANDIDATE_20261106.md`.
- [ ] **PS-L2.3B — BLOCKED full local Supabase replay:** [CI run 42204705752](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42204705752) fails in historic financial migration due to untracked `private.is_payment_player_in_current_academy(uuid)` definition; earlier local runs exposed missing private schema and late parent.user_id. Perform **complete read-only baseline inventory and staged recovery**, then re-run actual local Supabase migration/RLS/payment tests. Do not mask with more incremental test stubs. See `frontend/docs/PLAYER_SUBSCRIPTIONS_PS_L2_3_LOCAL_REPLAY_GAP_20261106.md`.
- [ ] **PS-L2.3 production-readiness approval:** Actual isolated Supabase role/financial/RLS tests + concurrency/rollback, then Owner sign-off for live DDL; no current authorization to apply.
- [x] **Camp-pricing business decision APPROVED:** Academy Owner selects per camp: **free**, **included in regular tuition** or **separately chargeable**. No second recurring tuition agreement or automatic renewal.
- [ ] **Separate camp add-on implementation:** Future programme/calendar, enrolment, eligibility, per-camp amount/one-time charges, Parent/Coach permissions and tests; **not** in PS-L2.3 tuition candidate.

- [ ] **PS-L2.3 isolated unapplied migration/test candidate:** Source-controlled schema candidate, only after PS-L2.2 design approval; separate authorization required for any live DDL.
- [ ] **PS-L3 — Approved lifecycle management UI + controlled migration:** Extension, pause/resume, Coach attendance badge, Parent read-only state; role/tenant regression.
- [ ] **PS-L4 — Automatic renewal engine + due creation:** Atomic/idempotent, scheduled trigger disabled until dry-run and financial pricing policy signed off. No back-billing or payment collection.
- [ ] **PS-L5 — Prospective activation, end-to-end tenant/RLS/finance regression and scheduler rollout:** controlled first batch, monitored outcomes, rollback plans.
- [ ] **PS-L6 — Docs, Git, manual and production acceptance:** distinguish implemented, automated-tested, Owner accepted and release ready.

**Financial pricing decision APPROVED:** Original agreed recurring price is locked for existing subscribers until explicit Academy Owner-approved **prospective** repricing; current plan amount is not evidence of original agreement. The PS-L0B audit was SELECT-only and modified no business records. **Implementation of price snapshots and auto-renewals still pending.**
