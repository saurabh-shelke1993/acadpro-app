# AcadPro Project Status

**Last Updated:** 12 September 2026  
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

## 3. Module Status

| Module | Status | Current State |
|---|---|---|
| Authentication | Core complete | Supabase Auth and role-based login flows working; Forgot Password remains pending |
| RBAC | Validated | Phase 5.1 validation completed |
| Academy Management | Complete | CRUD implemented |
| Center Management | Complete | CRUD implemented |
| Batch Management | Complete | CRUD implemented; Academy Owner creation verified |
| Coach Management | Core complete | Coach assignment implemented |
| Player Management | Complete | CRUD and player/batch relationships implemented |
| Attendance | Core complete | Marking, editing, history, soft delete and role rules implemented |
| Subscription Plans | Complete | CRUD and role security implemented |
| Player Subscriptions | Complete | Assignment and management implemented |
| Payment Dues | Complete | Generation, status, remaining amount, editing and filtering implemented |
| Payment Collections | Core complete | Partial/full payments, validation, history and receipts implemented |
| Receipt Management | Core complete | Sequential receipt numbers, modal and printable receipts implemented |
| Dashboard Analytics | Complete | Role-aware KPIs, attendance and collection analytics implemented |
| Parent Portal | Foundation only | Authentication, route protection, parent-to-player mapping and basic page exist; feature work pending |
| Player Performance | Not started | High priority |
| Reports | Planned | Not started |
| Notifications | Planned | Not started |
| Online Payments / Razorpay | Planned | Production flow pending |

## 4. Current High-Priority Work

1. **Parent Portal completion**
2. **Player Performance**
3. **Payment Module regression**
4. **Automated payment reminders**
5. **Razorpay production flow**
6. Medium-priority UX, error/loading and responsive improvements

## 5. Parent Portal Next Scope

- Parent dashboard
- Linked children/player summary
- Attendance history
- Pending dues
- Payment history
- Receipt access and download
- Parent-specific RLS validation
- Parent end-to-end regression

## 6. Database and Security Status

RLS is enabled on the major role-sensitive tables, including academies, attendance, batches, centers, coach_batch_assignments, coach_batches, coaches, parents, payment_dues, payments, player_batches, player_subscriptions, players, subscription_plans and users.

Known documented exceptions:

- `inquiries` — unused legacy table; RLS remains disabled intentionally.
- `trial_attendance` — unused legacy table; RLS remains disabled intentionally.
- Leaked-password protection is unavailable on the current Supabase Free plan and is deferred until a plan upgrade is justified.
- Supabase performance-advisor findings are tracked separately from authorization completion.

## 7. Current Technical Debt

- Forgot Password flow
- Parent Portal feature completion
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
**Direction:** Parent Portal completion → Player Performance → Payment regression → Reminders → Razorpay → production QA.
