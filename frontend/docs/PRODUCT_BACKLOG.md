# AcadPro Product Backlog

**Last Updated:** 25 September 2026  
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
- [ ] Reconcile 4 pre-existing overpaid dues

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
