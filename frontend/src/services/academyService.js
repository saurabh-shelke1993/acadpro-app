import { supabase } from "../supabaseClient";

export const createAcademy = async (academyData) => {
  const { data, error } = await supabase
    .from("academies")
    .insert([academyData])
    .select();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
};

export const getAcademies = async () => {

  const { data, error } = await supabase
 .from("academies")
.select("*")
.eq("is_active", true)
.order("created_at", {
  ascending: false
});

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
};

export const updateAcademy = async (
  academyId,
  academyName
) => {

  const { data, error } =
    await supabase
      .from("academies")
      .update({
        academy_name: academyName
      })
      .eq("id", academyId)
      .select();

  if (error) {
    throw error;
  }

  return data;
};

export const deleteAcademy = async (
  academyId
) => {

  const { data, error } =
    await supabase
      .from("academies")
      .update({
        is_active: false
      })
      .eq("id", academyId)
      .select();

  if (error) {
    throw error;
  }

  return data;
};

export const createCenter = async (centerData) => {

  const { data, error } = await supabase
    .from("centers")
    .insert([centerData])
    .select();

  if (error) {

    console.error(error);

    throw error;
  }

  return data;
};

export const uploadAcademyLogo = async (academyId, file) => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const uniqueSuffix =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `academies/${academyId}/${uniqueSuffix}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("academy-logos")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from("academy-logos")
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("Academy logo URL could not be generated.");
  }

  return {
    publicUrl: data.publicUrl,
    path,
  };
};

export const deleteAcademyLogo = async (logoUrl) => {
  if (!logoUrl) {
    return;
  }

  const marker = "/storage/v1/object/public/academy-logos/";
  const markerIndex = logoUrl.indexOf(marker);

  if (markerIndex === -1) {
    return;
  }

  const path = decodeURIComponent(
    logoUrl.slice(markerIndex + marker.length).split("?")[0]
  );

  if (!path) {
    return;
  }

  const { error } = await supabase.storage
    .from("academy-logos")
    .remove([path]);

  if (error) {
    throw error;
  }
};

export const updateAcademyLogo = async (academyId, logoUrl) => {
  const { data, error } = await supabase
    .from("academies")
    .update({
      academy_logo: logoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", academyId)
    .select();

  if (error) {
    throw error;
  }

  return data;
};
