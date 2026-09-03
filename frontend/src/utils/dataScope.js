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
// GET COACH ASSIGNED BATCH IDS
// =============================================

export const getCoachAssignedBatchIds = async (
  user
) => {

  if (!isCoach(user) || !user?.id) {
    return [];
  }

  const { data: coach, error: coachError } =
    await supabase
      .from("coaches")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

  if (coachError) throw coachError;

  if (!coach) {
    return [];
  }

  const { data, error } = await supabase
    .from("coach_batch_assignments")
    .select("batch_id")
    .eq("coach_id", coach.id)
    .eq("is_active", true);

  if (error) throw error;

  return [...new Set(
    (data || [])
      .map((assignment) => assignment.batch_id)
      .filter(Boolean)
  )];
};

// =============================================
// GET DASHBOARD DATA SCOPE
// =============================================

export const getDashboardDataScope = async (
  user
) => {

  if (isSuperAdmin(user)) {
    return { type: "all" };
  }

  if (isAcademyOwner(user) && user?.academy_id) {
    return {
      type: "academy",
      academyId: user.academy_id
    };
  }

  if (isCoach(user)) {
    return {
      type: "batches",
      batchIds: await getCoachAssignedBatchIds(user)
    };
  }

  // Parent analytics are intentionally outside Dashboard Analytics V2 Phase 1.
  return { type: "none" };
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

// =============================================
// GET ACCESSIBLE BATCHES
// =============================================

export const getAccessibleBatches = async (
  user,
  selectedCenter = ""
) => {

  if (!user) {
    return [];
  }

  // ==========================
  // Super Admin
  // ==========================

  if (isSuperAdmin(user)) {

    let query = supabase
      .from("batches")
      .select("*")
      .eq("is_active", true);

    // Optional center filter
    if (selectedCenter) {
      query = query.eq(
        "center_id",
        selectedCenter
      );
    }

    const { data, error } = await query
      .order("batch_name");

    if (error) throw error;

    return data || [];
  }

  // ==========================
  // Academy Owner
  // ==========================

  if (isAcademyOwner(user)) {

    if (!user?.academy_id) {
      return [];
    }

    let query = supabase
      .from("batches")
      .select("*")
      .eq(
        "academy_id",
        user.academy_id
      )
      .eq("is_active", true);

    // Optional center filter
    if (selectedCenter) {
      query = query.eq(
        "center_id",
        selectedCenter
      );
    }

    const { data, error } = await query
      .order("batch_name");

    if (error) throw error;

    return data || [];
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
      age_group,
      start_time,
      end_time,
      is_active
    )
  `)
      .eq("coach_id", coachData.id)
      .eq("is_active", true);

    if (error) throw error;

    const accessibleBatches = (data || [])
      .map(item => item.batches)
      .filter(batch =>
        batch &&
        batch.is_active &&
        (
          !selectedCenter ||
          batch.center_id === selectedCenter
        )
      )
      .sort((a, b) =>
        a.batch_name.localeCompare(
          b.batch_name
        )
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
    players!inner(
      id,
      full_name,
      is_active
    )
  `)
  .eq("batch_id", batchId)
  .eq("players.is_active", true);

  if (error) throw error;

  return data;
};
