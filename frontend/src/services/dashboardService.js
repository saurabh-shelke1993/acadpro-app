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

export async function getAcademyOwnerDashboardData(user) {
  if (!user?.academy_id) {
    throw new Error("Academy Owner is not linked to an academy.");
  }

  const academyId = user.academy_id;
  const today = getToday();

  const attendanceDates = getDateRange(7);
  const attendanceStart = attendanceDates[0];
  const attendanceEnd = attendanceDates[attendanceDates.length - 1];

  const [
    academyResult,
    centersResult,
    batchesResult,
    playersResult,
    assignmentsResult,
    attendanceResult,
    duesResult,
    paymentsResult,
    attendanceTrend,
    collectionsTrend
  ] = await Promise.all([
    supabase
      .from("academies")
      .select("id, academy_name")
      .eq("id", academyId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("centers")
      .select("id, center_name")
      .eq("academy_id", academyId)
      .eq("is_active", true)
      .order("center_name"),
    supabase
      .from("batches")
      .select("id, center_id, batch_name")
      .eq("academy_id", academyId)
      .eq("is_active", true)
      .order("batch_name"),
    supabase
      .from("players")
      .select("id")
      .eq("academy_id", academyId)
      .eq("is_active", true),
    supabase
      .from("player_batches")
      .select(`
        player_id,
        batch_id,
        batches!inner(
          id,
          center_id,
          academy_id,
          is_active
        ),
        players!inner(
          id,
          academy_id,
          is_active
        )
      `)
      .eq("batches.academy_id", academyId)
      .eq("batches.is_active", true)
      .eq("players.academy_id", academyId)
      .eq("players.is_active", true),
    supabase
      .from("attendance")
      .select("batch_id, attendance_date, status")
      .eq("academy_id", academyId)
      .gte("attendance_date", attendanceStart)
      .lte("attendance_date", attendanceEnd)
      .eq("is_deleted", false),
    supabase
      .from("payment_dues")
      .select("player_id, total_amount, paid_amount, due_status")
      .eq("players.is_active", true)
      .eq("players.academy_id", academyId)
      .select("player_id, total_amount, paid_amount, due_status, players!inner(academy_id, is_active)"),
    supabase
      .from("payments")
      .select("amount_paid, payment_date, players!inner(academy_id, is_active)")
      .eq("players.academy_id", academyId)
      .eq("players.is_active", true),
    getAttendanceTrend({ type: "academy", academyId }, 7),
    getCollectionsTrend({ type: "academy", academyId }, 6)
  ]);

  const results = [
    academyResult,
    centersResult,
    batchesResult,
    playersResult,
    assignmentsResult,
    attendanceResult,
    duesResult,
    paymentsResult
  ];

  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;

  if (!academyResult.data) {
    throw new Error("Active academy could not be found.");
  }

  const centers = (centersResult.data || []).map((center) => ({
    id: center.id,
    academyId,
    name: center.center_name,
    players: 0,
    batches: 0,
    attendancePresent: 0,
    attendanceAbsent: 0,
    attendanceRecords: 0,
    attendanceRate: 0,
    recordedBatches: 0,
    attendanceCoverage: 0
  }));

  const centerMap = new Map(centers.map((center) => [center.id, center]));
  const batchMap = new Map(
    (batchesResult.data || []).map((batch) => [
      batch.id,
      { ...batch, center: centerMap.get(batch.center_id) || null }
    ])
  );

  const playerCenters = new Map();

  (assignmentsResult.data || []).forEach((assignment) => {
    const batch = batchMap.get(assignment.batch_id);
    const center = batch?.center;

    if (!center) return;

    center.batches += 1;

    if (!playerCenters.has(assignment.player_id)) {
      playerCenters.set(assignment.player_id, new Set());
    }
    playerCenters.get(assignment.player_id).add(center.id);
  });

  playerCenters.forEach((centerIds) => {
    centerIds.forEach((centerId) => {
      const center = centerMap.get(centerId);
      if (center) center.players += 1;
    });
  });

  const todayRecordedBatchIds = new Set();

  (attendanceResult.data || []).forEach((record) => {
    const batch = batchMap.get(record.batch_id);
    const center = batch?.center;

    if (!center) return;

    if (record.attendance_date === today) {
      todayRecordedBatchIds.add(record.batch_id);
    }

    if (record.status === "present") center.attendancePresent += 1;
    if (record.status === "absent") center.attendanceAbsent += 1;
  });

  centers.forEach((center) => {
    center.attendanceRecords = center.attendancePresent + center.attendanceAbsent;
    center.attendanceRate = center.attendanceRecords
      ? Math.round((center.attendancePresent / center.attendanceRecords) * 100)
      : 0;

    const centerBatchIds = (batchesResult.data || [])
      .filter((batch) => batch.center_id === center.id)
      .map((batch) => batch.id);

    center.recordedBatches = centerBatchIds.filter((batchId) =>
      todayRecordedBatchIds.has(batchId)
    ).length;

    center.attendanceCoverage = center.batches
      ? Math.round((center.recordedBatches / center.batches) * 100)
      : 0;
  });

  const attendanceRecordsToday = (attendanceResult.data || []).filter(
    (record) => record.attendance_date === today
  );

  const presentPlayers = attendanceRecordsToday.filter(
    (record) => record.status === "present"
  ).length;

  const absentPlayers = attendanceRecordsToday.filter(
    (record) => record.status === "absent"
  ).length;

  const totalAttendanceToday = presentPlayers + absentPlayers;
  const activeBatchIds = new Set((batchesResult.data || []).map((batch) => batch.id));
  const recordedBatches = [...todayRecordedBatchIds].filter((batchId) =>
    activeBatchIds.has(batchId)
  ).length;
  const totalBatches = batchesResult.data?.length || 0;

  const dues = duesResult.data || [];
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

  const pendingDues = dues.filter(
    (due) => due.due_status === "pending"
  ).length;
  const partialDues = dues.filter(
    (due) => due.due_status === "partial"
  ).length;
  const paidDues = dues.filter(
    (due) => due.due_status === "paid"
  ).length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const collectionsThisMonth = (paymentsResult.data || []).reduce(
    (total, payment) => {
      const paymentDate = new Date(payment.payment_date);
      if (
        !Number.isNaN(paymentDate.getTime()) &&
        paymentDate >= monthStart &&
        paymentDate < nextMonthStart
      ) {
        return total + Number(payment.amount_paid || 0);
      }
      return total;
    },
    0
  );

  const outstandingAmount = Math.max(totalBilled - totalPaid, 0);
  const collectionRate = totalBilled
    ? Math.round((totalPaid / totalBilled) * 100)
    : 0;

  const attentionItems = [];

  if (totalBatches > recordedBatches) {
    attentionItems.push({
      id: "attendance-coverage",
      type: "attendance",
      tone: "warning",
      icon: "!",
      title: "Attendance not completed",
      value: totalBatches - recordedBatches,
      message: `${totalBatches - recordedBatches} active batch${totalBatches - recordedBatches === 1 ? "" : "es"} still need attendance today.`,
      to: "/attendance"
    });
  }

  if (outstandingAmount > 0) {
    attentionItems.push({
      id: "outstanding",
      type: "finance",
      tone: "danger",
      icon: "₹",
      title: "Outstanding payments",
      value: formatDashboardCurrency(outstandingAmount),
      message: `${pendingDues + partialDues} pending or partial dues require follow-up.`,
      to: "/payment-dues"
    });
  }

  centers
    .filter((center) => center.attendanceRecords > 0 && center.attendanceRate < 70)
    .sort((a, b) => a.attendanceRate - b.attendanceRate)
    .slice(0, 3)
    .forEach((center) => {
      attentionItems.push({
        id: center.id,
        type: "center-attendance",
        tone: "warning",
        icon: "⚠",
        title: `${center.name} attendance`,
        value: `${center.attendanceRate}%`,
        message: "7-day attendance is below the dashboard attention threshold.",
        to: `/batches?academyId=${academyId}&centerId=${center.id}`
      });
    });

  return {
    academyName: academyResult.data.academy_name,
    totals: {
      players: playersResult.data?.length || 0,
      centers: centers.length,
      batches: totalBatches
    },
    attendance: {
      attendanceRate: totalAttendanceToday
        ? Math.round((presentPlayers / totalAttendanceToday) * 100)
        : 0,
      presentPlayers,
      absentPlayers,
      recordedBatches,
      totalBatches,
      coveragePercentage: totalBatches
        ? Math.round((recordedBatches / totalBatches) * 100)
        : 0
    },
    financial: {
      totalBilled,
      totalPaid,
      outstandingAmount,
      collectionRate,
      pendingDues,
      partialDues,
      paidDues,
      collectionsThisMonth
    },
    centers,
    attentionItems: attentionItems.slice(0, 6),
    attendanceTrend,
    collectionsTrend
  };
}
