import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  getCurrentUser,
  logoutUser,
  isSuperAdmin,
} from "../utils/auth";

function Dashboard() {
  const [user, setUser] = useState(null);

  const [totalPlayers, setTotalPlayers] = useState(0);
  const [totalCenters, setTotalCenters] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [todayAttendance, setTodayAttendance] = useState(0);

  const [loading, setLoading] = useState(true);

  // =====================================================
  // LOAD USER
  // =====================================================

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();

      console.log("Dashboard User:", currentUser);

      setUser(currentUser);
    } catch (err) {
      console.log(err.message);
    }
  };

  // =====================================================
  // FETCH DASHBOARD DATA
  // =====================================================

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // =====================================================
      // PLAYERS COUNT
      // =====================================================

      let playersQuery = supabase
        .from("players")
        .select("*", {
          count: "exact",
          head: true,
        });

      if (!isSuperAdmin(user)) {
        playersQuery = playersQuery.eq(
          "academy_id",
          user.academy_id
        );
      }

      const { count: playersCount, error: playersError } =
        await playersQuery;

      if (playersError) throw playersError;

      setTotalPlayers(playersCount || 0);

      // =====================================================
      // CENTERS COUNT
      // =====================================================

      let centersQuery = supabase
        .from("centers")
        .select("*", {
          count: "exact",
          head: true,
        });

      if (!isSuperAdmin(user)) {
        centersQuery = centersQuery.eq(
          "academy_id",
          user.academy_id
        );
      }

      const { count: centersCount, error: centersError } =
        await centersQuery;

      if (centersError) throw centersError;

      setTotalCenters(centersCount || 0);

      // =====================================================
      // BATCHES COUNT
      // =====================================================

      let batchesQuery = supabase
        .from("batches")
        .select("*", {
          count: "exact",
          head: true,
        });

      if (!isSuperAdmin(user)) {
        batchesQuery = batchesQuery.eq(
          "academy_id",
          user.academy_id
        );
      }

      const { count: batchesCount, error: batchesError } =
        await batchesQuery;

      if (batchesError) throw batchesError;

      setTotalBatches(batchesCount || 0);

      // =====================================================
      // TODAY ATTENDANCE
      // =====================================================

      const today = new Date()
        .toISOString()
        .split("T")[0];

      let attendanceQuery = supabase
        .from("attendance")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("attendance_date", today);

      if (!isSuperAdmin(user)) {
        attendanceQuery = attendanceQuery.eq(
          "academy_id",
          user.academy_id
        );
      }

      const {
        count: attendanceCount,
        error: attendanceError,
      } = await attendanceQuery;

      if (attendanceError) throw attendanceError;

      setTodayAttendance(attendanceCount || 0);

      setLoading(false);
    } catch (err) {
      console.log(err.message);
      setLoading(false);
    }
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div style={{ padding: "20px" }}>
        <h2>Loading Dashboard...</h2>
      </div>
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        <div>
          <h1>Dashboard</h1>

          <p>
            Welcome, {user?.full_name}
          </p>

          <p>
            Role: {user?.role}
          </p>
        </div>

        <button onClick={logoutUser}>
          Logout
        </button>
      </div>

      {/* DASHBOARD CARDS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
        }}
      >
        {/* PLAYERS */}

        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            borderRadius: "10px",
          }}
        >
          <h2>Total Players</h2>

          <h1>{totalPlayers}</h1>
        </div>

        {/* CENTERS */}

        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            borderRadius: "10px",
          }}
        >
          <h2>Total Centers</h2>

          <h1>{totalCenters}</h1>
        </div>

        {/* BATCHES */}

        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            borderRadius: "10px",
          }}
        >
          <h2>Total Batches</h2>

          <h1>{totalBatches}</h1>
        </div>

        {/* ATTENDANCE */}

        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            borderRadius: "10px",
          }}
        >
          <h2>Today's Attendance</h2>

          <h1>{todayAttendance}</h1>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;