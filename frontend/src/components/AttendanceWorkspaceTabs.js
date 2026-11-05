import { NavLink } from "react-router-dom";
import "./AttendanceWorkspaceTabs.css";

const ALLOWED_ROLES = new Set(["super_admin", "academy_owner", "coach"]);

/**
 * AM1: One visual Attendance workspace over the existing three protected routes.
 *
 * Do not combine data queries or attendance mutations here. In particular,
 * Super Admin may review history, but must not be offered a marking action.
 * Parent attendance remains in the read-only Parent Portal.
 */
function AttendanceWorkspaceTabs({ role }) {
  if (!ALLOWED_ROLES.has(role)) return null;

  const canMark = role === "academy_owner" || role === "coach";
  const markRoute = role === "coach" ? "/coach-attendance" : "/attendance";

  return (
    <nav className="attendance-workspace-nav" aria-label="Attendance views">
      <div className={`attendance-workspace-views${canMark ? "" : " attendance-workspace-views-single"}`}>
        {canMark && (
          <NavLink
            to={markRoute}
            end
            aria-label="Mark Attendance"
            className={({ isActive }) =>
              `attendance-workspace-view${isActive ? " attendance-workspace-view-active" : ""}`
            }
          >
            {({ isActive }) => (
              <>
                <span className="attendance-workspace-view-icon" aria-hidden="true">✓</span>
                <span className="attendance-workspace-view-copy">
                  <strong>Mark Attendance</strong>
                  <small>Record attendance for a training session</small>
                </span>
                {isActive && <span className="attendance-workspace-view-selected" aria-hidden="true">Selected</span>}
              </>
            )}
          </NavLink>
        )}
        <NavLink
          to="/attendance-history"
          end
          aria-label="Attendance History"
          className={({ isActive }) =>
            `attendance-workspace-view${isActive ? " attendance-workspace-view-active" : ""}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="attendance-workspace-view-icon" aria-hidden="true">◷</span>
              <span className="attendance-workspace-view-copy">
                <strong>Attendance History</strong>
                <small>Review recorded attendance and permitted corrections</small>
              </span>
              {isActive && <span className="attendance-workspace-view-selected" aria-hidden="true">Selected</span>}
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}

export default AttendanceWorkspaceTabs;
