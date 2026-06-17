import { supabase }
from "../supabaseClient";

import {
  isSuperAdmin,
  isAcademyOwner,
  isCoach,
  isParent,
  getDashboardRoute
}
from "./roles";

// ============================================
// GET CURRENT AUTH USER
// ============================================

export const getAuthUser =
  async () => {

    try {

      const {
        data: { user },
        error
      } = await supabase.auth.getUser();

      console.log("AUTH USER:", user);

      if (error) {

        console.log(
          "AUTH ERROR:",
          error.message
        );

        return null;
      }

      return user;

    } catch (err) {

      console.log(
        "GET AUTH USER ERROR:",
        err.message
      );

      return null;
    }
  };

// ============================================
// GET CURRENT APP USER
// ============================================

export const getCurrentUser =
  async () => {

    try {

      // GET AUTH USER

      const authUser =
        await getAuthUser();

      console.log(
        "AUTH USER RESULT:",
        authUser
      );

      if (!authUser) {

        console.log(
          "NO AUTH USER FOUND"
        );

        return null;
      }

      // FETCH USER PROFILE

      const {
        data,
        error
      } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      console.log(
        "DB USER:",
        data
      );

      console.log(
        "DB ERROR:",
        error
      );

      if (error) {

        console.log(
          "DB QUERY ERROR:",
          error.message
        );

        return null;
      }

      return data;

    } catch (err) {

      console.log(
        "GET CURRENT USER ERROR:",
        err.message
      );

      return null;
    }
  };

// ============================================
// GET LOGGED IN USER
// ============================================

export const getLoggedInUser =
  async () => {

    return await getCurrentUser();
  };

// ============================================
// GET USER ROLE
// ============================================

export const getUserRole = (
  user
) => {

  return user?.role || null;
};

// ============================================
// GET ACADEMY ID
// ============================================

export const getAcademyId = (
  user
) => {

  if (isSuperAdmin(user)) {

    return null;
  }

  return (
    user?.academy_id || null
  );
};

// ============================================
// DASHBOARD ROUTE
// ============================================

export const getUserDashboard =
  (user) => {

    return getDashboardRoute(user);
  };

// ============================================
// ROLE HELPERS
// ============================================

export {
  isSuperAdmin,
  isAcademyOwner,
  isCoach,
  isParent
};

// ============================================
// CHECK AUTHENTICATED
// ============================================

export const isAuthenticated =
  async () => {

    const user =
      await getCurrentUser();

    return !!user;
  };

// ============================================
// LOGOUT USER
// ============================================

export const logoutUser =
  async () => {

    try {

      const { error } =
        await supabase.auth.signOut();

      if (error) {

        console.log(
          error.message
        );
      }

      localStorage.clear();

      window.location.href =
        "/login";

    } catch (err) {

      console.log(
        err.message
      );
    }
  };