import { Link, useLocation } from "react-router-dom";
import "./AttendanceWorkspaceTabs.css";

const ALLOWED_ROLES = new Set(["super_admin", "academy_owner", "coach"]);

/**
 * AM5: Accessible view links for the canonical Attendance workspace.
 * These are links, not tab panels; each view preserves its own scoped data flow.
 */
function AttendanceWorkspaceTabs({ role }) {
  const location = useLocation();
  if (!ALLOWED_ROLES.has(role)) return null;

  const canMark = role === "academy_owner" || role === "coach";
  const requested = new URLSearchParams(location.search).get("view");
  const selectedView = location.pathname === "/attendance-history"
    ? "history"
    : location.pathname === "/coach-attendance" ? "mark"
      : role === "super_admin" ? "history" : requested === "history" ? "history" : "mark";
  const isMark = canMark && selectedView === "mark";
  const isHistory = selectedView === "history";

  return (
    <nav className="attendance-workspace-nav" aria-label="Attendance views">
      <div className={`attendance-workspace-views${canMark ? "" : " attendance-workspace-views-single"}`}>
        {canMark && (
          <Link
            to="/attendance?view=mark"
            aria-label="Mark Attendance"
            aria-current={isMark ? "page" : undefined}
            className={`attendance-workspace-view${isMark ? " attendance-workspace-view-active" : ""}`}
          >
            <span className="attendance-workspace-view-icon" aria-hidden="true">✓</span>
            <span className="attendance-workspace-view-copy">
              <strong>Mark Attendance</strong>
              <small>Record attendance for a training session</small>
            </span>
            {isMark && <span className="attendance-workspace-view-selected" aria-hidden="true">Selected</span>}
          </Link>
        )}
        <Link
          to="/attendance?view=history"
          aria-label="Attendance History"
          aria-current={isHistory ? "page" : undefined}
          className={`attendance-workspace-view${isHistory ? " attendance-workspace-view-active" : ""}`}
        >
          <span className="attendance-workspace-view-icon" aria-hidden="true">◷</span>
          <span className="attendance-workspace-view-copy">
            <strong>Attendance History</strong>
            <small>Review recorded attendance and permitted corrections</small>
          </span>
          {isHistory && <span className="attendance-workspace-view-selected" aria-hidden="true">Selected</span>}
        </Link>
      </div>
    </nav>
  );
}

export default AttendanceWorkspaceTabs;
