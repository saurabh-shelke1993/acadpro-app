# AcadPro Architecture

---

## Roles

- super_admin
- academy_owner
- coach
- parent

---

## Current Modules

- Authentication
- RBAC
- Academies
- Centers
- Batches
- Players
- Coaches
- Coach Batch Mapping
- Attendance
- Attendance History
- Subscription Plans
- Player Subscriptions
- Payment Dues
- Payment Collections
- Parent Portal

---

## Authentication & RBAC

AcadPro uses Supabase Authentication for user authentication and a
public.users table for application-level user and role information.

### Supported Roles

| Role | Scope |
|---|---|
| Super Admin | Entire system |
| Academy Owner | Own academy |
| Coach | Assigned batches |
| Parent | Own parent account and linked player(s) |

Role detection is centralized through the authentication and utility layer.

Dashboard routing is role-aware:

- Super Admin → `/dashboard`
- Academy Owner → `/dashboard`
- Coach → `/coach-dashboard`
- Parent → `/parent-portal`

---

## Multi-Tenant Architecture

AcadPro follows academy-level multi-tenant data isolation.

### Tenant Hierarchy

Academy
↓
Center
↓
Batch
↓
Player
↓
Parent

A player belongs to an academy and may be associated with a center,
batch and parent.

Parents are linked to players through:

- `players.parent_id`
- `parents.id`

The parent portal must only expose data belonging to the authenticated
parent and their linked player(s).

---

## Current Modules

### Attendance Module

✓ CRUD  
✓ History  
✓ Edit  
✓ Soft Delete  
✓ Duplicate Prevention  
✓ Role Security  
✓ Service Layer

### Payment Dues

✓ Due Generation  
✓ Remaining Amount Calculation  
✓ Partial Payment Support  
✓ Full Payment Support

### Payment Collections

✓ Payment History  
✓ Receipt Generation  
✓ Printable Receipts  
✓ Sequential Receipt Numbers  
✓ Multi-level Filters

### Parent Portal

✓ Parent Role  
✓ Parent Authentication  
✓ Parent Route Protection  
✓ Parent Dashboard Route  
✓ Parent-to-Player Relationship  
✓ Basic Parent Portal Page

---

## Folder Structure

src/
│
├── components/
├── pages/
├── routes/
├── services/
│   ├── attendanceService.js
│   ├── paymentDueService.js
│   └── paymentCollectionService.js
│
└── utils/
    ├── auth.js
    ├── permissions.js
    ├── dataScope.js
    ├── constants.js
    └── messages.js

---

## Important Rules

### Super Admin

- Can see all academies
- Can filter by academy
- Can create academy
- Can see all system data
- Can manage system-level configuration
- Cannot be restricted to a single academy

### Academy Owner

- Can only see own academy data
- Can manage centers within own academy
- Can manage batches within own academy
- Can manage players within own academy
- Can manage academy-level financial data

### Coach

- Can only see assigned batches
- Can see players belonging to assigned batches
- Can mark attendance
- Can edit attendance according to the defined attendance editing rules
- Cannot access unrelated academy data

### Parent

- Can only access the authenticated parent account
- Can only see player(s) linked to that parent
- Cannot see other parents
- Cannot see unrelated players
- Cannot access academy administration
- Cannot access coach functionality
- Cannot modify academy/player master data
- Parent-facing financial and attendance data must be restricted to
  the linked player(s)

---

## Parent Portal Architecture

The Parent Portal is a role-specific application area.

### Route

`/parent-portal`

### Access

The route is protected using `ProtectedRoute` with:

`allowedRoles = ["parent"]`

### Parent Data Relationship

The expected relationship is:

users
↓
parents
↓
players

The authenticated user's ID is associated with the parent account.

The parent record is then used to identify the linked player(s).

Example:

```text
Authenticated User
        |
        v
public.users
        |
        | email / user relationship
        v
public.parents
        |
        | parent_id
        v
public.players