// PL4: Only new players inherit the complete active batch schedule.
// Existing player enrollments remain the source of truth when editing.
export function selectPlayerSessionIds({ schedules = [], enrollments = [], editing = false, batchId = "" }) {
  if (!editing) return schedules.filter(row => row.is_active !== false).map(row => row.id);
  const available = new Set(schedules.filter(row => row.is_active !== false).map(row => row.id));
  return enrollments.filter(row => row.is_active !== false &&
    row.batch_schedules?.batch_id === batchId && available.has(row.batch_schedule_id))
    .map(row => row.batch_schedule_id);
}
