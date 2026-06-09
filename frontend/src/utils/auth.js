export const getLoggedInUser = () => {
  const user = localStorage.getItem("acadpro_user");

  if (!user) {
    return null;
  }

  return JSON.parse(user);
};

export const isSuperAdmin = () => {
  const user = getLoggedInUser();

  return user?.role === "super_admin";
};

export const isAcademyOwner = () => {
  const user = getLoggedInUser();

  return user?.role === "academy_owner";
};

export const getAcademyId = () => {
  const user = getLoggedInUser();

  return user?.academy_id || null;
};

export const logoutUser = () => {
  localStorage.removeItem("acadpro_user");
};