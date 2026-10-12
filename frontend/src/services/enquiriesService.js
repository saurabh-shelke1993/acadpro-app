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

export const validateEnquiryStatusUpdate = ({ status, trialDate }) => {
  const allowedStatuses = ENQUIRY_STATUSES
    .map((item) => item.value)
    .filter((value) => value !== "converted");

  if (!allowedStatuses.includes(status)) {
    return "Select a valid enquiry status.";
  }

  if (status === "trial_scheduled" && !trialDate) {
    return "A trial date is required for Trial Scheduled status.";
  }

  if (trialDate) {
    const parsedTrialDate = new Date(`${trialDate}T00:00:00`);
    if (Number.isNaN(parsedTrialDate.getTime())) {
      return "Enter a valid trial date.";
    }
  }

  return "";
};

export const updateEnquiryStatus = async (enquiry, status, trialDate) => {
  const { error } = await supabase.rpc("update_inquiry", {
    p_inquiry_id: enquiry.id,
    p_player_name: enquiry.player_name,
    p_phone: enquiry.phone,
    p_dob: enquiry.dob,
    p_inquiry_source: enquiry.inquiry_source || null,
    p_assigned_center_id: enquiry.assigned_center_id || null,
    p_notes: enquiry.notes || null,
    p_status: status,
    p_trial_date: trialDate || null,
  });

  if (error) throw error;
};

export const convertEnquiryToPlayer = async ({
  enquiryId,
  parentName,
  parentEmail,
  parentAddress,
  gender,
  joiningDate,
  centerId,
  batchId,
}) => {
  const { data, error } = await supabase.rpc("record_inquiry_conversion", {
    p_inquiry_id: enquiryId,
    p_parent_name: String(parentName || "").trim(),
    p_parent_email: String(parentEmail || "").trim() || null,
    p_parent_address: String(parentAddress || "").trim() || null,
    p_gender: gender || null,
    p_joining_date: joiningDate,
    p_center_id: centerId,
    p_batch_id: batchId,
  });

  if (error) throw error;
  return data;
};

export const validateEnquiryConversion = ({
  parentName,
  gender,
  joiningDate,
  centerId,
  batchId,
}) => {
  if (!String(parentName || "").trim()) {
    return "Parent name is required to register the player.";
  }
  if (!gender || !["Male", "Female"].includes(gender)) {
    return "Select the player's gender.";
  }
  if (!joiningDate) {
    return "Joining date is required.";
  }
  const parsedJoiningDate = new Date(`${joiningDate}T00:00:00`);
  if (Number.isNaN(parsedJoiningDate.getTime())) {
    return "Enter a valid joining date.";
  }
  if (!centerId) {
    return "Select a center.";
  }
  if (!batchId) {
    return "Select a batch.";
  }
  return "";
};
