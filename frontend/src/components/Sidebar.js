import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logoutUser } from "../utils/auth";
import { isCoach, isParent, isSuperAdmin } from "../utils/roles";
import { supabase } from "../supabaseClient";

function Sidebar({ isOpen = false, onClose = () => {}, closeButtonRef }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("acadpro_user"));
  const [academy, setAcademy] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadAcademy = async () => {
      if (!user?.academy_id) {
        setAcademy(null);
        return;
      }

      const { data, error } = await supabase
        .from("academies")
        .select("id, academy_name, academy_logo")
        .eq("id", user.academy_id)
        .maybeSingle();

      if (!error && mounted) {
        setAcademy(data || null);
      }
    };

    loadAcademy();

    return () => {
      mounted = false;
    };
  }, [user?.academy_id]);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    `app-nav-link${isActive ? " app-nav-link-active" : ""}`;

  const renderLink = (to, label, icon) => (
    <NavLink to={to} className={linkClass} onClick={onClose}>
      <span className="app-nav-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );

  return (
    <>
      <div
        className={`app-sidebar-overlay${isOpen ? " app-sidebar-overlay-visible" : ""}`}
        aria-hidden="true"
        onClick={onClose}
      />

      <aside
        id="acadpro-sidebar"
        className={`app-sidebar${isOpen ? " app-sidebar-open" : ""}`}
        aria-label="Sidebar navigation"
      >
        <div className="app-brand">
          <div className="app-brand-mark" aria-hidden="true">⚽</div>
          <div>
            <div className="app-brand-name">AcadPro</div>
            <div className="app-brand-caption">
              {academy?.academy_name || "Academy management"}
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="app-sidebar-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            ×
          </button>
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
              {renderLink("/parent-portal", "Parent Portal", "⌂")}
              {renderLink("/parent-financial-overview", "Financial Overview", "₹")}
              {renderLink("/player-performance-report", "Performance Report", "▥")}
            </>
          ) : (
            <>
              <div className="app-nav-group-title">Overview</div>
              {renderLink("/dashboard", "Dashboard", "⌂")}
              {renderLink("/analytics", "Analytics", "▥")}

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
            <span className="app-user-avatar" aria-hidden="true">
              {academy?.academy_logo ? (
                <img
                  src={academy.academy_logo}
                  alt=""
                  className="app-user-avatar-logo"
                />
              ) : (
                academy?.academy_name
                  ? academy.academy_name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part.charAt(0))
                      .join("")
                      .toUpperCase()
                  : (user?.full_name || user?.email || "U").charAt(0).toUpperCase()
              )}
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
    </>
  );
}

export default Sidebar;
