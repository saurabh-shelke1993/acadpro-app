# AcadPro Role Matrix

## Roles

| Role | Description |
|-------|-------------|
| Super Admin | Full access to entire platform |
| Academy Owner | Full access within own academy |
| Coach | Limited access to assigned batches |
| Parent | Read-only access to own child |

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
| View | ✅ | 👁 Own Academy | 👁 Assigned Batches | 👁 Own Child |
| Create | ✅ | ✅ | ✅ | ❌ |
| Edit | ✅ | ✅ | ✅ Assigned Players | ❌ |
| Soft Delete | ✅ | ✅ | ❌ | ❌ |

---

## Coaches

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Self | ❌ |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

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
| Mark Attendance | ✅ | ✅ | ✅ Assigned Batches | ❌ |
| Edit Attendance | ✅ | ✅ | ✅ Assigned Batches | ❌ |
| Soft Delete | ✅ | ✅ | ❌ | ❌ |

---

## Attendance History

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Assigned Batches | 👁 Own Child |
| Edit | ✅ | ✅ | ✅ Assigned Batches | ❌ |
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
| View | ✅ | 👁 Own Academy | 👁 Assigned | 👁 Own Child |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

---

## Payment Dues

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Assigned Players | 👁 Own Child |
| Create | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |

---

## Payment Collections

| Action | Super Admin | Academy Owner | Coach | Parent |
|---------|-------------|---------------|---------|---------|
| View | ✅ | 👁 Own Academy | 👁 Assigned Players | 👁 Own Child |
| Collect Payment | ✅ | ✅ | ❌ | ❌ |

---

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
- Can mark and edit attendance only for assigned batches.

## Parent

- Can only view own child's information.
- No administrative permissions.
- Read-only access.