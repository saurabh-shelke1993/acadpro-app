import { NavLink, useNavigate } from "react-router-dom";
import { logoutUser } from "../utils/auth";
import { isCoach, isParent, isSuperAdmin } from "../utils/roles";

function Sidebar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("acadpro_user"));

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    `app-nav-link${isActive ? " app-nav-link-active" : ""}`;

  const renderLink = (to, label, icon) => (
    <NavLink to={to} className={linkClass}>
      <span className="app-nav-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );

  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <div className="app-brand-mark">⚽</div>
        <div>
          <div className="app-brand-name">AcadPro</div>
          <div className="app-brand-caption">Academy management</div>
        </div>
      </div>

      <nav className="app-nav" aria-label="Primary navigation">
        {isCoach(user) ? (
          <>
            <div className="app-nav-group-title">Overview</div>
            {renderLink("/coach-dashboard", "Dashboard", "⌂")}

            <div className="app-nav-group-title">Coaching</div>
            {renderLink("/coach-attendance", "Attendance", "✓")}
            {renderLink("/coach-performance-assessments", "Performance Assessments", "◈")}
            {renderLink("/player-performance-report", "Performance Report", "▥")}
            {renderLink("/attendance-history", "Attendance History", "◷")}

            <div className="app-nav-group-title">Academy</div>
            {renderLink("/centers", "Centers", "⌂")}
            {renderLink("/batches", "Batches", "◆")}
            {renderLink("/players", "Players", "●")}
          </>
        ) : isParent(user) ? (
          <>
            <div className="app-nav-group-title">My Family</div>
            {renderLink("/player-performance-report", "Performance Report", "▥")}
          </>
        ) : (
          <>
            <div className="app-nav-group-title">Overview</div>
            {renderLink("/dashboard", "Dashboard", "⌂")}

            <div className="app-nav-group-title">Academy</div>
            {isSuperAdmin(user) && renderLink("/academy", "Academies", "▦")}
            {renderLink("/centers", "Centers", "⌂")}
            {renderLink("/batches", "Batches", "◆")}
            {renderLink("/players", "Players", "●")}
            {renderLink("/coaches", "Coaches", "♟")}
            {renderLink("/coach-batch-mapping", "Coach Batch Mapping", "↔")}

            <div className="app-nav-group-title">Performance</div>
            {renderLink("/player-performance-report", "Performance Report", "▥")}
            {renderLink("/coach-performance-assessments", "Performance Assessments", "◈")}
            {renderLink("/attendance", "Attendance", "✓")}
            {renderLink("/attendance-history", "Attendance History", "◷")}

            <div className="app-nav-group-title">Finance</div>
            {renderLink("/subscription-plans", "Subscription Plans", "◇")}
            {renderLink("/player-subscriptions", "Player Subscriptions", "▤")}
            {renderLink("/payment-dues", "Payment Dues", "₹")}
            {renderLink("/payment-collections", "Payment Collections", "↗")}
          </>
        )}
      </nav>

      <div className="app-sidebar-footer">
        <div className="app-user-chip">
          <span className="app-user-avatar">
            {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
          </span>
          <div className="app-user-meta">
            <strong>{user?.full_name || "User"}</strong>
            <span>{user?.role?.replaceAll("_", " ") || ""}</span>
          </div>
        </div>

        <button type="button" className="app-logout" onClick={handleLogout}>
          <span aria-hidden="true">↪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
