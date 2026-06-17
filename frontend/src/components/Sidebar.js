import { Link, useNavigate } from "react-router-dom";

import {
  logoutUser,
} from "../utils/auth";

import {
  isSuperAdmin,
  isCoach,
} from "../utils/roles";

function Sidebar() {

  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem("acadpro_user")
  );

  const handleLogout = async () => {

    await logoutUser();

    navigate("/login");
  };

  return (

    <div
      style={{
        width: "280px",
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        color: "white",
        padding: "20px",
      }}
    >

      {/* LOGO */}

      <h1
        style={{
          marginBottom: "40px",
        }}
      >
        AcadPro
      </h1>

      {/* ========================================= */}
      {/* COACH SIDEBAR */}
      {/* ========================================= */}

      {
        isCoach(user) ? (

          <>

            <SidebarLink
              to="/coach-dashboard"
              label="Dashboard"
            />

            <SidebarLink
              to="/coach-attendance"
              label="Coach Attendance"
            />

            <SidebarLink
              to="/attendance-history"
              label="Attendance History"
            />

          </>

        ) : (

          <>
            {/* DASHBOARD */}

            <SidebarLink
              to="/dashboard"
              label="Dashboard"
            />

            {/* SUPER ADMIN ONLY */}

            {
              isSuperAdmin(user) && (

                <SidebarLink
                  to="/academy"
                  label="Academies"
                />
              )
            }

            {/* COMMON ADMIN MODULES */}

            <SidebarLink
              to="/centers"
              label="Centers"
            />

            <SidebarLink
              to="/batches"
              label="Batches"
            />

            <SidebarLink
              to="/players"
              label="Players"
            />

            <SidebarLink
              to="/attendance"
              label="Attendance"
            />

            <SidebarLink
              to="/attendance-history"
              label="Attendance History"
            />

            <SidebarLink
              to="/coaches"
              label="Coaches"
            />

            <SidebarLink
              to="/coach-batch-mapping"
              label="Coach Batch Mapping"
            />

            <SidebarLink
              to="/subscription-plans"
              label="Subscription Plans"
            />

            <SidebarLink
              to="/player-subscriptions"
              label="Player Subscriptions"
            />

            <SidebarLink
              to="/payment-dues"
              label="Payment Dues"
            />

            <SidebarLink
              to="/payment-collections"
              label="Payment Collections"
            />

          </>
        )
      }

      {/* ========================================= */}
      {/* LOGOUT */}
      {/* ========================================= */}

      <button
        onClick={handleLogout}
        style={{
          marginTop: "40px",
          width: "100%",
          padding: "12px",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Logout
      </button>

    </div>
  );
}

// =========================================
// REUSABLE SIDEBAR LINK
// =========================================

function SidebarLink({
  to,
  label
}) {

  return (

    <div
      style={{
        marginBottom: "18px",
      }}
    >

      <Link
        to={to}
        style={{
          color: "white",
          textDecoration: "none",
          fontSize: "17px",
          fontWeight: "500",
        }}
      >
        {label}
      </Link>

    </div>
  );
}

export default Sidebar;