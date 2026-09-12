# AcadPro Role Matrix

**Last Updated:** 12 September 2026  
**Status:** Current product authorization reference  
**Scope:** Super Admin, Academy Owner, Coach, Parent

Frontend visibility is not the security boundary; Supabase RLS must enforce these restrictions at the database layer.

## 1. Roles and scope

| Role | Scope |
|---|---|
| Super Admin | Entire platform |
| Academy Owner | Own academy |
| Coach | Assigned batches and players |
| Parent | Own account and linked player(s) |

## 2. Permission summary

| Resource | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| Academies | Full platform management | Own academy read access | No access | No access |
| Centers | Full CRUD | Own academy CRUD | Assigned-scope read access | No access |
| Batches | Full CRUD | Own academy CRUD | Assigned batches read-only | No access |
| Players | Full CRUD | Own academy CRUD | Assigned-player read/edit scope | Linked players read-only |
| Coaches | Full CRUD | Own academy CRUD | Self read access | No access |
| Coach assignments | Full CRUD | Own academy CRUD | Own assignments read-only | No access |
| Attendance | Manage/edit/delete; cannot mark | Own academy management | Mark assigned batches; edit within 7 days; no delete | Linked-player read-only |
| Subscription plans | Full CRUD | Own academy CRUD | Read-only where exposed | No access |
| Player subscriptions | Full CRUD | Own academy CRUD | Assigned-scope read-only | Linked-player read-only |
| Payment dues | Full access according to current payment policies | Own academy management | Assigned-player read-only | Linked-player read-only |
| Payments | Full access | Own academy collection and history | Assigned-player read-only | Linked-player history and own receipts |
| Receipts | View/print | View/print own academy receipts | No access | View/print linked-player receipts |

## 3. Global security rules

### Super Admin

- Has platform-wide access.
- Can manage all permitted records across academies.
- Can manage, edit and delete attendance, but must not mark attendance.

### Academy Owner

- Is restricted to the own academy.
- Can manage academy operational and financial records within that academy.
- Must not read or mutate another academy's records.
- Center and player-batch mutation policies explicitly require academy-owner scope or super-admin access.

### Coach

- Is restricted to assigned batches and their players.
- Can mark attendance for assigned batches.
- Can edit attendance within the defined seven-day rule.
- Cannot delete attendance, manage academy configuration, collect payments or generate dues.

### Parent

- Is restricted to the authenticated parent account and linked player(s).
- Is read-only.
- Cannot modify academy, player, attendance, subscription, due or payment records.
- Parent access is player-scoped through `players.parent_id → parents.id`.

## 4. Authorization model

```text
Role Matrix
    ↓
Frontend permissions and routes
    ↓
Centralized data scope
    ↓
Supabase RLS
    ↓
PostgreSQL
```

## 5. Phase 5.1 validation status

- [x] 5.1.1 Role and academy access review
- [x] 5.1.2 Centers and player-batches mutation-policy hardening
- [x] 5.1.3 Cross-academy isolation tests
- [x] 5.1.4 Coach assignment isolation validation
- [x] 5.1.5 Parent isolation foundation and validation
- [x] 5.1.6 Database policy and security-findings review

Validation covered Academy Owners, Coaches, Parents, Super Admin, cross-academy access, mutation attempts and direct ID/URL tampering.

## 6. Known documented limitations

- `inquiries` and `trial_attendance` are unused legacy tables and remain outside the active authorization scope; their RLS-disabled status is documented for future production review.
- Supabase leaked-password protection is unavailable on the current Free plan and is deferred until a plan upgrade is justified.
- Supabase performance-advisor findings are tracked separately from authorization completion.
