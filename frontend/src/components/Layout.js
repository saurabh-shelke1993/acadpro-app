import { Link, useNavigate } from "react-router-dom";

import {
  isSuperAdmin,
  logoutUser,
} from "../utils/auth";

function Sidebar() {

  const navigate = useNavigate();

  const handleLogout = () => {

    logoutUser();

    navigate("/login");
  };

  return (

    <div
      style={{
        width: "250px",
        background: "#e2e8f0",
        color: "white",
        minHeight: "100vh",
        padding: "20px",
      }}
    >

      <h2>AcadPro</h2>

      <hr />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          marginTop: "20px",
        }}
      >

        <Link
          to="/dashboard"
          style={linkStyle}
        >
          Dashboard
        </Link>

        {
          isSuperAdmin() && (

            <Link
              to="/academy"
              style={linkStyle}
            >
              Academies
            </Link>
          )
        }

        <Link
          to="/centers"
          style={linkStyle}
        >
          Centers
        </Link>

        <Link
          to="/batches"
          style={linkStyle}
        >
          Batches
        </Link>

        <Link
          to="/players"
          style={linkStyle}
        >
          Players
        </Link>

        <Link
          to="/attendance"
          style={linkStyle}
        >
          Attendance
        </Link>

        <Link
          to="/attendance-history"
          style={linkStyle}
        >
          Attendance History
        </Link>

        <Link
          to="/subscription-plans"
          style={linkStyle}
        >
          Subscription Plans
        </Link>

        <Link
          to="/player-subscriptions"
          style={linkStyle}
        >
          Player Subscriptions
        </Link>

        <Link
          to="/payment-dues"
          style={linkStyle}
        >
          Payment Dues
        </Link>

        <Link
          to="/payment-collections"
          style={linkStyle}
        >
          Payment Collections
        </Link>

        <button
          onClick={handleLogout}
          style={{
            marginTop: "20px",
            padding: "10px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>

      </div>

    </div>
  );
}

const linkStyle = {
  color: "white",
  textDecoration: "none",
  fontSize: "16px",
};

export default Sidebar;