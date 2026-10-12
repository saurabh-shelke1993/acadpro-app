import { supabase } from "../supabaseClient";

const BUCKET = "academy-upi-qr";
const MAX_QR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_QR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const normalizeUpiId = (value) => String(value || "").trim();

export const isValidUpiId = (value) => {
  const upiId = normalizeUpiId(value);
  return !upiId || (
    upiId.length >= 3
    && upiId.length <= 100
    && /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(upiId)
  );
};

export const validateQrFile = (file) => {
  if (!file) return null;
  if (!ALLOWED_QR_TYPES.has(file.type)) {
    return "Choose a PNG, JPG, or WebP image.";
  }
  if (file.size > MAX_QR_SIZE_BYTES) {
    return "The QR image must be 2 MB or smaller.";
  }
  return null;
};

export const getAcademyPaymentSettings = async (academyId) => {
  if (!academyId) return null;

  const { data, error } = await supabase
    .from("academy_payment_settings")
    .select("academy_id, upi_id, payee_name, qr_image_path, is_enabled, updated_at, academies(academy_name)")
    .eq("academy_id", academyId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const getAcademyPaymentSettingsList = async (user, academyId = "") => {
  let query = supabase
    .from("academy_payment_settings")
    .select("academy_id, upi_id, payee_name, qr_image_path, is_enabled, updated_at, academies(academy_name)")
    .order("updated_at", { ascending: false });

  if (user?.role === "academy_owner") {
    query = query.eq("academy_id", user.academy_id);
  } else if (academyId) {
    query = query.eq("academy_id", academyId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getAcademyPaymentSettingsAcademies = async (user) => {
  let query = supabase
    .from("academies")
    .select("id, academy_name")
    .order("academy_name", { ascending: true });

  if (user?.role === "academy_owner") {
    query = query.eq("id", user.academy_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getPublicQrUrl = (path) => {
  if (!path) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
};

const getFileExtension = (file) => {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
};

export const saveAcademyPaymentSettings = async ({
  user,
  academyId,
  currentSettings,
  upiId,
  payeeName,
  isEnabled,
  qrFile,
  removeQr,
}) => {
  if (user?.role !== "academy_owner" || !user.academy_id || user.academy_id !== academyId) {
    throw new Error("Only the Academy Owner can update payment settings for their own academy.");
  }

  const normalizedUpiId = normalizeUpiId(upiId);
  const normalizedPayeeName = String(payeeName || "").trim();
  const fileError = validateQrFile(qrFile);
  if (fileError) throw new Error(fileError);
  if (!isValidUpiId(normalizedUpiId)) {
    throw new Error("Enter a valid UPI ID, for example name@bank.");
  }

  const nextQrPath = removeQr ? null : (currentSettings?.qr_image_path || null);
  if (isEnabled && !normalizedPayeeName) {
    throw new Error("Enter the payee name before enabling UPI payments.");
  }
  if (isEnabled && !normalizedUpiId && !qrFile && !nextQrPath) {
    throw new Error("Add a UPI ID or upload a QR image before enabling payments.");
  }

  let uploadedPath = null;
  if (qrFile) {
    uploadedPath = `${academyId}/${window.crypto.randomUUID()}.${getFileExtension(qrFile)}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(uploadedPath, qrFile, {
        cacheControl: "3600",
        contentType: qrFile.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;
  }

  const qrImagePath = uploadedPath || nextQrPath;
  const { data, error } = await supabase
    .from("academy_payment_settings")
    .upsert({
      academy_id: academyId,
      upi_id: normalizedUpiId || null,
      payee_name: normalizedPayeeName || null,
      qr_image_path: qrImagePath,
      is_enabled: Boolean(isEnabled),
      updated_by: user.id,
    }, { onConflict: "academy_id" })
    .select("academy_id, upi_id, payee_name, qr_image_path, is_enabled, updated_at, academies(academy_name)")
    .single();

  if (error) {
    if (uploadedPath) {
      await supabase.storage.from(BUCKET).remove([uploadedPath]);
    }
    throw error;
  }

  const previousQrPath = currentSettings?.qr_image_path || null;
  const shouldRemovePrevious = previousQrPath && previousQrPath !== qrImagePath;
  let warning = "";
  if (shouldRemovePrevious) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([previousQrPath]);
    if (removeError) {
      warning = "Settings saved, but the previous QR image could not be removed. You can retry cleanup later.";
    }
  }

  return { data, warning };
};
