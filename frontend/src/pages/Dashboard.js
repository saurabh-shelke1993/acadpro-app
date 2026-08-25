import { useEffect, useState } from "react";
import DashboardCard from "../components/Dashboard/DashboardCard";
import DashboardCharts from "../components/DashboardCharts";
import Layout from "../components/Layout";
import { getDashboardSummary } from "../services/dashboardService";
import "../styles/dashboard.css";
import { getCurrentUser } from "../utils/auth";

const initialSummary = {
  totalPlayers: 0,
  totalCenters: 0,
  totalBatches: 0,
  totalAcademies: 0,
  attendanceTaken: 0,
  presentPlayers: 0,
  absentPlayers: 0,
  attendancePercentage: 0,
  pendingDues: 0,
  outstandingAmount: 0,
  collectionsThisMonth: 0
};

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

function Dashboard() {
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const currentUser = await getCurrentUser();

        if (!currentUser) {
          throw new Error("Unable to load the current user.");
        }

        const dashboardSummary = await getDashboardSummary(currentUser);

        if (!isMounted) return;

        setUser(currentUser);
        setSummary(dashboardSummary);
      } catch (loadError) {
        if (!isMounted) return;

        console.error("Dashboard load error:", loadError);
        setError("Unable to load dashboard data. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <Layout>
        <h2>Loading Dashboard...</h2>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="dashboard-section">
          <h1>Dashboard</h1>
          <p role="alert">{error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <h1>Dashboard</h1>

        <p>
          Welcome, {user?.full_name}
        </p>

        <div className="dashboard-role">
          {user?.role?.replace("_", " ")}
        </div>

        <div className="dashboard-section">
          <h2>Master Data</h2>

          <div className="dashboard-grid">
            <DashboardCard
              title="Players"
              value={summary.totalPlayers}
              icon="👤"
              color="#2563eb"
            />

            <DashboardCard
              title="Centers"
              value={summary.totalCenters}
              icon="🏟️"
              color="#16a34a"
            />

            <DashboardCard
              title="Batches"
              value={summary.totalBatches}
              icon="⚽"
              color="#f97316"
            />

            <DashboardCard
              title="Academies"
              value={summary.totalAcademies}
              icon="🏢"
              color="#9333ea"
            />
          </div>
        </div>

        <div className="dashboard-section">
          <h2>Today's Attendance</h2>

          <div className="dashboard-grid-small">
            <DashboardCard
              title="Total"
              value={summary.attendanceTaken}
              icon="📋"
              color="#0ea5e9"
            />

            <DashboardCard
              title="Present"
              value={summary.presentPlayers}
              icon="✅"
              color="#22c55e"
            />

            <DashboardCard
              title="Absent"
              value={summary.absentPlayers}
              icon="❌"
              color="#ef4444"
            />

            <DashboardCard
              title="Present %"
              value={`${summary.attendancePercentage}%`}
              icon="📈"
              color="#8b5cf6"
            />
          </div>
        </div>

        <div className="dashboard-section">
          <h2>Financial Summary</h2>

          <div className="dashboard-grid-small">
            <DashboardCard
              title="Outstanding Dues"
              value={formatCurrency(summary.outstandingAmount)}
              icon="📉"
              color="#ef4444"
            />

            <DashboardCard
              title="Monthly Collections"
              value={formatCurrency(summary.collectionsThisMonth)}
              icon="💵"
              color="#22c55e"
            />

            <DashboardCard
              title="Pending Dues"
              value={summary.pendingDues}
              icon="💰"
              color="#f59e0b"
            />
          </div>
        </div>

                <div className="dashboard-section">
          <DashboardCharts
            attendanceTrend={summary.attendanceTrend}
            collectionsTrend={summary.collectionsTrend}
          />
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;
