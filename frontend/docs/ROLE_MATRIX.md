# AcadPro Role Matrix

## Roles

| Role | Description |
|-------|-------------|
| Super Admin | Full access to entire platform |
| Academy Owner | Full access within own academy |
| Coach | Limited access to assigned batches |
| Parent | Read-only access to own linked player(s) |

---

# Module Permissions

Legend

✅ Full Access
👁 Read Only
➕ Create
✏ Edit
🗑 Soft Delete
❌ No Access

---

## Dashboard

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ |

---

## Academies

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | ❌ | ❌ |
| Create | ✅ | ❌ | ❌ | ❌ |
| Edit | ✅ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ |

---

## Centers

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Assigned | ❌ |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

---

## Batches

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Assigned | ❌ |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

---

## Players

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Assigned Batches | 👁 Own Linked Player(s) |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ✅ Assigned Players | ❌ |
| Soft Delete | ✅ | ✅ | ❌ | ❌ |

---

## Coaches

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Self | ❌ |
| Create | ✅ | ✅ | ❌ | ❌ |❌
| Edit | ✅ | ✅ | ❌ | ❌ |❌
| Delete | ✅ | ✅ | ❌ | ❌ |❌

---

## Coach Batch Mapping

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Own | ❌ |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

---

## Attendance

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Assigned Batches | 👁 Own Child |
| Mark Attendance | ❌ | ✅ | ✅ Assigned Batches | ❌ |
| Edit Attendance | ✅ | ✅ | ✅ Assigned Batches | ❌ |
| Soft Delete | ✅ | ✅ | ❌ | ❌ |

---

## Attendance History

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Assigned Batches | 👁 Own Linked Player(s) |
| Edit | ✅ | ✅ | ✅ Edit Assigned Batches (Within 7 Days) | ❌ |
| Soft Delete | ✅ | ✅ | ❌ | ❌ |

---

## Subscription Plans

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| CRUD | ✅ | ✅ | 👁 | ❌ |

---

## Player Subscriptions

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Assigned | 👁 Own Linked Player(s) |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

---

## Payment Dues

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Assigned Players | 👁 Own Linked Player(s) |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ❌ | ❌ | ❌ | ❌ |

---

## Payment Collections

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Assigned Players | 👁 Own Linked Player(s) |
| Collect Payment | ✅ | ✅ | ❌ | ❌ |
| Partial Payment | ✅ | ✅ | ❌ | ❌ |
| Full Payment | ✅ | ✅ | ❌ | ❌ |
| Print Receipt | ✅ | ✅ | ❌ | 👁 Own Receipt |
| View Payment History |✅| 👁 Own Academy | 👁 Assigned Players| 👁 Own Linked Player(s) |

---
## Receipt Management

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View Receipt | ✅ | ✅ | ❌ | 👁 Own Receipt |
| Print Receipt | ✅ | ✅ | ❌ | 👁 Own Receipt |

## Reports (Future)

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| Revenue Reports | ✅ | 👁 Own Academy | ❌ | ❌ |
| Attendance Reports | ✅ | 👁 Own Academy | 👁 Assigned | 👁 Own Child |
| Payment Reports | ✅ | 👁 Own Academy | ❌ | 👁 Own Child |

## Dashboard Analytics

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|-------|--------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ |
| View Attendance Analytics | ✅ All | 👁 Own Academy | 👁 Assigned Batches | 👁 Own Linked Player(s) |
| View Collection Analytics | ✅ All | 👁 Own Academy | 👁 Assigned Players | 👁 Own Linked Player(s) |
| View Financial KPIs | ✅ All | 👁 Own Academy | 👁 Assigned Players | 👁 Own Linked Player(s) |
# Global Security Rules

## Super Admin

- Can access every academy.
- Can view all data.
- Can perform every CRUD operation.

## Academy Owner

- Can only access their academy.
- Cannot access other academies.
- Full CRUD within own academy.

## Coach

- Can only access assigned batches.
- Cannot view players outside assigned batches.
- Cannot modify academy configuration.
- Cannot delete records.
Can mark attendance only for assigned batches.
Can edit attendance only within 7 days.
Cannot delete attendance.
Cannot collect payments.
Cannot generate dues.

## Parent

- Can only view own child's information.
- No administrative permissions.
Read-only access.

Can view attendance.

Can view payment dues.

Can view payment history.

Can print receipts (future enhancement).