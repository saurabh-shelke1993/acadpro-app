// Display-only fallback until the center_code migration is approved.
export const suggestCenterCode = (name = "") => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  return (words.length > 1 ? words.slice(0, 2).map(word => word[0]).join("") : words[0].slice(0, 2)).toUpperCase();
};

export const groupCoachesByCenter = (assignments = [], academyId = "") => {
  const groups = new Map();
  for (const assignment of assignments) {
    const schedule = assignment.batch_schedules;
    const coach = assignment.coaches;
    if (!assignment.is_active || !schedule?.is_active || !coach?.is_active ||
        !schedule.center_id || !coach.id ||
        (academyId && assignment.academy_id !== academyId)) continue;
    if (!groups.has(schedule.center_id)) groups.set(schedule.center_id, new Map());
    groups.get(schedule.center_id).set(coach.id, { id: coach.id, name: coach.full_name || "Unnamed coach" });
  }
  return Object.fromEntries([...groups].map(([centerId, coaches]) =>
    [centerId, [...coaches.values()].sort((a, b) => a.name.localeCompare(b.name))]));
};
