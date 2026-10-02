import { supabase } from "../supabaseClient";
import { getDashboardDataScope } from "../utils/dataScope";
import { getAttendanceTrend, getCollectionsTrend } from "./analyticsService";

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


export async function getSuperAdminDashboardData() {
  const { data: academies, error: academiesError } = await supabase
    .from("academies")
    .select("id, academy_name")
    .eq("is_active", true)
    .order("academy_name");

  if (academiesError) throw academiesError;

  const dateWindow = getDateRange(14);
  const currentAttendanceDates = dateWindow.slice(7);
  const previousAttendanceDates = dateWindow.slice(0, 7);
  const currentAttendanceStart = currentAttendanceDates[0];
  const currentAttendanceEnd = currentAttendanceDates[6];
  const previousAttendanceStart = previousAttendanceDates[0];

  const { monthStart, nextMonthStart } = getCurrentMonthRange();
  const currentMonthStartDate = new Date(monthStart);
  const previousMonthStartDate = new Date(
    currentMonthStartDate.getFullYear(),
    currentMonthStartDate.getMonth() - 1,
    1
  );
  const previousMonthStart = previousMonthStartDate.toISOString();
  const previousMonthEnd = monthStart;

  const [
    playersResult,
    centersResult,
    batchesResult,
    attendanceResult,
    duesResult,
    paymentsResult
  ] = await Promise.all([
    supabase
      .from("players")
      .select("id, academy_id")
      .eq("is_active", true),
    supabase
      .from("centers")
      .select("id, academy_id")
      .eq("is_active", true),
    supabase
      .from("batches")
      .select("id, academy_id")
      .eq("is_active", true),
    supabase
      .from("attendance")
      .select("academy_id, attendance_date, status")
      .gte("attendance_date", previousAttendanceStart)
      .lte("attendance_date", currentAttendanceEnd)
      .eq("is_deleted", false),
    supabase
      .from("payment_dues")
      .select("total_amount, paid_amount, due_status, players!inner(academy_id)")
      .eq("players.is_active", true),
    supabase
      .from("payments")
      .select("amount_paid, payment_date, players!inner(academy_id)")
      .eq("players.is_active", true)
  ]);

  const results = [
    playersResult,
    centersResult,
    batchesResult,
    attendanceResult,
    duesResult,
    paymentsResult
  ];

  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;

  const academyMap = new Map(
    (academies || []).map((academy) => [
      academy.id,
      {
        id: academy.id,
        name: academy.academy_name,
        players: 0,
        centers: 0,
        batches: 0,
        attendancePresent: 0,
        attendanceAbsent: 0,
        previousAttendancePresent: 0,
        previousAttendanceAbsent: 0,
        attendanceRecords: 0,
        previousAttendanceRecords: 0,
        totalBilled: 0,
        totalPaid: 0,
        outstandingAmount: 0,
        collectionRate: 0,
        collectionsThisMonth: 0,
        collectionsPreviousMonth: 0
      }
    ])
  );

  (playersResult.data || []).forEach((player) => {
    const academy = academyMap.get(player.academy_id);
    if (academy) academy.players += 1;
  });

  (centersResult.data || []).forEach((center) => {
    const academy = academyMap.get(center.academy_id);
    if (academy) academy.centers += 1;
  });

  (batchesResult.data || []).forEach((batch) => {
    const academy = academyMap.get(batch.academy_id);
    if (academy) academy.batches += 1;
  });

  (attendanceResult.data || []).forEach((record) => {
    const academy = academyMap.get(record.academy_id);
    if (!academy) return;

    const isCurrentPeriod =
      record.attendance_date >= currentAttendanceStart &&
      record.attendance_date <= currentAttendanceEnd;

    if (isCurrentPeriod) {
      if (record.status === "present") academy.attendancePresent += 1;
      if (record.status === "absent") academy.attendanceAbsent += 1;
    } else {
      if (record.status === "present") academy.previousAttendancePresent += 1;
      if (record.status === "absent") academy.previousAttendanceAbsent += 1;
    }
  });

  (duesResult.data || []).forEach((due) => {
    const academyId = due.players?.academy_id;
    const academy = academyMap.get(academyId);
    if (!academy) return;

    const totalAmount = Number(due.total_amount || 0);
    const paidAmount = Math.min(
      Number(due.paid_amount || 0),
      totalAmount
    );

    academy.totalBilled += totalAmount;
    academy.totalPaid += paidAmount;
  });

  let collectionsThisMonth = 0;

  (paymentsResult.data || []).forEach((payment) => {
    const academyId = payment.players?.academy_id;
    const academy = academyMap.get(academyId);
    if (!academy) return;

    const paymentDate = new Date(payment.payment_date);
    if (Number.isNaN(paymentDate.getTime())) return;

    if (
      paymentDate >= new Date(monthStart) &&
      paymentDate < new Date(nextMonthStart)
    ) {
      const amount = Number(payment.amount_paid || 0);
      academy.collectionsThisMonth += amount;
      collectionsThisMonth += amount;
    }

    if (
      paymentDate >= new Date(previousMonthStart) &&
      paymentDate < new Date(previousMonthEnd)
    ) {
      academy.collectionsPreviousMonth += Number(payment.amount_paid || 0);
    }
  });

  const getAttendanceRate = (present, absent) => {
    const total = present + absent;
    return total ? Math.round((present / total) * 100) : 0;
  };

  const getPercentageChange = (current, previous) => {
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const academyRows = [...academyMap.values()].map((academy) => {
    academy.attendanceRecords =
      academy.attendancePresent + academy.attendanceAbsent;

    academy.previousAttendanceRecords =
      academy.previousAttendancePresent + academy.previousAttendanceAbsent;

    academy.attendanceRate = getAttendanceRate(
      academy.attendancePresent,
      academy.attendanceAbsent
    );

    academy.previousAttendanceRate = getAttendanceRate(
      academy.previousAttendancePresent,
      academy.previousAttendanceAbsent
    );

    academy.attendanceDelta = academy.previousAttendanceRecords
      ? academy.attendanceRate - academy.previousAttendanceRate
      : null;

    academy.outstandingAmount = Math.max(
      academy.totalBilled - academy.totalPaid,
      0
    );

    academy.collectionRate = academy.totalBilled
      ? Math.round(
        (academy.totalPaid / academy.totalBilled) * 100
      )
      : 0;

    academy.collectionsChange = getPercentageChange(
      academy.collectionsThisMonth,
      academy.collectionsPreviousMonth
    );

    return academy;
  });

  const totalPlayers = academyRows.reduce(
    (total, academy) => total + academy.players,
    0
  );

  const totalPresent = academyRows.reduce(
    (total, academy) => total + academy.attendancePresent,
    0
  );

  const totalAbsent = academyRows.reduce(
    (total, academy) => total + academy.attendanceAbsent,
    0
  );

  const totalAttendanceRecords = totalPresent + totalAbsent;

  const attentionItems = [];

  academyRows.forEach((academy) => {
    if (academy.attendanceRecords > 0 && academy.attendanceRate < 70) {
      attentionItems.push({
        academyId: academy.id,
        academyName: academy.name,
        type: "attendance",
        tone: "warning",
        message: `Attendance is ${academy.attendanceRate}% over the last 7 days.`
      });
    }

    if (
      academy.totalBilled > 0 &&
      academy.collectionRate < 75
    ) {
      attentionItems.push({
        academyId: academy.id,
        academyName: academy.name,
        type: "finance",
        tone: "danger",
        message: `${formatDashboardCurrency(academy.outstandingAmount)} remains outstanding (${academy.collectionRate}% collected).`
      });
    }
  });

  attentionItems.sort((a, b) => {
    if (a.type === b.type) return a.academyName.localeCompare(b.academyName);
    return a.type === "attendance" ? -1 : 1;
  });

  const dates = getDateRange(7);
  const attendanceTrend = dates.map((date) => {
    const records = (attendanceResult.data || []).filter(
      (record) => record.attendance_date === date
    );

    const present = records.filter((record) => record.status === "present").length;
    const absent = records.filter((record) => record.status === "absent").length;
    const total = present + absent;

    return {
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
        weekday: "short"
      }),
      attendanceRecords: total,
      attendancePercentage: total
        ? Math.round((present / total) * 100)
        : 0
    };
  });

  const attendanceLeader = [...academyRows]
    .filter((academy) => academy.attendanceRecords > 0)
    .sort((a, b) => {
      if (b.attendanceRate !== a.attendanceRate) {
        return b.attendanceRate - a.attendanceRate;
      }
      return b.attendanceRecords - a.attendanceRecords;
    })[0] || null;

  const collectionsLeader = [...academyRows]
    .filter((academy) => academy.collectionsThisMonth > 0)
    .sort((a, b) => {
      if (b.collectionsThisMonth !== a.collectionsThisMonth) {
        return b.collectionsThisMonth - a.collectionsThisMonth;
      }
      return b.players - a.players;
    })[0] || null;

  const largestOutstanding = [...academyRows]
    .filter((academy) => academy.outstandingAmount > 0)
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount)[0] || null;

  return {
    academies: academyRows,
    attentionItems,
    attendanceTrend,
    insights: {
      attendanceLeader: attendanceLeader
        ? {
          academyId: attendanceLeader.id,
          academyName: attendanceLeader.name,
          value: attendanceLeader.attendanceRate,
          records: attendanceLeader.attendanceRecords
        }
        : null,
      collectionsLeader: collectionsLeader
        ? {
          academyId: collectionsLeader.id,
          academyName: collectionsLeader.name,
          value: collectionsLeader.collectionsThisMonth,
          change: collectionsLeader.collectionsChange
        }
        : null,
      largestOutstanding: largestOutstanding
        ? {
          academyId: largestOutstanding.id,
          academyName: largestOutstanding.name,
          value: largestOutstanding.outstandingAmount,
          collectionRate: largestOutstanding.collectionRate
        }
        : null
    },
    totals: {
      academies: academyRows.length,
      players: totalPlayers,
      attendanceRecords: totalAttendanceRecords,
      attendanceRate: totalAttendanceRecords
        ? Math.round((totalPresent / totalAttendanceRecords) * 100)
        : 0,
      collectionsThisMonth
    }
  };
}

const formatDashboardCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

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
    getAttendanceTrend(scope),
    getCollectionsTrend(scope)
  ]);

  return {
    ...kpis,
    ...attendance,
    ...financial,
    attendanceTrend,
    collectionsTrend
  };
}