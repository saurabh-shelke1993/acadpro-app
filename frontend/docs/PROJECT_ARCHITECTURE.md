# AcadPro Architecture

**Last Updated:** 21 September 2026  
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

Known documented limitations:

- `inquiries` and `trial_attendance` are unused legacy tables and remain outside the active authorization scope; RLS is intentionally unchanged for now.
- Leaked-password protection is unavailable on the current Supabase Free plan and is deferred until a plan upgrade is justified.
- Performance-advisor findings are tracked separately from authorization completion.

## 11. Parent Portal architecture

Current foundation:

- Parent role and authentication
- Parent login
- Parent route protection
- Parent-to-player association
- Basic Parent Portal page
- Parent-safe coach lookup for linked players' current batches; only coach ID/name are returned and no direct parent access is granted to coach-management tables.

Next implementation scope:

- Parent dashboard
- Linked children/player summary
- Attendance history
- Pending dues
- Payment history
- Receipt access/download
- Parent-specific RLS validation and end-to-end regression

## 12. Production principles

Before production, AcadPro must complete full module regression, negative authorization testing, parent/player isolation testing, authentication/session review, environment hardening, development-feature removal and production security review.
