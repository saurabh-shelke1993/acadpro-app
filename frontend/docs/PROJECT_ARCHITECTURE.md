# AcadPro Architecture

**Last Updated:** 12 September 2026  
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

## 5. Authorization layers

```text
Role Matrix → Frontend permissions → Route guards → Centralized data scope → Supabase RLS → PostgreSQL
```

Frontend filtering is not a security boundary. Database policies enforce role, academy, assignment and parent/player restrictions.

## 6. Data-scope model

- Super Admin: platform-wide permitted data
- Academy Owner: own academy
- Coach: assigned batches and their players
- Parent: linked player(s)

This scope applies to players, attendance, subscriptions, payment dues, payments, receipts, analytics and the Parent Portal.

## 7. Implemented modules

- Authentication and RBAC foundation
- Academy, center and batch management
- Player and coach management
- Coach-batch assignments
- Attendance and attendance history
- Subscription plans and player subscriptions
- Payment dues and payment collections
- Receipt management
- Dashboard analytics
- Parent Portal foundation

Planned modules include Parent Portal completion, Player Performance, Reports, Notifications and Razorpay/online payments.

## 8. Security and RLS status

Phase 5.1 security validation is complete:

- Role and academy access review
- Centers and player-batches mutation-policy hardening
- Cross-academy isolation testing
- Coach assignment isolation validation
- Parent isolation foundation and validation
- Database policy and Security Advisor findings review

RLS is enabled on the major role-sensitive tables, including `academies`, `attendance`, `batches`, `centers`, `coach_batch_assignments`, `coach_batches`, `coaches`, `parents`, `payment_dues`, `payments`, `player_batches`, `player_subscriptions`, `players`, `subscription_plans` and `users`.

Known documented limitations:

- `inquiries` and `trial_attendance` are unused legacy tables and remain outside the active authorization scope; RLS is intentionally unchanged for now.
- Leaked-password protection is unavailable on the current Supabase Free plan and is deferred until a plan upgrade is justified.
- Performance-advisor findings are tracked separately from authorization completion.

## 9. Parent Portal architecture

Current foundation:

- Parent role and authentication
- Parent login
- Parent route protection
- Parent-to-player association
- Basic Parent Portal page

Next implementation scope:

- Parent dashboard
- Linked children/player summary
- Attendance history
- Pending dues
- Payment history
- Receipt access/download
- Parent-specific RLS validation and end-to-end regression

## 10. Production principles

Before production, AcadPro must complete full module regression, negative authorization testing, parent/player isolation testing, authentication/session review, environment hardening, development-feature removal and production security review.
