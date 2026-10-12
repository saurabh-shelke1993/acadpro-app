import { supabase } from "../supabaseClient";

export const formatSubmissionStatus = (status) => {
  const labels = {
    pending: "Pending verification",
    accepted: "Accepted — awaiting ledger recording",
    rejected: "Rejected",
    recorded: "Recorded in payment ledger",
  };
  return labels[status] || "Unknown status";
};

export const validateParentPaymentSubmission = ({
  dueId,
  amount,
  transactionReference,
  paymentDate,
}) => {
  if (!dueId) return "Select a fee due.";
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return "Enter an amount greater than zero.";
  }
  if (!String(transactionReference || "").trim().match(/^.{3,120}$/)) {
    return "Enter a transaction reference between 3 and 120 characters.";
  }
  if (!paymentDate) return "Select the date you made the payment.";
  const selectedDate = new Date(`${paymentDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(selectedDate.getTime()) || selectedDate > today) {
    return "Payment date cannot be in the future.";
  }
  return null;
};

export const getParentPaymentSubmissions = async (playerId) => {
  if (!playerId) return [];
  const { data, error } = await supabase
    .from("parent_payment_submissions")
    .select("id, due_id, amount, transaction_reference, payment_date, parent_note, status, review_note, reviewed_at, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const submitParentUpiPayment = async ({
  dueId,
  amount,
  transactionReference,
  paymentDate,
  parentNote,
}) => {
  const validationError = validateParentPaymentSubmission({
    dueId,
    amount,
    transactionReference,
    paymentDate,
  });
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase.rpc("submit_parent_upi_payment", {
    p_due_id: dueId,
    p_amount: Number(amount),
    p_transaction_reference: transactionReference.trim(),
    p_payment_date: paymentDate,
    p_parent_note: parentNote?.trim() || null,
  });
  if (error) throw error;
  return data;
};

export const getAcademyPaymentSubmissions = async (status = "pending") => {
  let query = supabase
    .from("parent_payment_submissions")
    .select(`
      id, academy_id, parent_id, player_id, due_id, amount,
      transaction_reference, payment_date, parent_note, status,
      review_note, created_at, reviewed_at, payment_id, recorded_at,
      players!parent_payment_submissions_player_id_fkey(full_name),
      payment_dues!parent_payment_submissions_due_id_fkey(due_type, due_date, total_amount, paid_amount, remaining_amount),
      parents!parent_payment_submissions_parent_id_fkey(parent_name),
      payments!parent_payment_submissions_payment_id_fkey(receipt_number, transaction_reference, external_transaction_reference)
    `)
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const reviewParentUpiPayment = async (submissionId, decision, reviewNote = "") => {
  if (!submissionId) throw new Error("Payment claim is required.");
  if (!["accepted", "rejected"].includes(decision)) {
    throw new Error("Choose a valid review decision.");
  }
  if (decision === "rejected" && reviewNote.trim().length < 3) {
    throw new Error("Provide a rejection reason of at least 3 characters.");
  }
  const { data, error } = await supabase.rpc("review_parent_upi_payment", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_review_note: reviewNote.trim() || null,
  });
  if (error) throw error;
  return data;
};


export const recordAcceptedParentUpiPayment = async (submissionId) => {
  if (!submissionId) throw new Error("Payment claim is required.");
  const { data, error } = await supabase.rpc("record_accepted_parent_upi_submission", {
    p_submission_id: submissionId,
  });
  if (error) throw error;
  return data;
};
