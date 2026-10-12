# AcadPro Project Status

**Last Updated:** 12 October 2026  
**Current Version:** V1.0 Beta  
**Current Git Branch:** `payment-module-finalization`

## 1. Project Overview

AcadPro is a football academy management SaaS platform for India, built with React, JavaScript, React Router, Supabase Authentication, Supabase PostgreSQL, Git/GitHub and Vercel.

The platform uses academy-level multi-tenancy, centralized permissions/data scope and Supabase Row Level Security as the database authorization boundary.

## 2. Current Development Phase

### Phase 5 — Platform Hardening & Product Completion

**Phase 5.1 — Role Security and RLS Validation: COMPLETE**

Completed:
- Role and academy access review
- Centers and player-batches mutation-policy hardening
- Cross-academy isolation tests
- Coach assignment isolation validation
- Parent isolation foundation and validation
- Database policy and security-findings review

Manual validation covered Super Admin, Academy Owner, Coach and Parent scenarios, cross-academy access, mutation attempts and direct ID/URL tampering.

**Phase 5.2 — Player Module Hardening & Bulk Import: COMPLETE**

Completed:
- Transactional player create/update functions
- Server-side validation and role/academy scope enforcement
- Player/parent duplicate protection
- Player-batch invariant enforcement
- Deferred invariant validation and unique current mapping protection
- Reconciliation of active player-batch inconsistencies
- Cleanup of duplicate active parent records without deleting player rows
- Function EXECUTE privilege hardening
- Excel-based Bulk Player Import with parser, validator, template and preview workflow
- Super Admin-only import authorization
- Transactional bulk insert with parent reuse/create
- Bulk import rollback and duplicate rejection testing

Historical verification recorded:
- Browser player create/edit/batch-change regression passed
- Academy Owner cross-academy authorization tests passed
- Forced transaction rollback test passed
- Bulk Player Import success and rollback tests passed
- Jest: 5 suites passed, 34 tests passed
- Production build completed successfully

### Phase 7 — Security Advisor Remediation: IN PROGRESS

**Completed on 11 October 2026**
- Enabled RLS on `public.trial_attendance` and `public.inquiries`.
- Revoked direct `anon` and `authenticated` privileges on those tables; both were empty when inspected.
- Revoked direct client privileges on `public.payment_number_counters`, keeping it for server-side/database use.
- Verified RLS is enabled and client SELECT/INSERT is denied for all three tables.
- Reviewed the original seven flagged `SECURITY DEFINER` RPCs. All seven have an empty `search_path`; anonymous and PUBLIC execution are denied. P1.4 adds two intentionally authenticated `SECURITY DEFINER` RPCs (`submit_parent_upi_payment` and `review_parent_upi_payment`) with empty search paths, explicit role/scope checks, and anon/PUBLIC execution revoked. The Security Advisor snapshot on 12 October 2026 reports ten authenticated SECURITY DEFINER RPC warnings: seven pre-existing functions, the two P1.4 submission/review RPCs, and the P1.5 accepted-claim recording wrapper. These are reviewed findings; keep intentional grants only with role/scope tests and documented dependencies.
- Reviewed role, authentication, academy-scope and business-rule checks in the payment correction and parent coach RPCs.
- Confirmed frontend dependencies exist for the coach profile RPCs, parent coach RPCs and payment collection RPC. Do not revoke authenticated execution or change them to SECURITY INVOKER without regression testing.

**Remaining / deferred**
- Review and harden `update_my_coach_profile(...)`: confirm live role-resolution logic, add explicit authentication/coach-role and input validation as appropriate, preserve the current RPC contract, and regression-test.
- Review/test the seven authenticated `SECURITY DEFINER` functions and their frontend call sites. The Advisor warning may remain when authenticated execution is intentional.
- Re-run Security Advisor after further changes.
- Leaked-password protection is unavailable on the current Supabase Free plan; accepted as a documented plan limitation and deferred until a plan upgrade is justified.
- At the pre-Enquiries Phase 7 snapshot, the three RLS-enabled/no-policy INFO findings (`inquiries`, `trial_attendance`, `payment_number_counters`) were intentional deny-by-default configurations. Enquiries R2 has since added the scoped `inquiries` SELECT policy; the remaining no-policy INFO findings are `trial_attendance` and `payment_number_counters`.

Detailed record: `docs/PHASE_7_SECURITY_ADVISOR_REMEDIATION.md`.

### P1.4 — Parent UPI Payment Submission and Verification: IMPLEMENTED; VALIDATION PENDING

Implemented on 12 October 2026:
- Parent Financial Overview form for submitting a UPI claim against a linked child's outstanding due.
- Claim captures amount, UPI transaction reference/UTR, payment date and optional note.
- Academy Owner review queue with accept/reject decisions and rejection reason.
- Super Admin read-only queue access; Coach and anonymous access denied.
- New `parent_payment_submissions` table, RLS, role/academy-scoped RPCs, unique UTR and one-active-claim-per-due constraints.
- Acceptance revalidates the current remaining due. Submission/review do not change the payment ledger or issue receipts.

Automated validation passed on 12 October 2026: **13 Jest suites / 86 tests passed** and the production build compiled successfully. Run: https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/38196597158

Live Supabase checks confirmed both migrations are recorded, RLS is enabled, authenticated clients have SELECT but no direct INSERT/UPDATE/DELETE, the two RPCs deny anon execution and use empty search paths, and the active-claim index is present. Security Advisor was run; the two new authenticated SECURITY DEFINER RPC warnings are intentional and documented.
- Complete browser acceptance from `docs/P1.4_PARENT_UPI_SUBMISSION_REVIEW.md`, including negative cross-parent/cross-academy tests and unchanged-ledger checks.
- P1.5 is implemented and applied: `record_accepted_parent_upi_submission(uuid)` invokes the existing secured `collect_payment` RPC in the same transaction, attaches the submitted UTR, records the payment ID/receipt metadata, updates the claim to `recorded`, and rejects duplicate posting. Browser acceptance remains pending.

### P1.3 — Parent Portal UPI QR and WhatsApp Sharing: AUTOMATED VALIDATION PASSED; BROWSER ACCEPTANCE PENDING

Implemented on 12 October 2026:
- Display enabled academy UPI details in Parent Portal for the selected linked child.
- Keep the existing Parent Financial Overview display.
- Add a user-initiated WhatsApp share link for academy name, payee, UPI ID and QR URL.
- Add component tests for enabled/disabled settings, QR-only configuration and share-message content.
- No schema, Storage, RLS or payment-ledger changes.

Still required:
- Automated validation passed: 11 Jest suites, 75 tests, and production build.
- Complete Parent Portal browser validation, including switching linked children and opening the WhatsApp share link.

### P1.2 — Academy UPI Settings: AUTOMATED VALIDATION PASSED; BROWSER ACCEPTANCE PENDING

Implemented on 12 October 2026:
- Academy-scoped `academy_payment_settings` table with RLS and least-privilege grants.
- Public-read QR bucket `academy-upi-qr`, owner-only object mutations scoped by academy UUID path.
- Owner configuration screen, Super Admin read-only view, and enabled settings in Parent Financial Overview.
- UPI/QR validation tests and documented browser acceptance checklist.
- Three new migrations recorded in the live ledger; historical migration drift was preserved.

Still required before marking complete:
- Automated Jest/build validation passed on the current feature branch.
- Complete browser acceptance across Academy Owner, Super Admin, Parent and negative cross-tenant scenarios.
- Re-run Supabase Security Advisor; distinguish new findings from existing intentional findings.

## 3. Module Status

| Module | Status | Current State |
|---|---|---|
| Authentication | Core complete | Supabase Auth and role-based login flows working; Forgot Password remains pending |
| RBAC | Validated | Role, academy and parent isolation validation completed |
| Academy Management | Complete | CRUD implemented |
| Center Management | Complete | CRUD implemented |
| Batch Management | Complete | CRUD implemented; Academy Owner creation verified |
| Coach Management | Core complete | Coach assignment implemented |
| Player Management | Hardened | CRUD, transactional writes and current player-batch integrity implemented |
| Bulk Player Import | Complete | Super Admin-only Excel import with validation and transactional rollback |
| Attendance | Core complete | Marking, editing, history, soft delete and role rules implemented |
| Subscription Plans | Complete | CRUD and role security implemented |
| Player Subscriptions | Complete | Assignment and management implemented |
| Payment Dues | Complete | Generation, status, remaining amount, editing and filtering implemented |
| Payment Collections | P3 COMPLETE | Atomic collection RPC, generated references, correction workflow, admin-only financial access, Coach denial and legacy reconciliation verified |
| Receipt Management | P2 COMPLETE | Database-generated unique receipt numbers, legacy receipt backfill and frontend receipt display/print integration implemented |
| Dashboard Analytics | Complete | Role-aware KPIs, attendance and collection analytics implemented |
| Parent Portal | Complete for current V1 scope | Linked child summary, batch details, coach details, attendance, dues, payment history, receipt workflow and parent isolation implemented |
| Player Performance | V1 complete | Assessment entry/report, role-aware mutation scope, historical tracking, parent read-only access and RLS/RBAC regression verified |
| Reports | Planned | Not started |
| Notifications | Planned | Not started |
| Academy UPI Settings | Automated validation passed; browser acceptance pending | Owner-managed UPI ID/QR, Super Admin read-only, parent linked-child display; payment submission and UTR verification deferred |
| Parent UPI QR / WhatsApp sharing | Automated validation passed; browser acceptance pending | Parent Portal and Financial Overview display; user-initiated WhatsApp share; no payment ledger changes |
| Parent UPI submission / owner review | Implemented; automated validation pending | Claim form, secure RPCs, owner verification queue; accepted claims do not alter ledger; P1.5 posting deferred |
| Online Payments / Razorpay | Planned | Production flow pending; no Razorpay code or credentials in P1.2 |

## 4. Current Priorities

1. Complete Enquiries R3 automated validation and browser acceptance, then proceed to R4 status/trial-date UI and R5 owner-only conversion as separate phases.
2. Use controlled fixtures or an isolated database branch for Enquiries write-path and cross-tenant negative tests; do not create fake enquiries in the active database.
3. Keep the P1.6 UPI release gate in `docs/P1.6_UPI_RELEASE_CHECKLIST.md` separate and blocked until its own browser/security/ledger checks pass.
4. Continue Phase 7 Security Advisor remediation only as a separately scoped task; leaked-password protection remains unavailable on the current plan.

## 5. Parent Portal Completion Status

Complete for the current V1 scope.

Verified features include:
- Parent authentication and protected routing
- Linked children and player summary
- Academy, center, batch, age group and training-time details
- Multiple active coaches per batch and parent-safe coach profile data
- Attendance summary and history
- Pending dues
- Payment history
- Receipt details and Print / Save PDF workflow
- Parent-specific RLS validation and cross-parent isolation
- Parent end-to-end browser regression

Parent-safe coach visibility uses dedicated RPCs that scope results to the authenticated parent and linked players.

## 6. Database and Security Status

RLS is enabled on the major role-sensitive tables, including academies, attendance, batches, centers, coach_batch_assignments, coach_batches, coaches, parents, payment_dues, payments, player_batches, player_subscriptions, players, subscription_plans and users.

Phase 7 table lockdown:
- `public.inquiries`: R2 access model is applied; authenticated SELECT is scoped by Super Admin / Academy Owner / authorized Coach policy, direct authenticated writes are denied, and mutations use validated RPCs. See `docs/ENQUIRIES_R2_DATABASE_SECURITY.md`.
- `public.trial_attendance`: RLS enabled; direct anon/authenticated privileges revoked; no policies by design until an access model is required.
- `public.payment_number_counters`: RLS enabled; direct client privileges revoked; intended for server-side/database use.
- Leaked-password protection: unavailable on Supabase Free; deferred.
- The latest documented Security Advisor snapshot reports 13 authenticated `SECURITY DEFINER` warnings: 10 pre-existing findings plus the three scoped Enquiries RPCs. Review each function's authorization/search path before changing grants or security mode. Two no-policy INFO findings remain for intentionally locked-down `trial_attendance` and `payment_number_counters`.

## 7. Technical Debt and Deferred Work

- Forgot Password flow
- Phase 7 security review and RPC regression
- Historical migration-source reconciliation (remote migration ledger and repository migration files differ; see `supabase/MIGRATION_RECONCILIATION.md`)
- Automated payment reminders
- Razorpay production integration
- Performance-advisor optimization
- Production QA and security hardening

## 8. Development Rules

```text
Inspect current state → Plan minimal change → Implement → Build/Test → Functional Test → RBAC/Data-Scope Test → Review diff/status → Document → Commit
```

- Frontend filtering must never be treated as the primary security boundary.
- Do not replay or edit the live migration ledger to make it match repository filenames. Historical migration reconciliation remains incomplete; see `supabase/MIGRATION_RECONCILIATION.md`.
- Never claim a build, test, deployment or browser verification unless it was actually run and observed.
- Preserve RPC signatures and existing workflows unless the implementation and regression tests are updated together.

## 9. Working Baseline and Handoff

**Branch:** `payment-module-finalization`  
**Latest focus:** P1.2/P1.3 are implemented; P1.4 submission/review migrations are applied and browser acceptance remains pending. P1.5 source code and migration are now committed: an Academy Owner can explicitly record an accepted claim through a new database wrapper around the existing secured `collect_payment` RPC, with payment/receipt/balance writes in one transaction and duplicate recording blocked. The P1.5 migration is applied to the live database (ledger version `20261012025707`) and verified. GitHub Actions passed Jest and production build on run https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/38197741398; browser/security acceptance is pending. Vercel previously reported preview deployment rate-limited for 24 hours on the current plan. Phase 7 RPC hardening remains deferred until the payment UX validation gate.

Useful documents:
- `docs/PHASE_7_SECURITY_ADVISOR_REMEDIATION.md` — current findings and remediation record
- `supabase/MIGRATION_RECONCILIATION.md` — migration history drift and safe reconciliation rules
- `frontend/docs/PROJECT_ARCHITECTURE.md` — architecture, roles and data scope

**Separate payment release gate:** P1.4/P1.5 browser and security acceptance remains pending, including exactly-once posting, receipt generation, balance updates, stale-balance rollback and role isolation. Vercel preview was previously rate-limited; do not claim browser acceptance until actually tested. Current development focus is Enquiries R3; see `docs/ENQUIRIES_R3_FRONTEND_IMPLEMENTATION.md`.


## P1.6 Scope Correction — 12 October 2026

The Expenses feature changes previously added under P1.6 were reverted because they are outside the parent UPI payment integration scope. P1.6 remains the payment integration regression, documentation and release gate; do not introduce new Expenses functionality as part of this phase. P1.4/P1.5 UPI code and payment ledger workflows were preserved. Browser acceptance remains pending.


## P1.6 UPI Release Gate — 12 October 2026

The approved P1.6 scope is regression testing, role/security verification, documentation and release readiness for P1.2–P1.5 UPI integration. No Expenses feature work belongs in this phase. See `docs/P1.6_UPI_RELEASE_CHECKLIST.md`. Automated CI and live schema/grant inspection have passed on the previously recorded head; browser acceptance and CI for the documentation head remain pending. Overall release is blocked until the browser/RBAC/ledger acceptance gates pass.


## AcadPro Enquiries V1 — R2 Database/Security Foundation (12 October 2026)

**R1 specification:** frozen in `docs/ENQUIRIES_MODULE_SPEC.md`.  
**R2:** applied and live-verified; frontend implementation has not started.

- Live migration: `20261012035934 / enquiries_r2_database_security`.
- Extended `public.inquiries`; added status/trial/conversion fields, constraints, indexes and audit fields.
- RLS-enabled, authenticated SELECT only; no direct authenticated INSERT/UPDATE/DELETE; anon denied.
- Added role/academy/center-scoped `create_inquiry`, `update_inquiry` and Academy Owner-only `record_inquiry_conversion` RPCs, each SECURITY DEFINER with an empty search path.
- Coach center access is derived from active coach-batch assignments, batches and centers. Read-only scope smoke test passed for allowed vs foreign-academy center.
- `public.trial_attendance` remains untouched and locked down. No live enquiry/player test records were created.
- Security Advisor now reports 13 authenticated SECURITY DEFINER warnings (10 previously reviewed plus the 3 new scoped enquiry RPCs). Two unrelated RLS-enabled/no-policy INFO findings remain for `trial_attendance` and `payment_number_counters`; leaked-password protection remains a plan limitation.
- Controlled transaction/authorization tests and browser acceptance are still pending; do not mark the feature release-ready.

Detailed record: `docs/ENQUIRIES_R2_DATABASE_SECURITY.md`. Next phase: **R3 — Enquiries service, list and quick-create UI**.


## AcadPro Enquiries V1 — R3 Frontend (13 October 2026)

- [x] Enquiry service reads through the R2 RLS policy and creates through the validated `create_inquiry` RPC.
- [x] Role-aware list: Super Admin read-only; Academy Owner and Coach can quick-capture within their R2-authorized scope.
- [x] Search, status/source/center filters, Super Admin academy filter, optional source/note, owner-optional center and coach-authorized center selection.
- [x] Advisory duplicate warning; no automatic merge or rejection.
- [x] Protected route, role-appropriate sidebar links, responsive styling, loading/error/empty/success states and validation tests added.
- [ ] Run Jest and production build on the latest head; confirm GitHub Actions status.
- [ ] Browser acceptance, including role visibility and read-only filter behavior. Do not create fake leads in the active Supabase project.

Detailed implementation and acceptance checklist: `docs/ENQUIRIES_R3_FRONTEND_IMPLEMENTATION.md`. R4 status/trial-date editing and R5 conversion remain out of scope for this implementation.


## AcadPro Enquiries V1 — R4 Status and Trial Tracking (13 October 2026)

- [x] Added inline status/trial-date editor to the Enquiries list for Academy Owner and Coach.
- [x] Status changes call the R2 `update_inquiry` RPC with the existing enquiry fields; no direct table writes or new migration.
- [x] Trial Scheduled requires a trial date in the UI and is also enforced by the database RPC/constraint.
- [x] Converted enquiries remain immutable in the UI; conversion is not exposed through ordinary status editing.
- [x] Reopening Lost is available to Academy Owner only; Coaches cannot reopen Lost enquiries.
- [x] Added validation tests for valid/invalid status and trial-date combinations.
- [ ] Run Jest and production build on the latest head; check GitHub Actions result.
- [ ] Browser acceptance: status changes, trial date required, Lost reopen role restriction, Converted read-only, and cross-center/academy access denied.
- [ ] Exercise write-path authorization using controlled fixtures or an isolated Supabase development branch; do not create fake records in the active project.

R4 code is implemented but is not verified/release-ready until automated and browser acceptance pass. R5 Academy Owner-only conversion remains separate.


## AcadPro Enquiries V1 — R5 Atomic Player Conversion (13 October 2026)

- [x] Added owner-only conversion action and enrollment dialog.
- [x] Uses the existing `record_inquiry_conversion` SECURITY DEFINER RPC; no direct browser Player/Parent writes and no separate non-atomic enquiry update.
- [x] Prefills the enquiry's player name, phone and DOB summary; collects parent name, gender, joining date, center and batch; parent email/address are optional.
- [x] Center is fixed when already assigned; otherwise owner selects an active center. Batch list is scoped to the selected center.
- [x] Added conversion validation unit tests.
- [x] Documented R5 design and acceptance checklist in `docs/ENQUIRIES_R5_ATOMIC_CONVERSION.md`.
- [ ] Run Jest, production build and check GitHub Actions on the latest R5 head.
- [ ] Browser acceptance for owner-only access, conversion success/retry, parent reuse, batch invariants and rollback using a genuine enrollment or controlled isolated fixtures.
- [ ] Do not convert the user's existing enquiry unless it is a genuine enrollment decision; do not create fake test Players in the active database.

R5 is implemented but not verified/release-ready until automated, CI and browser acceptance pass. R6 regression and release readiness remain.


## AcadPro Enquiries V1 — R6 Regression and Release Readiness (13 October 2026)

- [x] Added consolidated regression/release checklist at `docs/ENQUIRIES_R6_REGRESSION_RELEASE_CHECKLIST.md`.
- [x] Defined role matrix, existing application regression coverage, isolated transactional tests, browser acceptance, data-safety constraints and explicit release exit criteria.
- [ ] Run `npm test -- --watchAll=false` from `frontend` on the latest branch head and record exact results.
- [ ] Run `npm run build` from `frontend` on the latest branch head and record exact results.
- [ ] Confirm GitHub/Vercel status for the exact tested HEAD.
- [ ] Complete controlled authorization/transaction tests in an isolated Supabase development environment.
- [ ] Complete browser acceptance for Super Admin, Academy Owner, Coach, Parent/anonymous and existing player/payment/attendance/Parent Portal flows.
- [ ] Update this section with actual evidence and tested commit SHA before calling R6 PASS.

A Vercel success was observed for documentation commit `041a8c27e063abd32d853d2078c84bc69eaa922a`; this is not a substitute for checking the latest HEAD. No local Jest/build or browser/transaction test is claimed as passed. R6 remains **validation in progress**, not release-ready.
