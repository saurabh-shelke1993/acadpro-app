import { supabase } from "../supabaseClient";
import { getDashboardDataScope } from "../utils/dataScope";
import { isSuperAdmin } from "../utils/roles";

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

export async function getAttendanceTrend(suppliedScope, days = 7) {
  const scope = suppliedScope;

  if (
    !scope ||
    scope.type === "none" ||
    (scope.type === "batches" && !scope.batchIds.length)
  ) {
    return [];
  }

  const dates = getDateRange(days);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  let query = supabase
    .from("attendance")
    .select("attendance_date, status")
    .gte("attendance_date", startDate)
    .lte("attendance_date", endDate)
    .eq("is_deleted", false);

  if (scope.type === "academy") {
    query = query.eq("academy_id", scope.academyId);
  }

  if (scope.type === "batches") {
    query = query.in("batch_id", scope.batchIds);
  }

  const { data, error } = await query;

  if (error) throw error;

  const attendanceByDate = (data || []).reduce((result, record) => {
    const date = record.attendance_date;

    if (!result[date]) {
      result[date] = {
        present: 0,
        absent: 0
      };
    }

    if (record.status === "present") {
      result[date].present += 1;
    }

    if (record.status === "absent") {
      result[date].absent += 1;
    }

    return result;
  }, {});

  return dates.map((date) => {
    const daily = attendanceByDate[date] || {
      present: 0,
      absent: 0
    };

    const total = daily.present + daily.absent;

    return {
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
      }),
      present: daily.present,
      absent: daily.absent,
      attendancePercentage: total
        ? Math.round((daily.present / total) * 100)
        : 0
    };
  });
}

export async function getAttendanceInsights(suppliedScope, days = 30) {
  const scope = suppliedScope;

  if (
    !scope ||
    scope.type === "none" ||
    (scope.type === "batches" && !scope.batchIds.length)
  ) {
    return [];
  }

  const dates = getDateRange(days);

  let query = supabase
    .from("attendance")
    .select(`
      player_id,
      status,
      players!inner(
        full_name,
        is_active
      )
    `)
    .gte("attendance_date", dates[0])
    .lte("attendance_date", dates[dates.length - 1])
    .eq("is_deleted", false)
    .eq("players.is_active", true);

  if (scope.type === "academy") {
    query = query.eq("academy_id", scope.academyId);
  }

  if (scope.type === "batches") {
    query = query.in("batch_id", scope.batchIds);
  }

  const { data, error } = await query;

  if (error) throw error;

  const playerStats = (data || []).reduce((result, record) => {
    if (!record.player_id) return result;

    if (!result[record.player_id]) {
      result[record.player_id] = {
        playerId: record.player_id,
        playerName: record.players?.full_name || "Unknown player",
        present: 0,
        absent: 0
      };
    }

    if (record.status === "present") {
      result[record.player_id].present += 1;
    }

    if (record.status === "absent") {
      result[record.player_id].absent += 1;
    }

    return result;
  }, {});

  return Object.values(playerStats)
    .map((player) => {
      const total = player.present + player.absent;

      return {
        ...player,
        total,
        attendanceRate: total
          ? Math.round((player.present / total) * 100)
          : 0
      };
    })
    .filter((player) => player.total >= 3)
    .sort((a, b) =>
      a.attendanceRate - b.attendanceRate ||
      b.total - a.total ||
      a.playerName.localeCompare(b.playerName)
    )
    .slice(0, 5);
}

export async function getCollectionsTrend(suppliedScope, monthsCount = 6) {
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

  const months = getMonthRange(monthsCount);

  let query = supabase
    .from("payments")
    .select("amount_paid, payment_date")
    .gte("payment_date", months[0].monthStart)
    .lt("payment_date", months[months.length - 1].nextMonthStart);

  if (scope.type === "academy") {
    query = supabase
      .from("payments")
      .select(`
        amount_paid,
        payment_date,
        players!inner(academy_id)
      `)
      .eq("players.academy_id", scope.academyId)
      .gte("payment_date", months[0].monthStart)
      .lt("payment_date", months[months.length - 1].nextMonthStart);
  }

  if (scope.type === "batches") {
    query = query.in("player_id", playerIds);
  }

  const { data, error } = await query;

  if (error) throw error;

  const payments = data || [];

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

export async function getFinancialHealth(suppliedScope) {
  const scope = suppliedScope;

  if (
    !scope ||
    scope.type === "none" ||
    (scope.type === "batches" && !scope.batchIds.length)
  ) {
    return {
      totalBilled: 0,
      totalPaid: 0,
      outstandingAmount: 0,
      collectionRate: 0,
      pendingDues: 0,
      partialDues: 0,
      paidDues: 0
    };
  }

  const playerIds = scope.type === "batches"
    ? await getScopedPlayerIds(scope)
    : null;

  if (scope.type === "batches" && !playerIds.length) {
    return {
      totalBilled: 0,
      totalPaid: 0,
      outstandingAmount: 0,
      collectionRate: 0,
      pendingDues: 0,
      partialDues: 0,
      paidDues: 0
    };
  }

  let query = supabase
    .from("payment_dues")
    .select("total_amount, paid_amount, due_status");

  if (scope.type === "academy") {
    query = supabase
      .from("payment_dues")
      .select("total_amount, paid_amount, due_status, players!inner(academy_id)")
      .eq("players.academy_id", scope.academyId);
  }

  if (scope.type === "batches") {
    query = query.in("player_id", playerIds);
  }

  const { data, error } = await query;

  if (error) throw error;

  const dues = data || [];

  const totalBilled = dues.reduce(
    (total, due) => total + Number(due.total_amount || 0),
    0
  );

  const totalPaid = dues.reduce(
    (total, due) => total + Math.min(
      Number(due.paid_amount || 0),
      Number(due.total_amount || 0)
    ),
    0
  );

  const outstandingAmount = Math.max(totalBilled - totalPaid, 0);

  return {
    totalBilled,
    totalPaid,
    outstandingAmount,
    collectionRate: totalBilled
      ? Math.round((totalPaid / totalBilled) * 100)
      : 0,
    pendingDues: dues.filter((due) => due.due_status === "pending").length,
    partialDues: dues.filter((due) => due.due_status === "partial").length,
    paidDues: dues.filter((due) => due.due_status === "paid").length
  };
}

export async function getAnalyticsSummary(
  user,
  {
    attendanceDays = 7,
    collectionsMonths = 6,
    selectedAcademyId = ""
  } = {}
) {
  let scope = await getDashboardDataScope(user);

  if (isSuperAdmin(user) && selectedAcademyId) {
    scope = {
      type: "academy",
      academyId: selectedAcademyId
    };
  }

  const [attendanceTrend, attendanceInsights, collectionsTrend, financialHealth] =
    await Promise.all([
      getAttendanceTrend(scope, attendanceDays),
      getAttendanceInsights(scope, attendanceDays),
      getCollectionsTrend(scope, collectionsMonths),
      getFinancialHealth(scope)
    ]);

  return {
    attendanceTrend,
    attendanceInsights,
    collectionsTrend,
    financialHealth
  };
}
