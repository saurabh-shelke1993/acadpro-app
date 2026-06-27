import { supabase } from "../supabaseClient";
import {
  isSuperAdmin,
  isAcademyOwner,
  isCoach
} from "./roles";

// =============================================
// APPLY ACADEMY FILTER
// =============================================

export const canEditAttendance = (user) =>
  isSuperAdmin(user) || isAcademyOwner(user);

export const canDeleteAttendance = (user) =>
  isSuperAdmin(user) || isAcademyOwner(user);

export const canGenerateDue = (user) =>
  isSuperAdmin(user) || isAcademyOwner(user);

export const canCollectPayment = (user) =>
  isSuperAdmin(user) || isAcademyOwner(user);

export const applyAcademyFilter = (
  query,
  user
) => {

  if (!user) return query;

  if (isSuperAdmin(user)) {
    return query;
  }

  return query.eq("academy_id", user.academy_id);
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

// Coach

if (isCoach(user)) {

  // Step 1 - Get Coach ID

  const { data: coachData, error: coachError } =
    await supabase
      .from("coaches")
      .select("id")
      .eq("user_id", user.id)
      .single();

  if (coachError) throw coachError;

  // Step 2 - Get Assigned Centers

  const { data, error } =
    await supabase
      .from("coach_batch_assignments")
      .select(`
        batches (
          centers (
            id,
            center_name,
            academy_id,
            is_active
          )
        )
      `)
      .eq("coach_id", coachData.id)
      .eq("is_active", true);

  if (error) throw error;

  // Step 3 - Remove Duplicate Centers

  const uniqueCenters = [];

  data.forEach(item => {

    const center = item.batches?.centers;

    if (
      center &&
      !uniqueCenters.find(c => c.id === center.id)
    ) {
      uniqueCenters.push(center);
    }

  });

  return uniqueCenters;
}
};

// =============================================
// GET ACCESSIBLE BATCHES
// =============================================

export const getAccessibleBatches = async (
  user,
  selectedCenter
) => {

  if (!selectedCenter) {
    return [];
  }
  if (!user) {
  return [];
}

  // ==========================
  // Super Admin
  // ==========================

  if (isSuperAdmin(user)) {

    const { data, error } = await supabase
      .from("batches")
      .select("*")
      .eq("center_id", selectedCenter)
      .eq("is_active", true)
      .order("batch_name");

    if (error) throw error;

    return data;
  }


  // ==========================
  // Academy Owner
  // ==========================

  if (isAcademyOwner(user)) {

    const { data, error } = await supabase
      .from("batches")
      .select("*")
      .eq("center_id", selectedCenter)
      .eq("academy_id", user.academy_id)
      .eq("is_active", true)
      .order("batch_name");

    if (error) throw error;

    return data;
  }

  // ==========================
  // Coach
  // ==========================

if (isCoach(user)) {

  const { data: coachData, error: coachError } =
    await supabase
      .from("coaches")
      .select("id")
      .eq("user_id", user.id)
      .single();

  if (coachError) throw coachError;

  const { data, error } = await supabase
    .from("coach_batch_assignments")
    .select(`
      batches (
        id,
        batch_name,
        center_id,
        academy_id,
        is_active
      )
    `)
    .eq("coach_id", coachData.id)
    .eq("is_active", true);

  if (error) throw error;

const accessibleBatches = data
  .map(item => item.batches)
  .filter(batch =>
    batch &&
    batch.center_id === selectedCenter &&
    batch.is_active
  )
  .sort((a, b) =>
    a.batch_name.localeCompare(b.batch_name)
  );

return accessibleBatches;
}

  return [];
};

// =============================================
// GET ACCESSIBLE ACADEMIES
// =============================================

export const getAccessibleAcademies = async (
  user
) => {

  if (!user) {
    return [];
  }

  // ==========================
  // SUPER ADMIN
  // ==========================

  if (isSuperAdmin(user)) {

    const { data, error } = await supabase
      .from("academies")
      .select("*")
      .eq("is_active", true)
      .order("academy_name");

    if (error) throw error;

    return data;
  }

  // ==========================
  // ACADEMY OWNER / COACH
  // ==========================

  const { data, error } = await supabase
    .from("academies")
    .select("*")
    .eq("id", user.academy_id)
    .eq("is_active", true);

  if (error) throw error;

  return data;
};

export const getAccessiblePlayers = async (
  batchId
) => {

  if (!batchId) {
    return [];
  }

  const { data, error } = await supabase
    .from("player_batches")
    .select(`
      player_id,
      players (
        id,
        full_name
      )
    `)
    .eq("batch_id", batchId);

  if (error) throw error;

  return data;
};