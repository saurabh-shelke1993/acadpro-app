import { supabase } from "../supabaseClient";
import { getDashboardDataScope } from "../utils/dataScope";

const EMPTY_KPIS = {
  totalPlayers: 0,
  totalCenters: 0,
  totalBatches: 0,
  totalAcademies: 0
};

const EMPTY_ATTENDANCE = {
  attendanceTaken: 0,
  presentPlayers: 0,
  absentPlayers: 0,
  attendancePercentage: 0
};

const EMPTY_FINANCIAL = {
  pendingDues: 0,
  outstandingAmount: 0,
  collectionsThisMonth: 0,
  receiptsGenerated: 0
};

const getToday = () => new Date().toISOString().split("T")[0];

const getCurrentMonthRange = () => {
  const now = new Date();

  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    nextMonthStart: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  };
};

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
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en-IN", {
        month: "short"
      }),
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

const getScopedBatches = async (scope) => {
  if (scope.type !== "batches" || !scope.batchIds.length) return [];

  const { data, error } = await supabase
    .from("batches")
    .select("id, center_id, academy_id")
    .in("id", scope.batchIds);

  if (error) throw error;

  return data || [];
};

const getCount = async (query) => {
  if (!query) return 0;

  const { count, error } = await query;

  if (error) throw error;

  return count || 0;
};

const applyAcademyScope = (query, scope, field = "academy_id") => {
  if (scope.type === "all") return query;
  if (scope.type === "academy") return query.eq(field, scope.academyId);

  return null;
};

const applyAttendanceScope = (query, scope) => {
  if (scope.type === "all") return query;
  if (scope.type === "academy") return query.eq("academy_id", scope.academyId);

  return scope.batchIds.length ? query.in("batch_id", scope.batchIds) : null;
};

// Foundational, presentation-independent dashboard metrics.
export async function getDashboardKPIs(user, suppliedScope) {
  const scope = suppliedScope || await getDashboardDataScope(user);

  if (scope.type === "none") return EMPTY_KPIS;

  if (scope.type === "batches") {
    const [batches, playerIds] = await Promise.all([
      getScopedBatches(scope),
      getScopedPlayerIds(scope)
    ]);

    const totalPlayers = playerIds.length
      ? await getCount(
        supabase.from("players").select("*", { count: "exact", head: true })
          .in("id", playerIds)
      )
      : 0;

    return {
      totalPlayers,
      totalCenters: new Set(batches.map((batch) => batch.center_id).filter(Boolean)).size,
      totalBatches: batches.length,
      totalAcademies: new Set(batches.map((batch) => batch.academy_id).filter(Boolean)).size
    };
  }

  const [totalPlayers, totalCenters, totalBatches, totalAcademies] = await Promise.all([
    getCount(applyAcademyScope(
      supabase.from("players").select("*", { count: "exact", head: true }), scope
    )),
    getCount(applyAcademyScope(
      supabase.from("centers").select("*", { count: "exact", head: true }), scope
    )),
    getCount(applyAcademyScope(
      supabase.from("batches").select("*", { count: "exact", head: true }), scope
    )),
    getCount(scope.type === "academy"
      ? supabase.from("academies").select("*", { count: "exact", head: true })
        .eq("id", scope.academyId)
      : supabase.from("academies").select("*", { count: "exact", head: true })
    )
  ]);

  return { totalPlayers, totalCenters, totalBatches, totalAcademies };
}

export async function getAttendanceSummary(user, suppliedScope) {
  const scope = suppliedScope || await getDashboardDataScope(user);

  if (scope.type === "none" ||
    (scope.type === "batches" && !scope.batchIds.length)) {
    return EMPTY_ATTENDANCE;
  }

  const attendanceQuery = () => applyAttendanceScope(
    supabase
      .from("attendance")
      .select("*", { count: "exact", head: true })
      .eq("attendance_date", getToday())
      .eq("is_deleted", false),
    scope
  );

  const [attendanceTaken, presentPlayers, absentPlayers] = await Promise.all([
    getCount(attendanceQuery()),
    getCount(attendanceQuery().eq("status", "present")),
    getCount(attendanceQuery().eq("status", "absent"))
  ]);

  return {
    attendanceTaken,
    presentPlayers,
    absentPlayers,
    attendancePercentage: attendanceTaken
      ? Math.round((presentPlayers / attendanceTaken) * 100)
      : 0
  };
}

export async function getAttendanceTrend(user, suppliedScope) {
  const scope = suppliedScope || await getDashboardDataScope(user);

  if (
    scope.type === "none" ||
    (scope.type === "batches" && !scope.batchIds.length)
  ) {
    return [];
  }

  const dates = getDateRange(7);

  const results = await Promise.all(
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

      const present = attendance.filter(
        (record) => record.status === "present"
      ).length;

      const absent = attendance.filter(
        (record) => record.status === "absent"
      ).length;

      const total = present + absent;

      return {
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString(
          "en-IN",
          {
            day: "numeric",
            month: "short"
          }
        ),
        present,
        absent,
        attendancePercentage: total
          ? Math.round((present / total) * 100)
          : 0
      };
    })
  );

  return results;
}


export async function getFinancialSummary(user, suppliedScope) {
  const scope = suppliedScope || await getDashboardDataScope(user);

  if (scope.type === "none" ||
    (scope.type === "batches" && !scope.batchIds.length)) {
    return EMPTY_FINANCIAL;
  }

  const playerIds = scope.type === "batches"
    ? await getScopedPlayerIds(scope)
    : null;

  if (scope.type === "batches" && !playerIds.length) {
    return EMPTY_FINANCIAL;
  }

  let duesQuery = supabase
    .from("payment_dues")
    .select("total_amount, paid_amount, due_status");
  let paymentsQuery = supabase
    .from("payments")
    .select("amount_paid, payment_date, receipt_number");

  if (scope.type === "academy") {
    duesQuery = supabase
      .from("payment_dues")
      .select("total_amount, paid_amount, due_status, players!inner(academy_id)")
      .eq("players.academy_id", scope.academyId);
    paymentsQuery = supabase
      .from("payments")
      .select("amount_paid, payment_date, receipt_number, players!inner(academy_id)")
      .eq("players.academy_id", scope.academyId);
  }

  if (scope.type === "batches") {
    duesQuery = duesQuery.in("player_id", playerIds);
    paymentsQuery = paymentsQuery.in("player_id", playerIds);
  }

  const [{ data: dues, error: duesError }, { data: payments, error: paymentsError }] =
    await Promise.all([duesQuery, paymentsQuery]);

  if (duesError) throw duesError;
  if (paymentsError) throw paymentsError;

  const pendingDues = (dues || []).filter((due) =>
    due.due_status === "pending" || due.due_status === "partial"
  );
  const { monthStart, nextMonthStart } = getCurrentMonthRange();
  const monthlyPayments = (payments || []).filter((payment) =>
    payment.payment_date >= monthStart && payment.payment_date < nextMonthStart
  );

  return {
    pendingDues: pendingDues.length,
    outstandingAmount: pendingDues.reduce(
      (total, due) => total + Math.max(
        Number(due.total_amount || 0) - Number(due.paid_amount || 0), 0
      ),
      0
    ),
    collectionsThisMonth: monthlyPayments.reduce(
      (total, payment) => total + Number(payment.amount_paid || 0), 0
    ),
    receiptsGenerated: monthlyPayments.filter(
      (payment) => Boolean(payment.receipt_number)
    ).length
  };
}

export async function getCollectionsTrend(user, suppliedScope) {
  const scope = suppliedScope || await getDashboardDataScope(user);

  if (
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

  return months.map((month) => {
    const collections = payments
      .filter(
        (payment) =>
          payment.payment_date >= month.monthStart &&
          payment.payment_date < month.nextMonthStart
      )
      .reduce(
        (total, payment) =>
          total + Number(payment.amount_paid || 0),
        0
      );

    return {
      month: month.label,
      collections
    };
  });
}

export async function getDashboardSummary(user) {
  const scope = await getDashboardDataScope(user);

  const [
    kpis,
    attendance,
    financial,
    attendanceTrend,
    collectionsTrend
  ] = await Promise.all([
    getDashboardKPIs(user, scope),
    getAttendanceSummary(user, scope),
    getFinancialSummary(user, scope),
    getAttendanceTrend(user, scope),
    getCollectionsTrend(user, scope)
  ]);

  return {
    ...kpis,
    ...attendance,
    ...financial,
    attendanceTrend,
    collectionsTrend
  };
}