import { supabase } from "../supabaseClient";

// =====================================================
// GET CURRENT LOGGED IN USER
// =====================================================

export const getCurrentUser = async () => {
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return null;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error) throw error;

    return data;
  } catch (err) {
    console.log(err.message);
    return null;
  }
};

// =====================================================
// GET LOGGED IN USER
// (alias for compatibility)
// =====================================================

export const getLoggedInUser = async () => {
  return await getCurrentUser();
};

// =====================================================
// CHECK SUPER ADMIN
// =====================================================

export const isSuperAdmin = (user) => {
  return user?.role === "super_admin";
};

// =====================================================
// GET ACADEMY ID
// =====================================================

export const getAcademyId = (user) => {
  return user?.academy_id || null;
};

export const logoutUser = async () => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    localStorage.clear();

    window.location.href = "/";
  } catch (err) {
    console.log(err.message);
  }
};