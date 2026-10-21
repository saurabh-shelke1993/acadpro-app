import { supabase } from "./supabase";

const DAY_NAMES = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const getLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonthWindow = (now = new Date()) => {
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const months = Array.from({ length: 3 }, (_, index) => {
    const monthDate = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      label: monthDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      amount: 0,
    };
  });
  return { start: getLocalDate(start), end: getLocalDate(end), months };
};

const formatTime = (value) => {
  if (!value) return "";
  const [hourText, minuteText] = String(value).slice(0, 5).split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minuteText} ${hour >= 12 ? "PM" : "AM"}`;
};

export const getPlayerProfileSnapshot = async (playerId, { includeFees = false } = {}) => {
  if (!playerId) throw new Error("Player ID is required.");

  const [scheduleResult, attendanceResult] = await Promise.all([
    supabase
      .from("player_batch_schedules")
      .select(`
        id,
        is_active,
        enrolled_from,
        enrolled_until,
        batch_schedules!inner(
          id,
          batch_id,
          day_of_week,
          start_time,
          end_time,
          is_active,
          centers(center_name),
          batches(batch_name)
        )
      `)
      .eq("player_id", playerId)
      .eq("is_active", true)
      .eq("batch_schedules.is_active", true),
    supabase
      .from("attendance")
      .select("status, is_deleted")
      .eq("player_id", playerId)
      .eq("is_deleted", false),
  ]);

  if (scheduleResult.error) throw scheduleResult.error;
  if (attendanceResult.error) throw attendanceResult.error;

  const schedule = (scheduleResult.data || [])
    .filter((enrollment) => enrollment.batch_schedules)
    .map((enrollment) => ({
      id: enrollment.id,
      day: DAY_NAMES[Number(enrollment.batch_schedules.day_of_week)] || "Day",
      startTime: enrollment.batch_schedules.start_time,
      endTime: enrollment.batch_schedules.end_time,
      centerName: enrollment.batch_schedules.centers?.center_name || "—",
      batchName: enrollment.batch_schedules.batches?.batch_name || "—",
    }))
    .sort((a, b) =>
      (Object.keys(DAY_NAMES).find((key) => DAY_NAMES[key] === a.day) || 8) -
        (Object.keys(DAY_NAMES).find((key) => DAY_NAMES[key] === b.day) || 8) ||
      String(a.startTime || "").localeCompare(String(b.startTime || ""))
    );

  const attendanceRows = attendanceResult.data || [];
  const present = attendanceRows.filter((row) => row.status === "present").length;
  const absent = attendanceRows.filter((row) => row.status === "absent").length;
  const eligibleAttendance = present + absent;
  const attendanceRate = eligibleAttendance
    ? Math.round((present / eligibleAttendance) * 100)
    : null;

  let monthlyPayments = [];
  if (includeFees) {
    const window = getMonthWindow();
    const { data: payments, error: paymentError } = await supabase
      .from("payments")
      .select("payment_date, amount_paid, payment_entry_type, related_payment_id")
      .eq("player_id", playerId)
      .gte("payment_date", window.start)
      .lt("payment_date", window.end)
      .order("payment_date", { ascending: true });

    if (paymentError) throw paymentError;

    const totals = new Map(window.months.map((month) => [month.key, 0]));
    (payments || []).forEach((payment) => {
      if (!payment.payment_date) return;
      const key = String(payment.payment_date).slice(0, 7);
      if (!totals.has(key)) return;
      // The ledger stores approved corrections as signed adjustment entries.
      // Sum each ledger entry once, in the month its own payment_date belongs to.
      const amount = Number(payment.amount_paid || 0);
      totals.set(key, totals.get(key) + amount);
    });
    monthlyPayments = window.months.map((month) => ({
      ...month,
      amount: totals.get(month.key) || 0,
      formattedAmount: formatMoney(totals.get(month.key) || 0),
    }));
  }

  return {
    schedule: schedule.map((session) => ({
      ...session,
      timeLabel: [formatTime(session.startTime), formatTime(session.endTime)].filter(Boolean).join(" – "),
    })),
    attendance: {
      present,
      absent,
      recordedSessions: eligibleAttendance,
      rate: attendanceRate,
    },
    monthlyPayments,
  };
};
