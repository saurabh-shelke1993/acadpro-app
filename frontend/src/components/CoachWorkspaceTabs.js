import { NavLink } from "react-router-dom";
import "./CoachWorkspaceTabs.css";

/**
 * CMA6: Parent Portal-inspired selection cards for the existing coach workspace routes.
 * Each route still owns its independent component, data loading, and authorization.
 */
function CoachWorkspaceTabs() {
  return (
    <nav className="coach-workspace-tabs" aria-label="Coaches and assignments views">
      <h1 className="coach-workspace-tabs-title">Coaches &amp; Assignments</h1>
      <div className="coach-workspace-tabs-links">
        <NavLink
          to="/coaches"
          end
          aria-label="Coach Directory"
          className={({ isActive }) =>
            `coach-workspace-tab${isActive ? " coach-workspace-tab-active" : ""}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="coach-workspace-card-avatar" aria-hidden="true">C</span>
              <span className="coach-workspace-card-content">
                <span className="coach-workspace-card-name">Coach Directory</span>
                <span className="coach-workspace-card-context">Manage coach profiles</span>
              </span>
              {isActive && (
                <span className="coach-workspace-selected-badge" aria-hidden="true">Selected</span>
              )}
            </>
          )}
        </NavLink>
        <NavLink
          to="/coach-batch-mapping"
          end
          aria-label="Batch Assignments"
          className={({ isActive }) =>
            `coach-workspace-tab${isActive ? " coach-workspace-tab-active" : ""}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="coach-workspace-card-avatar" aria-hidden="true">B</span>
              <span className="coach-workspace-card-content">
                <span className="coach-workspace-card-name">Batch Assignments</span>
                <span className="coach-workspace-card-context">Manage training assignments</span>
              </span>
              {isActive && (
                <span className="coach-workspace-selected-badge" aria-hidden="true">Selected</span>
              )}
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}

export default CoachWorkspaceTabs;
