import { NavLink } from "react-router-dom";
import "./CoachWorkspaceTabs.css";

/**
 * CMA1: A shared navigation shell for the two existing coach management routes.
 * Each route keeps its own component, data loading, and authorization.
 */
function CoachWorkspaceTabs() {
  return (
    <nav className="coach-workspace-tabs" aria-label="Coaches and assignments views">
      <h1 className="coach-workspace-tabs-title">Coaches &amp; Assignments</h1>
      <div className="coach-workspace-tabs-links">
        <NavLink
          to="/coaches"
          end
          className={({ isActive }) =>
            `coach-workspace-tab${isActive ? " coach-workspace-tab-active" : ""}`
          }
        >
          Coach Directory
        </NavLink>
        <NavLink
          to="/coach-batch-mapping"
          end
          className={({ isActive }) =>
            `coach-workspace-tab${isActive ? " coach-workspace-tab-active" : ""}`
          }
        >
          Batch Assignments
        </NavLink>
      </div>
    </nav>
  );
}

export default CoachWorkspaceTabs;
