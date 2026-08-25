export const ROLES = {

  SUPER_ADMIN: "super_admin",

  ACADEMY_OWNER: "academy_owner",

  COACH: "coach",

  PARENT: "parent",

};

// ========================================
// ROLE CHECKERS
// ========================================

export const isSuperAdmin = (user) => {

  return (
    user?.role === ROLES.SUPER_ADMIN
  );
};

export const isAcademyOwner = (user) => {

  return (
    user?.role ===
    ROLES.ACADEMY_OWNER
  );
};

export const isCoach = (user) => {

  return (
    user?.role === ROLES.COACH
  );
};

export const isParent = (user) => {

  return (
    user?.role === ROLES.PARENT
  );
};

// ========================================
// DASHBOARD ROUTING
// ========================================

export const getDashboardRoute = (user) => {

  if (isCoach(user)) {
    return "/coach-dashboard";
  }

  if (isParent(user)) {
    return "/parent-portal";
  }

  return "/dashboard";
};