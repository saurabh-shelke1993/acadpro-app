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