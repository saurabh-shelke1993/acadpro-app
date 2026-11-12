import { supabase } from "../supabaseClient";

// =====================================================
// FETCH PAYMENT DUES
// =====================================================

export const fetchPaymentDuesService = async (query) => {
  const { data, error } = await query;

  if (error) throw error;

  return data;
};

// =====================================================
// CREATE PAYMENT DUE
// =====================================================

export const createPaymentDueService = async (dueData) => {
  // Financial amounts and approval remarks must not be logged to browser consoles.
  const { data, error } = await supabase
    .from("payment_dues")
    .insert([dueData])
    .select();

  if (error) throw error;
  return data;
};

// =====================================================
// UPDATE PAYMENT DUE
// =====================================================

export const updatePaymentDueService = async (
  dueId,
  updateData
) => {

  const { data, error } = await supabase
    .from("payment_dues")
    .update(updateData)
    .eq("id", dueId)
    .select();

  if (error) throw error;

  return data;
};

// =====================================================
// DELETE PAYMENT DUE
// =====================================================

export const deletePaymentDueService = async (
  dueId
) => {

  const { error } = await supabase
    .from("payment_dues")
    .delete()
    .eq("id", dueId);

  if (error) throw error;
};