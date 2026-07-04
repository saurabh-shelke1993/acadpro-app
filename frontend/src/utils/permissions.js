// src/utils/permissions.js

// ----------------------------------
// Role Constants
// ----------------------------------

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ACADEMY_OWNER: "academy_owner",
  COACH: "coach",
  PARENT: "parent",
};

// ----------------------------------
// Basic Role Checks
// ----------------------------------

export const isSuperAdmin = (user) =>
  user?.role === ROLES.SUPER_ADMIN;

export const isAcademyOwner = (user) =>
  user?.role === ROLES.ACADEMY_OWNER;

export const isCoach = (user) =>
  user?.role === ROLES.COACH;

export const isParent = (user) =>
  user?.role === ROLES.PARENT;

// ----------------------------------
// Combined Checks
// ----------------------------------

export const canManageAcademy = (user) =>
  isSuperAdmin(user) || isAcademyOwner(user);

export const canManageAttendance = (user) =>
  isSuperAdmin(user) ||
  isAcademyOwner(user) ||
  isCoach(user);

export const canDeleteAttendance = (user) =>
  isSuperAdmin(user) ||
  isAcademyOwner(user);

export const canEditAttendance = (user) =>
  isSuperAdmin(user) ||
  isAcademyOwner(user) ||
  isCoach(user);

export const canManagePayments = (user) =>
  isSuperAdmin(user) ||
  isAcademyOwner(user);

// ========================================
// PAYMENT PERMISSIONS
// ========================================

export const canGenerateDue = (user) =>
    isSuperAdmin(user) ||
    isAcademyOwner(user);

export const canEditDue = (user) =>
    isSuperAdmin(user) ||
    isAcademyOwner(user);

export const canDeleteDue = (user) =>
    isSuperAdmin(user) ||
    isAcademyOwner(user);

export const canCollectPayment = (user) =>
    isSuperAdmin(user) ||
    isAcademyOwner(user);
    

export const canManagePlayers = (user) =>
  isSuperAdmin(user) ||
  isAcademyOwner(user) ||
  isCoach(user);

// ----------------------------------
// Academy Access
// ----------------------------------

export const canAccessAcademy = (
  user,
  academyId
) => {
  if (isSuperAdmin(user)) return true;

  return user?.academy_id === academyId;
};

// ----------------------------------
// Batch Access
// ----------------------------------

export const canAccessBatch = (
  user,
  batchId,
  assignedBatchIds = []
) => {
  if (isSuperAdmin(user)) return true;

  if (isAcademyOwner(user)) return true;

  if (isCoach(user)) {
    return assignedBatchIds.includes(batchId);
  }

  return false;
};