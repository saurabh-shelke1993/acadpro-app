# AcadPro Project Status

**Last Updated:** 25 September 2026  
**Current Version:** V1.0 Beta  
**Current Git Branch:** `payment-module-finalization`

## 1. Project Overview

AcadPro is a football academy management SaaS platform for India, built with React, JavaScript, React Router, Supabase Authentication, Supabase PostgreSQL, Git/GitHub and Vercel.

The platform uses academy-level multi-tenancy, centralized permissions/data scope and Supabase Row Level Security as the authorization boundary.

## 2. Current Development Phase

### Phase 5 — Platform Hardening & Product Completion

**Phase 5.1 — Role Security and RLS Validation: COMPLETE**

Completed:

- 5.1.1 Role and academy access review
- 5.1.2 Centers and player-batches mutation-policy hardening
- 5.1.3 Cross-academy isolation tests
- 5.1.4 Coach assignment isolation validation
- 5.1.5 Parent isolation foundation and validation
- 5.1.6 Database policy and security-findings review

Manual validation covered Super Admin, Academy Owner, Coach and Parent scenarios, cross-academy access, mutation attempts and direct ID/URL tampering.

### Phase 5.2 — Player Module Hardening & Bulk Import: COMPLETE

Completed:

- Transactional player create/update functions
- Server-side validation and role/academy scope enforcement
- Player/parent duplicate protection
- Player-batch invariant enforcement
- Deferred invariant validation and unique current mapping protection
- Reconciliation of active player-batch inconsistencies
- Cleanup of duplicate active parent records without deleting player rows
- Function EXECUTE privilege hardening
- Excel-based Bulk Player Import
- Import parser, validator, template and preview workflow
- Super Admin-only import authorization
- Transactional bulk insert with parent reuse/create
- Bulk import rollback and duplicate rejection testing

Verification baseline:

- Browser player create/edit/batch-change regression passed
- Academy Owner cross-academy authorization tests passed
- Forced transaction rollback test passed
- Bulk Player Import success and rollback tests passed
- Jest: 5 suites passed, 34 tests passed
- Production build completed successfully

## 3. Module Status

| Module | Status | Current State |
|---|---|---|
| Authentication | Core complete | Supabase Auth and role-based login flows working; Forgot Password remains pending |
| RBAC | Validated | Phase 5.1 validation completed |
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
| Payment Collections | Core complete | Partial/full payments, validation, history and receipts implemented |
| Receipt Management | Core complete | Sequential receipt numbers, modal and printable receipts implemented |
| Dashboard Analytics | Complete | Role-aware KPIs, attendance and collection analytics implemented |
| Parent Portal | Complete for current V1 scope | Dashboard, linked child summary, batch details, multiple active coaches, attendance, dues, payment history, receipt print/PDF workflow, parent RLS isolation and E2E regression verified |
| Player Performance | Not started | High priority |
| Reports | Planned | Not started |
| Notifications | Planned | Not started |
| Online Payments / Razorpay | Planned | Production flow pending |

## 4. Current High-Priority Work

1. **Player Performance**
2. **Payment Module regression**
3. **Automated payment reminders**
4. **Razorpay production flow**
5. **Production QA and hardening**
6. Medium-priority UX, error/loading and responsive improvements

## 5. Parent Portal Completion Status

Complete for the current V1 scope.

Verified:

- Parent authentication and protected routing
- Linked children and player summary
- Academy, center, batch, age group and training-time details
- Multiple active coaches per batch
- Attendance summary and history
- Pending dues
- Payment history
- Receipt details and Print / Save PDF workflow
- Parent-specific RLS validation
- Cross-parent isolation
- Parent end-to-end browser regression

Parent-safe coach visibility uses a dedicated RPC rather than direct parent access to coach-management tables.

## 6. Database and Security Status

RLS is enabled on the major role-sensitive tables, including academies, attendance, batches, centers, coach_batch_assignments, coach_batches, coaches, parents, payment_dues, payments, player_batches, player_subscriptions, players, subscription_plans and users.

Known documented exceptions:

- `inquiries` — unused legacy table; RLS remains disabled intentionally.
- `trial_attendance` — unused legacy table; RLS remains disabled intentionally.
- Leaked-password protection is unavailable on the current Supabase Free plan and is deferred until a plan upgrade is justified.
- Supabase performance-advisor findings are tracked separately from authorization completion.

## 7. Current Technical Debt

- Forgot Password flow
- Player Performance
- Payment regression
- Automated reminders
- Razorpay production integration
- Performance-advisor optimization
- Production QA and security hardening

## 8. Development Rules

```text
Planning → Implementation → Build → Functional Test → RBAC Test → Data-Scope Test → Documentation → Git Commit
```

Frontend filtering must never be treated as the primary security boundary.

## 9. Working Baseline

**Branch:** `payment-module-finalization`  
**Recent verified commit:** `e3c51de`  
**Direction:** Parent Portal completion → Player Performance → Payment regression → Reminders → Razorpay → production QA.
