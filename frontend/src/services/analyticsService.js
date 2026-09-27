import { supabase } from "../supabaseClient";
import { getDashboardDataScope } from "../utils/dataScope";

const getDateRange = (days) => {
  const dates = [];
  const today = new Date();

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    dates.push(date.toISOString().split("T")[0]);
  }

  return dates;
};

const getMonthRange = (months) => {
  const result = [];
  const now = new Date();

  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - index,
      1
    );

    const monthStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    );

    const nextMonthStart = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      1
    );

    result.push({
      label: date.toLocaleString("en-IN", { month: "short" }),
      monthStart: monthStart.toISOString(),
      nextMonthStart: nextMonthStart.toISOString()
    });
  }

  return result;
};

const getScopedPlayerIds = async (scope) => {
  if (scope.type !== "batches" || !scope.batchIds.length) return [];

  const { data, error } = await supabase
    .from("player_batches")
    .select("player_id")
    .in("batch_id", scope.batchIds);

  if (error) throw error;

  return [...new Set(
    (data || []).map((assignment) => assignment.player_id).filter(Boolean)
  )];
};

export async function getAttendanceTrend(suppliedScope) {
  const scope = suppliedScope;

  if (
    !scope ||
    scope.type === "none" ||
    (scope.type === "batches" && !scope.batchIds.length)
  ) {
    return [];
  }

  const dates = getDateRange(7);

  return Promise.all(
    dates.map(async (date) => {
      let query = supabase
        .from("attendance")
        .select("status")
        .eq("attendance_date", date)
        .eq("is_deleted", false);

      if (scope.type === "academy") {
        query = query.eq("academy_id", scope.academyId);
      }

      if (scope.type === "batches") {
        query = query.in("batch_id", scope.batchIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      const attendance = data || [];
      const present = attendance.filter((record) => record.status === "present").length;
      const absent = attendance.filter((record) => record.status === "absent").length;
      const total = present + absent;

      return {
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short"
        }),
        present,
        absent,
        attendancePercentage: total
          ? Math.round((present / total) * 100)
          : 0
      };
    })
  );
}

export async function getCollectionsTrend(suppliedScope) {
  const scope = suppliedScope;

  if (
    !scope ||
    scope.type === "none" ||
    (scope.type === "batches" && !scope.batchIds.length)
  ) {
    return [];
  }

  const playerIds = scope.type === "batches"
    ? await getScopedPlayerIds(scope)
    : null;

  if (scope.type === "batches" && !playerIds.length) {
    return [];
  }

  let query = supabase
    .from("payments")
    .select("amount_paid, payment_date");

  if (scope.type === "academy") {
    query = supabase
      .from("payments")
      .select(`
        amount_paid,
        payment_date,
        players!inner(academy_id)
      `)
      .eq("players.academy_id", scope.academyId);
  }

  if (scope.type === "batches") {
    query = query.in("player_id", playerIds);
  }

  const { data, error } = await query;

  if (error) throw error;

  const payments = data || [];
  const months = getMonthRange(6);

  return months.map((month) => ({
    month: month.label,
    collections: payments
      .filter(
        (payment) =>
          payment.payment_date >= month.monthStart &&
          payment.payment_date < month.nextMonthStart
      )
      .reduce(
        (total, payment) => total + Number(payment.amount_paid || 0),
        0
      )
  }));
}


export async function getAnalyticsSummary(user) {
  const scope = await getDashboardDataScope(user);

  const [attendanceTrend, collectionsTrend] = await Promise.all([
    getAttendanceTrend(scope),
    getCollectionsTrend(scope)
  ]);

  return {
    attendanceTrend,
    collectionsTrend
  };
}
