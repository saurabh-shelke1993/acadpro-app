import { supabase } from "../supabaseClient";
import {
  isSuperAdmin,
  isAcademyOwner,
  isCoach
} from "./roles";

// =============================================
// APPLY ACADEMY FILTER
// =============================================

export const applyAcademyFilter = (
  query,
  user
) => {

  if (isSuperAdmin(user)) {
    return query;
  }

  return query.eq(
    "academy_id",
    user.academy_id
  );
};

// =============================================
// GET ACCESSIBLE CENTERS
// =============================================

export const getAccessibleCenters = async (
  user
) => {

  // Super Admin

  if (isSuperAdmin(user)) {

    const { data, error } = await supabase
      .from("centers")
      .select("*")
      .eq("is_active", true);

    if (error) throw error;

    return data;
  }

  // Academy Owner

  if (isAcademyOwner(user)) {

    const { data, error } = await supabase
      .from("centers")
      .select("*")
      .eq("academy_id", user.academy_id)
      .eq("is_active", true);

    if (error) throw error;

    return data;
  }

  // Coach (implemented in next step)

  return [];
};