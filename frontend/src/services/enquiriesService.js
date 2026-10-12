import { supabase } from "./supabase";

export const ENQUIRY_SOURCES = [
  "Facebook",
  "Instagram",
  "Phone Call",
  "Walk-in / On-premises",
  "Referral",
  "Other",
];

export const ENQUIRY_STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "trial_scheduled", label: "Trial Scheduled" },
  { value: "trial_completed", label: "Trial Completed" },
  { value: "follow_up_required", label: "Follow-up Required" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

export const normalizeIndianMobile = (value) =>
  String(value || "").replace(/\D/g, "");

export const validateQuickEnquiry = ({ playerName, parentPhone, dob }) => {
  if (!String(playerName || "").trim()) {
    return "Player name is required.";
  }

  if (String(playerName).trim().length > 120) {
    return "Player name must be 120 characters or fewer.";
  }

  if (!/^[0-9]{10}$/.test(normalizeIndianMobile(parentPhone))) {
    return "Enter a valid 10-digit Indian parent contact number.";
  }

  if (!dob) {
    return "Player date of birth is required.";
  }

  const parsedDob = new Date(`${dob}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(parsedDob.getTime()) || parsedDob > today) {
    return "Date of birth must be valid and cannot be in the future.";
  }

  return "";
};

export const fetchEnquiries = async () => {
  const { data, error } = await supabase
    .from("inquiries")
    .select(
      "id, academy_id, player_name, phone, dob, inquiry_source, assigned_center_id, status, trial_date, notes, created_by, created_at, updated_at, converted_player_id, converted_at, converted_by"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createEnquiry = async ({
  playerName,
  parentPhone,
  dob,
  source,
  centerId,
  notes,
}) => {
  const { data, error } = await supabase.rpc("create_inquiry", {
    p_player_name: String(playerName || "").trim(),
    p_phone: normalizeIndianMobile(parentPhone),
    p_dob: dob,
    p_inquiry_source: source || null,
    p_assigned_center_id: centerId || null,
    p_notes: String(notes || "").trim() || null,
  });

  if (error) throw error;
  return data;
};

export const findPotentialDuplicateEnquiries = async ({
  academyId,
  playerName,
  parentPhone,
  dob,
}) => {
  if (!academyId) return [];

  const phone = normalizeIndianMobile(parentPhone);
  const normalizedName = String(playerName || "").trim().toLocaleLowerCase();

  const { data, error } = await supabase
    .from("inquiries")
    .select("id, player_name, phone, dob, status, assigned_center_id, created_at")
    .eq("academy_id", academyId)
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || []).filter((enquiry) => {
    const sameName = String(enquiry.player_name || "").trim().toLocaleLowerCase() === normalizedName;
    const sameDob = Boolean(dob) && enquiry.dob === dob;
    return sameName || sameDob;
  });
};
