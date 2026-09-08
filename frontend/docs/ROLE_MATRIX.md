# AcadPro Role Matrix

**Last Updated:** 08 September 2026  
**Status:** Current product authorization reference  
**Scope:** Super Admin, Academy Owner, Coach, Parent

This document defines the intended role permissions and data boundaries for AcadPro. Frontend visibility is not the security boundary; Supabase RLS must enforce the same restrictions at the database layer.

---

## 1. Roles

| Role | Scope | Core Responsibility |
|---|---|---|
| Super Admin | Entire platform | Platform-wide administration |
| Academy Owner | Own academy | Academy-level operations and management |
| Coach | Assigned batches | Coaching operations and attendance |
| Parent | Own account + linked player(s) | Read-only access to their linked player data |

---

## 2. Permission Legend

- ✅ Full Access
- 👁 Read Only
- ➕ Create
- ✏ Edit
- 🗑 Soft Delete
- ❌ No Access

---

## 3. Dashboard

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| Access role-appropriate dashboard | ✅ | ✅ | ✅ | ✅ |
| View platform-wide analytics | ✅ | ❌ | ❌ | ❌ |
| View own academy analytics | ❌ | 👁 | ❌ | ❌ |
| View assigned-batch analytics | ❌ | ❌ | 👁 | ❌ |
| View linked-player analytics | ❌ | ❌ | ❌ | 👁 |

Analytics must use the centralized data-scope model.

---

## 4. Academies

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View | ✅ | 👁 Own Academy | ❌ | ❌ |
| Create | ✅ | ❌ | ❌ | ❌ |
| Edit | ✅ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ |

---

## 5. Centers

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View | ✅ | 👁 Own Academy | 👁 Assigned Scope | ❌ |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

---

## 6. Batches

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View | ✅ | 👁 Own Academy | 👁 Assigned | ❌ |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

Academy Owner batch creation has been manually verified, including TCFC Academy Owner access.

---

## 7. Players

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View | ✅ | 👁 Own Academy | 👁 Assigned Batches | 👁 Own Linked Player(s) |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ✅ Assigned Players | ❌ |
| Soft Delete | ✅ | ✅ | ❌ | ❌ |

---

## 8. Coaches

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View | ✅ | 👁 Own Academy | 👁 Self | ❌ |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

---

## 9. Coach Batch Mapping

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View | ✅ | 👁 Own Academy | 👁 Own Assignments | ❌ |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

---

## 10. Attendance

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View | ✅ | 👁 Own Academy | 👁 Assigned Batches | 👁 Own Linked Player(s) |
| Mark Attendance | ❌ | ✅ | ✅ Assigned Batches | ❌ |
| Edit Attendance | ✅ | ✅ | ✅ Assigned Batches, within 7 days | ❌ |
| Soft Delete | ✅ | ✅ | ❌ | ❌ |

**Important rule:** Super Admin can manage/edit/delete attendance but must not mark attendance. Coach attendance editing remains subject to the 7-day rule.

---

## 11. Attendance History

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View | ✅ | 👁 Own Academy | 👁 Assigned Batches | 👁 Own Linked Player(s) |
| Edit | ✅ | ✅ | ✅ Assigned Batches, within 7 days | ❌ |
| Soft Delete | ✅ | ✅ | ❌ | ❌ |

---

## 12. Subscription Plans

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| CRUD | ✅ | ✅ | 👁 | ❌ |

---

## 13. Player Subscriptions

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View | ✅ | 👁 Own Academy | 👁 Assigned Scope | 👁 Own Linked Player(s) |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

---

## 14. Payment Dues

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View | ✅ | 👁 Own Academy | 👁 Assigned Players | 👁 Own Linked Player(s) |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ❌ | ❌ | ❌ | ❌ |

---

## 15. Payment Collections

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View Payment History | ✅ | 👁 Own Academy | 👁 Assigned Players | 👁 Own Linked Player(s) |
| Collect Payment | ✅ | ✅ | ❌ | ❌ |
| Partial Payment | ✅ | ✅ | ❌ | ❌ |
| Full Payment | ✅ | ✅ | ❌ | ❌ |
| Print Receipt | ✅ | ✅ | ❌ | 👁 Own Receipt |
| View Transaction Reference | ✅ | 👁 Own Academy | 👁 Assigned Players | 👁 Own Linked Player(s) |

---

## 16. Receipt Management

| Action | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| View Receipt | ✅ | 👁 Own Academy | ❌ | 👁 Own Receipt |
| Print Receipt | ✅ | ✅ | ❌ | 👁 Own Receipt |
| Download Receipt | 🔲 Planned | 🔲 Planned | ❌ | 🔲 Planned |

---

## 17. Reports

Reports are planned and will follow the same role/data-scope boundaries.

| Report | Super Admin | Academy Owner | Coach | Parent |
|---|---|---|---|---|
| Revenue Reports | ✅ | 👁 Own Academy | ❌ | ❌ |
| Attendance Reports | ✅ | 👁 Own Academy | 👁 Assigned | 👁 Own Linked Player(s) |
| Payment Reports | ✅ | 👁 Own Academy | ❌ | 👁 Own Linked Player(s) |

---

## 18. Global Security Rules

### Super Admin

- Full platform visibility.
- Can access all academies and permitted records.
- Can perform system-level administration.
- Can manage/edit/delete attendance.
- Must not mark attendance.

### Academy Owner

- Restricted to their own academy.
- Cannot access another academy's data.
- Can manage centers, batches, players, coaches, subscriptions and academy-level financial operations within scope.
- Academy ownership is a data-scope boundary, not merely a UI filter.

### Coach

- Restricted to assigned batches and the players belonging to those batches.
- Can mark attendance for assigned batches.
- Can edit attendance within the defined 7-day rule.
- Cannot delete attendance.
- Cannot modify academy configuration.
- Cannot collect payments.
- Cannot generate payment dues.

### Parent

- Restricted to the authenticated parent account and linked player(s).
- Read-only.
- Cannot modify academy, player, attendance, subscription, dues or payment records.
- Can view linked-player attendance, subscriptions, dues and payment history.
- Can access/print only receipts belonging to their linked player(s).
- Must not be able to access another parent's or player's data.

---

## 19. Parent Data Boundary

Expected relationship:

```text
auth.users
    ↓
public.users
    ↓
public.parents
    ↓
public.players
```

Player linkage uses `players.parent_id → parents.id`.

Parent access is **player-scoped**, not merely academy-scoped.

---

## 20. Authorization Enforcement Model

Authorization must be consistent across four layers:

```text
Role Definition
      ↓
Frontend Permissions / Routes
      ↓
Centralized Data Scope
      ↓
Supabase RLS
```

Frontend filtering alone is not considered sufficient authorization.

---

## 21. Current Validation Status

Manual application testing has been completed for the primary Super Admin, Academy Owner and Coach scenarios. Academy Owner batch creation, including the previously reported "Please fill all fields" issue, is now working.

Final security validation is still pending:

- [ ] Cross-academy isolation testing
- [ ] Coach assigned-batch isolation at database level
- [ ] Parent linked-player isolation at database level
- [ ] Parent attendance read policy validation
- [ ] Full SELECT/INSERT/UPDATE/DELETE policy review
- [ ] RLS review for all exposed tables
- [ ] Security Advisor findings resolved or explicitly documented
