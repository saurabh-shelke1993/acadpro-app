import { useEffect, useState }
from "react";

import { supabase }
from "../supabaseClient";

import Layout
from "../components/Layout";

import {
  getCurrentUser,
  isSuperAdmin,
}
from "../utils/auth";

function Dashboard() {

  const [user,
    setUser] =
    useState(null);

  const [totalPlayers,
    setTotalPlayers] =
    useState(0);

  const [totalCenters,
    setTotalCenters] =
    useState(0);

  const [totalBatches,
    setTotalBatches] =
    useState(0);

  const [todayAttendance,
    setTodayAttendance] =
    useState(0);

  const [loading,
    setLoading] =
    useState(true);

  // =========================================
  // LOAD USER
  // =========================================

  useEffect(() => {

    loadUser();

  }, []);

  const loadUser =
    async () => {

      try {

        const currentUser =
          await getCurrentUser();

        setUser(currentUser);

      } catch (err) {

        console.log(err.message);
      }
    };

  // =========================================
  // FETCH DASHBOARD DATA
  // =========================================

  useEffect(() => {

    if (user) {

      fetchDashboardData();
    }

  }, [user]);

  const fetchDashboardData =
    async () => {

      try {

        setLoading(true);

        // PLAYERS

        let playersQuery =
          supabase
            .from("players")
            .select("*", {
              count: "exact",
              head: true,
            });

        if (!isSuperAdmin(user)) {

          playersQuery =
            playersQuery.eq(
              "academy_id",
              user.academy_id
            );
        }

        const {
          count: playersCount
        } =
          await playersQuery;

        setTotalPlayers(
          playersCount || 0
        );

        // CENTERS

        let centersQuery =
          supabase
            .from("centers")
            .select("*", {
              count: "exact",
              head: true,
            });

        if (!isSuperAdmin(user)) {

          centersQuery =
            centersQuery.eq(
              "academy_id",
              user.academy_id
            );
        }

        const {
          count: centersCount
        } =
          await centersQuery;

        setTotalCenters(
          centersCount || 0
        );

        // BATCHES

        let batchesQuery =
          supabase
            .from("batches")
            .select("*", {
              count: "exact",
              head: true,
            });

        if (!isSuperAdmin(user)) {

          batchesQuery =
            batchesQuery.eq(
              "academy_id",
              user.academy_id
            );
        }

        const {
          count: batchesCount
        } =
          await batchesQuery;

        setTotalBatches(
          batchesCount || 0
        );

        // ATTENDANCE

        const today =
          new Date()
            .toISOString()
            .split("T")[0];

        let attendanceQuery =
          supabase
            .from("attendance")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq(
              "attendance_date",
              today
            );

        if (!isSuperAdmin(user)) {

          attendanceQuery =
            attendanceQuery.eq(
              "academy_id",
              user.academy_id
            );
        }

        const {
          count: attendanceCount
        } =
          await attendanceQuery;

        setTodayAttendance(
          attendanceCount || 0
        );

      } catch (err) {

        console.log(err.message);

      } finally {

        setLoading(false);
      }
    };

  // =========================================
  // LOADING
  // =========================================

  if (loading) {

    return (

      <Layout>

        <h2>
          Loading Dashboard...
        </h2>

      </Layout>
    );
  }

  // =========================================
  // UI
  // =========================================

  return (

    <Layout>

      <div>

        <h1>
          Dashboard
        </h1>

        <p>
          Welcome,
          {" "}
          {user?.full_name}
        </p>

        <p>
          Role:
          {" "}
          {user?.role}
        </p>

        {/* DASHBOARD CARDS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
            marginTop: "30px",
          }}
        >

          <DashboardCard
            title="Total Players"
            value={totalPlayers}
          />

          <DashboardCard
            title="Total Centers"
            value={totalCenters}
          />

          <DashboardCard
            title="Total Batches"
            value={totalBatches}
          />

          <DashboardCard
            title="Today's Attendance"
            value={todayAttendance}
          />

        </div>

      </div>

    </Layout>
  );
}

// =========================================
// DASHBOARD CARD
// =========================================

function DashboardCard({
  title,
  value
}) {

  return (

    <div
      style={{
        background: "white",
        padding: "25px",
        borderRadius: "12px",
        boxShadow:
          "0 2px 10px rgba(0,0,0,0.1)",
      }}
    >

      <h3>
        {title}
      </h3>

      <h1>
        {value}
      </h1>

    </div>
  );
}

export default Dashboard;