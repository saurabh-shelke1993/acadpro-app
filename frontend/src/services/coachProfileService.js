import { supabase } from "../supabaseClient";

const COACH_PROFILE_SELECT =
  "id, academy_id, full_name, email, phone, profile_image, is_active, " +
  "created_at, updated_at, experience_years, joining_date, salary, notes, " +
  "user_id, specialization, bio, " +
  "academies(academy_name), " +
  "coach_batch_assignments(" +
  "id, batch_id, is_active, created_at, " +
  "batches(id, batch_name, age_group, start_time, end_time, center_id, " +
  "centers(center_name)" +
  ")" +
  ")";

const CERTIFICATION_SELECT =
  "id, coach_id, certificate_name, issuing_organization, certificate_number, issue_date, expiry_date, created_at, updated_at";

const toOptionalText = (value) => {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
};

const toOptionalInteger = (value) => {
  if (value === "" || value === null || value === undefined) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Experience must be a non-negative whole number.");
  }

  return parsed;
};

const normalizeProfile = (coach) => {
  if (!coach) return null;

  return {
    ...coach,
    academy: coach.academies || null,
    assignments: (coach.coach_batch_assignments || [])
      .filter((assignment) => assignment?.is_active !== false)
      .map((assignment) => ({
        ...assignment,
        batch: assignment.batches || null,
        center: assignment.batches?.centers || null,
      })),
  };
};

const handleSupabaseError = (error, fallbackMessage) => {
  if (error) {
    console.error(fallbackMessage, error);
    throw new Error(error.message || fallbackMessage);
  }
};

export const getCoachProfile = async (coachId) => {
  if (!coachId) {
    throw new Error("Coach ID is required.");
  }

  const { data, error } = await supabase
    .from("coaches")
    .select(COACH_PROFILE_SELECT)
    .eq("id", coachId)
    .maybeSingle();

  handleSupabaseError(error, "Failed to load coach profile.");

  if (!data) {
    throw new Error("Coach profile not found.");
  }

  return normalizeProfile(data);
};

export const updateCoachProfile = async (coachId, profile) => {
  if (!coachId) {
    throw new Error("Coach ID is required.");
  }

  const payload = {
    full_name: toOptionalText(profile?.full_name) || "",
    email: toOptionalText(profile?.email),
    phone: toOptionalText(profile?.phone),
    profile_image: toOptionalText(profile?.profile_image),
    specialization: toOptionalText(profile?.specialization),
    experience_years: toOptionalInteger(profile?.experience_years),
    joining_date: profile?.joining_date || null,
    bio: toOptionalText(profile?.bio),
  };

  if (!payload.full_name) {
    throw new Error("Coach name is required.");
  }

  const { data, error } = await supabase
    .from("coaches")
    .update(payload)
    .eq("id", coachId)
    .select(COACH_PROFILE_SELECT)
    .single();

  handleSupabaseError(error, "Failed to update coach profile.");

  return normalizeProfile(data);
};

export const getMyCoachProfile = async () => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  handleSupabaseError(authError, "Your session could not be verified.");

  if (!user) {
    throw new Error("Your session could not be verified. Please sign in again.");
  }

  const { data, error } = await supabase
    .from("coaches")
    .select(COACH_PROFILE_SELECT)
    .eq("user_id", user.id)
    .maybeSingle();

  handleSupabaseError(error, "Failed to load your coach profile.");

  if (!data) {
    throw new Error("No coach profile is linked to this login.");
  }

  return normalizeProfile(data);
};

export const updateMyCoachProfile = async (profile) => {
  const payload = {
    p_full_name: toOptionalText(profile?.full_name) || "",
    p_email: toOptionalText(profile?.email),
    p_phone: toOptionalText(profile?.phone),
    p_profile_image: toOptionalText(profile?.profile_image),
    p_specialization: toOptionalText(profile?.specialization),
    p_experience_years: toOptionalInteger(profile?.experience_years),
    p_joining_date: profile?.joining_date || null,
    p_bio: toOptionalText(profile?.bio),
  };

  if (!payload.p_full_name) {
    throw new Error("Coach name is required.");
  }

  const { data, error } = await supabase.rpc(
    "update_my_coach_profile",
    payload
  );

  handleSupabaseError(error, "Failed to update your coach profile.");

  return normalizeProfile(data);
};

export const getCoachCertifications = async (coachId) => {
  if (!coachId) {
    throw new Error("Coach ID is required.");
  }

  const { data, error } = await supabase
    .from("coach_certifications")
    .select(CERTIFICATION_SELECT)
    .eq("coach_id", coachId)
    .order("issue_date", { ascending: false, nullsFirst: false })
    .order("certificate_name", { ascending: true });

  handleSupabaseError(error, "Failed to load coach certifications.");

  return data || [];
};

export const createCoachCertification = async (certification) => {
  if (!certification?.coach_id) {
    throw new Error("Coach ID is required.");
  }

  const certificateName = String(
    certification.certificate_name ?? ""
  ).trim();

  if (!certificateName) {
    throw new Error("Certificate name is required.");
  }

  const payload = {
    coach_id: certification.coach_id,
    certificate_name: certificateName,
    issuing_organization: toOptionalText(certification.issuing_organization),
    certificate_number: toOptionalText(certification.certificate_number),
    issue_date: certification.issue_date || null,
    expiry_date: certification.expiry_date || null,
  };

  const { data, error } = await supabase
    .from("coach_certifications")
    .insert(payload)
    .select(CERTIFICATION_SELECT)
    .single();

  handleSupabaseError(error, "Failed to create certification.");

  return data;
};

export const updateCoachCertification = async (certificationId, certification) => {
  if (!certificationId) {
    throw new Error("Certification ID is required.");
  }

  const certificateName = String(
    certification?.certificate_name ?? ""
  ).trim();

  if (!certificateName) {
    throw new Error("Certificate name is required.");
  }

  const payload = {
    certificate_name: certificateName,
    issuing_organization: toOptionalText(certification.issuing_organization),
    certificate_number: toOptionalText(certification.certificate_number),
    issue_date: certification.issue_date || null,
    expiry_date: certification.expiry_date || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("coach_certifications")
    .update(payload)
    .eq("id", certificationId)
    .select(CERTIFICATION_SELECT)
    .single();

  handleSupabaseError(error, "Failed to update certification.");

  return data;
};

export const deleteCoachCertification = async (certificationId) => {
  if (!certificationId) {
    throw new Error("Certification ID is required.");
  }

  const { error } = await supabase
    .from("coach_certifications")
    .delete()
    .eq("id", certificationId);

  handleSupabaseError(error, "Failed to delete certification.");

  return true;
};

export const getParentCoachProfiles = async () => {
  const { data, error } = await supabase.rpc("get_parent_coach_profiles");

  handleSupabaseError(error, "Failed to load coach profiles.");

  return (data || []).map((record) => ({
    id: record.coach_id,
    batch_id: record.batch_id,
    full_name: record.coach_name,
    profile_image: record.profile_image,
    specialization: record.specialization,
    experience_years: record.experience_years,
    bio: record.bio,
  }));
};
