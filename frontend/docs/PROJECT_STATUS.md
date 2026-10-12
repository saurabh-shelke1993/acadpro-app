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
- Reviewed the original seven flagged `SECURITY DEFINER` RPCs. All seven have an empty `search_path`; anonymous and PUBLIC execution are denied. P1.4 adds two intentionally authenticated `SECURITY DEFINER` RPCs (`submit_parent_upi_payment` and `review_parent_upi_payment`) with empty search paths, explicit role/scope checks, and anon/PUBLIC execution revoked. The Security Advisor now reports nine authenticated SECURITY DEFINER RPC warnings in total.
- Reviewed role, authentication, academy-scope and business-rule checks in the payment correction and parent coach RPCs.
- Confirmed frontend dependencies exist for the coach profile RPCs, parent coach RPCs and payment collection RPC. Do not revoke authenticated execution or change them to SECURITY INVOKER without regression testing.

**Remaining / deferred**
- Review and harden `update_my_coach_profile(...)`: confirm live role-resolution logic, add explicit authentication/coach-role and input validation as appropriate, preserve the current RPC contract, and regression-test.
- Review/test the seven authenticated `SECURITY DEFINER` functions and their frontend call sites. The Advisor warning may remain when authenticated execution is intentional.
- Re-run Security Advisor after further changes.
- Leaked-password protection is unavailable on the current Supabase Free plan; accepted as a documented plan limitation and deferred until a plan upgrade is justified.
- The three RLS-enabled/no-policy INFO findings (`inquiries`, `trial_attendance`, `payment_number_counters`) are intentional deny-by-default configurations. Define explicit policies before introducing a client-facing workflow for either unused table.

Detailed record: `docs/PHASE_7_SECURITY_ADVISOR_REMEDIATION.md`.

### P1.6 — Expenses and Monthly / Quarterly Financial Overview: IMPLEMENTED; VALIDATION PENDING

Implemented on 12 October 2026:
- Added current-month and current-quarter views comparing expected recurring costs with actual recorded expenses.
- Integrated existing payment ledger entries as income and calculated net cash movement (income collected minus recorded expenses); this is not presented as cash-in-hand.
- Expected totals are derived from active monthly/quarterly reminders; actual spend comes only from saved expense rows and includes one-off costs.
- Added **Record occurrence** for active recurring reminders. The owner confirms the actual paid amount and date; no expense is generated automatically.
- Added `record_expense_occurrence(...)`, which validates Academy Owner/academy scope, locks the reminder, inserts the linked expense and advances the next due date by one month or three months atomically.
- Direct client INSERT with a reminder link is blocked; existing expense rows cannot be linked/relinked during edit to bypass occurrence recording.
- Academy Owner manages their academy; Super Admin is read-only; other roles are denied.
- Live migration applied as ledger version `20261012031132 / expense_occurrence_recording`. Live checks confirmed RPC security configuration, INSERT policy and reminder-link guard trigger.
- Pure monthly/quarterly calculation tests added. Full CI and browser/RBAC acceptance are pending.

See `frontend/docs/P1.6_EXPENSE_FINANCIAL_OVERVIEW.md`.

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
- P1.5 ledger recording is implemented through the secured existing payment collection workflow; automated validation passed, browser/security acceptance remains pending.

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

1. Complete P1.2 browser role/isolation acceptance and P1.3 Parent Portal/WhatsApp browser validation.
2. Continue Phase 7 Security Advisor remediation, starting with `update_my_coach_profile(...)` review/hardening.
3. Complete focused regression tests for coach profile, parent coach visibility and payment RPCs after any database changes.
4. Keep leaked-password protection documented as deferred on Free plan.
5. Continue planned product work when selected: automated reminders, Razorpay production flow, production QA and other development priorities.

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
- `public.inquiries`: RLS enabled; direct anon/authenticated privileges revoked; no policies by design until an access model is required.
- `public.trial_attendance`: RLS enabled; direct anon/authenticated privileges revoked; no policies by design until an access model is required.
- `public.payment_number_counters`: RLS enabled; direct client privileges revoked; intended for server-side/database use.
- Leaked-password protection: unavailable on Supabase Free; deferred.
- Nine authenticated `SECURITY DEFINER` warnings were reported after P1.4: seven pre-existing RPCs plus the two P1.4 parent UPI submission/review RPCs. P1.6 adds the authenticated `record_expense_occurrence(...)` RPC with an empty search path and explicit Academy Owner/academy validation; rerun Security Advisor to refresh the current warning inventory. Do not change grants or security mode without reviewing dependencies and regression-testing.

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
**Latest focus:** P1.2–P1.5 source and migrations are implemented; P1.4/P1.5 browser acceptance remains pending. P1.5 ledger recording migration is live at version `20261012025707`. P1.6 Expenses overview and atomic manual recurring-occurrence recording are implemented; migration is live at version `20261012031132`. P1.6 CI and browser/RBAC acceptance are pending. Vercel previously reported preview deployment rate-limited for 24 hours on the current plan. Phase 7 RPC hardening remains deferred until the payment UX validation gate.

Useful documents:
- `docs/PHASE_7_SECURITY_ADVISOR_REMEDIATION.md` — current findings and remediation record
- `supabase/MIGRATION_RECONCILIATION.md` — migration history drift and safe reconciliation rules
- `frontend/docs/PROJECT_ARCHITECTURE.md` — architecture, roles and data scope

**Next development work:** Validate P1.6 monthly/quarterly calculations, manual occurrence recording, atomic due-date advancement, and role isolation. Then complete P1.4/P1.5 browser acceptance when a preview is available. Vercel preview remains rate-limited; do not claim browser acceptance until actually tested.
