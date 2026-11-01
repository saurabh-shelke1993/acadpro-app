// Stable academy → center → earliest weekday → start-time order for Batch List.
export const compareBatchListRows = (left, right, schedules = {}, centers = []) => {
  const academy = String(left.academies?.academy_name || "").localeCompare(
    String(right.academies?.academy_name || ""), undefined, { sensitivity: "base" }
  );
  if (academy) return academy;
  const centerName = (batch) => batch.centers?.center_name ||
    centers.find((center) => center.id === batch.center_id)?.center_name || "";
  const center = centerName(left).localeCompare(centerName(right), undefined, { sensitivity: "base" });
  if (center) return center;
  const firstSession = (batch) => {
    const sorted = [...(schedules[batch.id] || [])].sort((a, b) =>
      Number(a.dayOfWeek) - Number(b.dayOfWeek) ||
      String(a.startTime || "").localeCompare(String(b.startTime || ""))
    );
    return sorted[0] || null;
  };
  const a = firstSession(left), b = firstSession(right);
  if (a && !b) return -1;
  if (!a && b) return 1;
  if (a && b) {
    const day = Number(a.dayOfWeek) - Number(b.dayOfWeek);
    if (day) return day;
    const time = String(a.startTime || "").localeCompare(String(b.startTime || ""));
    if (time) return time;
  }
  return String(left.batch_name || "").localeCompare(String(right.batch_name || ""), undefined, { sensitivity: "base" }) ||
    String(left.id).localeCompare(String(right.id));
};
