import { supabase } from "../supabaseClient";

const PARENT_PLAYER_SELECT =
  "id, full_name, dob, player_status, gender, joining_date, academy_id, center_id, batch_id, academies(academy_name, academy_logo), centers(center_name), batches(batch_name, age_group, start_time, end_time)";

const createAttendanceSummaryMap = (childIds) => {
  const summaries = {};
  childIds.forEach((childId) => {
    summaries[childId] = {
      total: 0,
      present: 0,
      absent: 0,
      percentage: null,
    };
  });
  return summaries;
};

export const getParentContext = async () => {
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !user) {
    throw new Error("Your session could not be verified. Please sign in again.");
  }

  const { data: parent, error: parentError } = await supabase
    .from("parents")
    .select("id, parent_name, email, user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (parentError) {
    throw new Error("We could not load your parent profile.");
  }

  if (!parent) {
    throw new Error(
      "No parent profile is linked to this login. Please contact your academy administrator."
    );
  }

  const { data: childRecords, error: childrenError } = await supabase
    .from("players")
    .select(PARENT_PLAYER_SELECT)
    .eq("parent_id", parent.id)
    .order("full_name", { ascending: true });

  if (childrenError) {
    throw new Error("We could not load your linked children.");
  }

  const children = (childRecords || []).map((child) => ({
    ...child,
    academy: child.academies || null,
    center: child.centers || null,
    batch: child.batches || null,
    coaches: [],
  }));

  let coachError = null;
  const batchIds = [...new Set(children.map((child) => child.batch_id).filter(Boolean))];

  if (batchIds.length > 0) {
    const { data: coachRecords, error } = await supabase.rpc("get_parent_child_coaches");
    coachError = error || null;

    if (!error) {
      const coachesByBatchId = new Map();

      (coachRecords || []).forEach((record) => {
        if (!record?.batch_id || !record?.coach_id) return;
        const coaches = coachesByBatchId.get(record.batch_id) || [];
        coaches.push({
          id: record.coach_id,
          full_name: record.coach_name,
        });
        coachesByBatchId.set(record.batch_id, coaches);
      });

      children.forEach((child) => {
        child.coaches = coachesByBatchId.get(child.batch_id) || [];
      });
    }
  }

  return { parent, children, coachError };
};

export const getAttendanceSummaries = async (childIds) => {
  const summaries = createAttendanceSummaryMap(childIds);

  if (!childIds.length) {
    return { summaries, error: null };
  }

  const { data, error } = await supabase
    .from("attendance")
    .select("player_id, attendance_date, status")
    .in("player_id", childIds)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("attendance_date", { ascending: false });

  (data || []).forEach((record) => {
    const summary = summaries[record.player_id];
    if (!summary) return;

    summary.total += 1;
    const status = String(record.status || "").toLowerCase();
    if (status === "present") summary.present += 1;
    if (status === "absent") summary.absent += 1;
  });

  Object.values(summaries).forEach((summary) => {
    summary.percentage =
      summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : null;
  });

  return { summaries, error };
};

export const getChildFinancialData = async (childId) => {
  if (!childId) {
    return { paymentHistory: [], pendingDues: [], errors: [] };
  }

  const [paymentsResult, duesResult] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, player_id, payment_date, amount_paid, payment_mode, transaction_reference, receipt_number, remarks, due_id"
      )
      .eq("player_id", childId)
      .order("payment_date", { ascending: false }),
    supabase
      .from("payment_dues")
      .select(
        "id, player_id, subscription_id, due_type, due_date, total_amount, paid_amount, remaining_amount, due_status, remarks"
      )
      .eq("player_id", childId)
      .order("due_date", { ascending: true }),
  ]);

  const pendingDues = (duesResult.data || []).filter((due) => {
    const remaining = Number(due.remaining_amount);
    const status = String(due.due_status || "").toLowerCase();
    const settled = ["paid", "settled", "fully paid", "fully_paid"].includes(status);
    return remaining > 0 || (due.remaining_amount === null && !settled);
  });

  return {
    paymentHistory: paymentsResult.data || [],
    pendingDues,
    errors: [
      paymentsResult.error ? "Payment history could not be loaded." : null,
      duesResult.error ? "Outstanding dues could not be loaded." : null,
    ].filter(Boolean),
  };
};
