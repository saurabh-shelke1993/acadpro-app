# AcadPro Architecture

**Last Updated:** 08 September 2026  
**Current Branch:** `payment-module-finalization`

---

# 1. Platform Overview

AcadPro is a football academy management SaaS platform designed for academy operations in India.

The architecture is based on:

- React frontend
- Supabase Authentication
- Supabase PostgreSQL
- React Router
- Centralized role/permission utilities
- Centralized data-scope utilities
- Supabase Row Level Security
- Git/GitHub
- Vercel

The system is multi-tenant at the academy level.

---

# 2. Roles

- `super_admin`
- `academy_owner`
- `coach`
- `parent`

### Scope model

| Role | Scope |
|---|---|
| Super Admin | Entire platform |
| Academy Owner | Own academy |
| Coach | Assigned batches / players |
| Parent | Own account + linked player(s) |

---

# 3. Multi-Tenant Data Hierarchy

```text
Academy
   ↓
Center
   ↓
Batch
   ↓
Player
   ↓
Parent
```

A player belongs to an academy and can be associated with a center, batch and parent.

Parent linkage:

```text
auth.users
   ↓
public.users
   ↓
public.parents
   ↓
public.players
```

The player relationship is represented by:

```text
players.parent_id → parents.id
```

Parent access is therefore **player-scoped**, not simply academy-scoped.

---

# 4. Authentication & RBAC Architecture

Supabase Authentication handles authentication.

Application-level user and role information is stored in `public.users`.

Role detection and permission checks are centralized through the authentication/utility layer.

### Role-aware routing

- Super Admin → `/dashboard`
- Academy Owner → `/dashboard`
- Coach → `/coach-dashboard`
- Parent → `/parent-portal`

Parent Portal is protected by:

```text
ProtectedRoute
allowedRoles = ["parent"]
```

---

# 5. Authorization Architecture

AcadPro uses layered authorization:

```text
                 Role Matrix
                     ↓
             Frontend Permissions
                     ↓
               Route Guards
                     ↓
             Data-Scope Utilities
                     ↓
              Supabase RLS
                     ↓
                PostgreSQL
```

Each layer has a different responsibility:

### Role Matrix
Defines intended business authorization.

### Frontend Permissions
Controls permitted UI actions and navigation.

### Route Guards
Prevent unauthorized navigation.

### Data Scope
Limits application queries to the user's permitted academy, batches or linked players.

### Supabase RLS
Provides the database-level authorization boundary.

**Frontend filtering is never sufficient security by itself.**

---

# 6. Current Data-Scope Model

Dashboard and operational modules use centralized data-scope rules.

| Role | Data Scope |
|---|---|
| Super Admin | Entire platform |
| Academy Owner | Own academy |
| Coach | Assigned batches and their players |
| Parent | Own linked player(s) |

The scope must be preserved across:

- Dashboard analytics
- Players
- Attendance
- Subscriptions
- Payment dues
- Payment history
- Receipts
- Parent Portal

---

# 7. Current Modules

## Core

- Authentication
- RBAC
- Academy Management
- Center Management
- Batch Management
- Player Management
- Coach Management
- Coach Batch Mapping
- Attendance
- Attendance History

## Subscription

- Subscription Plans
- Player Subscriptions

## Financial

- Payment Dues
- Payment Collections
- Receipt Management

## Analytics

- Dashboard
- Dashboard Analytics

## Parent

- Parent Portal foundation

## Planned

- Player Performance
- Reports
- Notifications
- Razorpay / Online Payments
- Tournament Management

---

# 8. Attendance Architecture

Implemented capabilities:

- Attendance marking
- Attendance editing
- Attendance history
- Soft delete
- Duplicate prevention
- Role security
- Service layer
- Coach 7-day editing rule

Business authorization:

- Super Admin can manage/edit/delete attendance but must not mark attendance.
- Academy Owner can manage attendance for the own academy.
- Coach can mark attendance for assigned batches and edit within the defined 7-day rule.
- Parent can view attendance for linked player(s).

---

# 9. Payment Architecture

## Payment Dues

Implemented:

- Due generation
- Duplicate prevention
- Pending / Partial / Paid status
- Remaining amount calculation
- Due editing
- Multi-level filtering

## Payment Collections

Implemented:

- Full payment
- Partial payment
- Overpayment validation
- Payment history
- Transaction reference
- Automatic remaining amount
- Automatic status update

## Receipt Management

Implemented:

- Sequential receipt numbers
- Receipt modal
- Printable receipts
- Receipt management

Pending:

- Receipt download
- Email receipt delivery
- Online payment integration

---

# 10. Dashboard & Analytics Architecture

Dashboard analytics are role-aware.

### KPI / analytics areas

- Total Players
- Total Centers
- Total Batches
- Total Academies
- Attendance summary
- Attendance trend
- Attendance percentage
- Collections summary
- Collections trend
- Financial KPIs
- Empty states
- Tooltips
- Chart data labels

The dashboard must consume centralized data-scope rules and must not bypass authorization.

---

# 11. Parent Portal Architecture

### Route

`/parent-portal`

### Current implementation

- Parent role
- Parent authentication
- Parent login
- Parent route protection
- Parent → Player relationship
- Basic Parent Portal page

### Pending

- Parent Dashboard
- Attendance History
- Payment History
- Pending Dues
- Receipt access/download
- Final parent-specific RLS validation

### Parent security principle

A parent can only access data associated with the authenticated parent account and linked player(s).

The portal must never rely solely on a client-side `parent_id` or player filter for security; database policies must enforce the relationship.

---

# 12. Supabase / RLS Architecture

RLS is enabled on the major role-sensitive tables.

Current live database inspection shows RLS enabled for:

- academies
- attendance
- batches
- centers
- coach_batch_assignments
- coach_batches
- coaches
- parents
- payment_dues
- payments
- player_batches
- player_subscriptions
- players
- subscription_plans
- users

Current exceptions requiring review:

- `inquiries` — RLS disabled
- `trial_attendance` — RLS disabled

These tables must be reviewed before production.

The security review must also verify that RLS policies implement the same boundaries defined in `ROLE_MATRIX.md`, especially:

- Academy Owner → own academy
- Coach → assigned batches
- Parent → linked players
- Payment data → appropriate role/data scope
- Attendance → appropriate role/data scope

---

# 13. Folder Structure

```text
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── routes/
│   ├── services/
│   │   ├── attendanceService.js
│   │   ├── dashboardService.js
│   │   ├── paymentDueService.js
│   │   └── paymentCollectionService.js
│   └── utils/
│       ├── auth.js
│       ├── permissions.js
│       ├── dataScope.js
│       ├── roles.js
│       ├── constants.js
│       └── messages.js
│
├── docs/
│   ├── ROLE_MATRIX.md
│   ├── PROJECT_STATUS.md
│   ├── PROJECT_ARCHITECTURE.md
│   └── PRODUCT_BACKLOG.md
│
└── ...
```

Supabase migrations are maintained under the project Supabase directory.

---

# 14. Important Security Rules

## Super Admin

- Full platform visibility.
- Cross-academy access.
- System-level management.
- Can manage/edit/delete attendance.
- Must not mark attendance.

## Academy Owner

- Own academy only.
- Own centers, batches and players.
- Own academy financial records.
- No cross-academy access.

## Coach

- Assigned batches only.
- Assigned players only.
- Can mark attendance.
- Can edit attendance within 7 days.
- Cannot delete attendance.
- Cannot collect payments.
- Cannot generate dues.
- Cannot manage academy configuration.

## Parent

- Own parent account only.
- Own linked player(s) only.
- Read-only.
- No academy administration.
- No player master-data modification.
- No attendance modification.
- No payment modification.
- Own linked attendance/payment/dues/receipt information only.

---

# 15. Production Security Principles

Before production:

1. Validate RBAC.
2. Validate data scope.
3. Validate RLS.
4. Test negative authorization paths.
5. Test cross-academy isolation.
6. Test parent-to-player isolation.
7. Review Supabase Security Advisor.
8. Remove development-only access mechanisms.
9. Harden environment/deployment configuration.
10. Run full regression.

