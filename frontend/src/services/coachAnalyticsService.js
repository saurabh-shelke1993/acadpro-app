import { supabase } from "../supabaseClient";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const iso = date => date.toISOString().slice(0, 10);
const weekday = date => { const day = date.getUTCDay(); return day === 0 ? 7 : day; };

export const getCoachAnalytics = async academyId => {
  if (!academyId) throw new Error("Academy scope is required.");
  const [coachesResult, assignmentsResult, legacyResult] = await Promise.all([
    supabase.from("coaches").select("id,full_name").eq("academy_id", academyId).eq("is_active", true).order("full_name"),
    supabase.from("coach_batch_schedule_assignments").select("id,coach_id,batch_schedule_id,assigned_from,assigned_until,is_active,batch_schedules(id,batch_id,center_id,day_of_week,start_time,end_time,is_active,centers(center_name),batches(batch_name,is_active))").eq("academy_id", academyId).eq("is_active", true),
    supabase.from("coach_batch_assignments").select("coach_id,batch_id,is_active").eq("academy_id", academyId).eq("is_active", true)
  ]);
  for (const result of [coachesResult, assignmentsResult, legacyResult]) if (result.error) throw result.error;
  const legacy = new Map();
  for (const row of legacyResult.data || []) {
    if (!legacy.has(row.coach_id)) legacy.set(row.coach_id, new Set());
    legacy.get(row.coach_id).add(row.batch_id);
  }
  return (coachesResult.data || []).map(coach => ({
    id: coach.id,
    name: coach.full_name || "Unnamed coach",
    legacyBatchCount: legacy.get(coach.id)?.size || 0,
    assignments: (assignmentsResult.data || [])
      .filter(row => row.coach_id === coach.id && row.batch_schedules?.is_active && row.batch_schedules?.batches?.is_active)
      .map(row => ({
        id: row.id, centerId: row.batch_schedules.center_id, batchId: row.batch_schedules.batch_id,
        centerName: row.batch_schedules.centers?.center_name || "Unknown center",
        batchName: row.batch_schedules.batches?.batch_name || "Unknown batch",
        dayOfWeek: Number(row.batch_schedules.day_of_week),
        dayName: dayNames[Number(row.batch_schedules.day_of_week) % 7],
        startTime: row.batch_schedules.start_time, endTime: row.batch_schedules.end_time,
        assignedFrom: row.assigned_from, assignedUntil: row.assigned_until
      }))
  }));
};

export const getCoachMonthStats = (assignments, month) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || "")) return { weekly: 0, monthly: 0 };
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const last = new Date(Date.UTC(year, number, 0));
  const today = new Date();
  const todayIso = iso(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
  const active = assignments.filter(a => (!a.assignedFrom || a.assignedFrom <= todayIso) && (!a.assignedUntil || a.assignedUntil >= todayIso));
  const weekly = active.length;
  let monthly = 0;
  for (let d = new Date(first); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = iso(d);
    monthly += assignments.filter(a => a.dayOfWeek === weekday(d) && (!a.assignedFrom || a.assignedFrom <= date) && (!a.assignedUntil || a.assignedUntil >= date)).length;
  }
  return { weekly, monthly };
};
