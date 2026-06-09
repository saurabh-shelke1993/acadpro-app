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
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
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