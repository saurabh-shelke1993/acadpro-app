import { NavLink } from "react-router-dom";
import "./PerformanceWorkspaceTabs.css";

const MANAGEMENT_ROLES = new Set(["super_admin", "academy_owner", "coach"]);

/**
 * PM1: Shared navigation over existing independent performance routes.
 * Parents retain their existing report-only experience and cannot see assessment controls.
 */
function PerformanceWorkspaceTabs({ role }) {
  if (!MANAGEMENT_ROLES.has(role)) return null;

  return (
    <nav className="performance-workspace-tabs" aria-label="Player performance views">
      <h1 className="performance-workspace-tabs-title">Player Performance</h1>
      <div className="performance-workspace-tabs-links">
        <NavLink
          to="/player-performance-report"
          end
          aria-label="Performance Report"
          className={({ isActive }) =>
            `performance-workspace-tab${isActive ? " performance-workspace-tab-active" : ""}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="performance-workspace-card-avatar" aria-hidden="true">R</span>
              <span className="performance-workspace-card-content">
                <span className="performance-workspace-card-name">Performance Report</span>
                <span className="performance-workspace-card-context">Scores, trends and player progress</span>
              </span>
              {isActive && <span className="performance-workspace-selected-badge" aria-hidden="true">Selected</span>}
            </>
          )}
        </NavLink>
        <NavLink
          to="/coach-performance-assessments"
          end
          aria-label="Performance Assessments"
          className={({ isActive }) =>
            `performance-workspace-tab${isActive ? " performance-workspace-tab-active" : ""}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="performance-workspace-card-avatar" aria-hidden="true">A</span>
              <span className="performance-workspace-card-content">
                <span className="performance-workspace-card-name">Performance Assessments</span>
                <span className="performance-workspace-card-context">Record and manage evaluations</span>
              </span>
              {isActive && <span className="performance-workspace-selected-badge" aria-hidden="true">Selected</span>}
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}

export default PerformanceWorkspaceTabs;
