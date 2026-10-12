# AcadPro Product Backlog

**Last Updated:** 12 October 2026  
**Current Branch:** `payment-module-finalization`

Security and data isolation are prerequisites for production.

# ✅ Completed

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
- [ ] R4 — Build status and optional trial-date editing UI.
- [ ] R5 — Integrate Academy Owner conversion with existing player enrollment fields and transactional workflow.
- [ ] R6 — Run controlled transactional/RBAC regression, Jest, production build, CI and browser acceptance.

**Current state:** R2 database/security foundation and R3 frontend implementation are committed. R3 automated validation and browser acceptance remain pending. R4 status/trial-date editing and R5 owner-only atomic conversion are not implemented yet. Do not test conversion by creating ad-hoc records in the active database; use controlled fixtures or an isolated development branch.
