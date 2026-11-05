/** One shared, compact live tally above the marking roster. */
export default function AttendanceRosterSummary({ totals }) {
  return (
    <div className="attendance-roster-summary" aria-label="Attendance summary">
      <div className="attendance-roster-stat">
        <span>Total</span><strong>{totals.total}</strong>
      </div>
      <div className="attendance-roster-stat attendance-roster-stat-present">
        <span>Present</span><strong>{totals.present}</strong>
      </div>
      <div className="attendance-roster-stat attendance-roster-stat-absent">
        <span>Absent</span><strong>{totals.absent}</strong>
      </div>
      <div className="attendance-roster-stat attendance-roster-stat-unmarked">
        <span>Unmarked</span><strong>{totals.unmarked}</strong>
      </div>
    </div>
  );
}
