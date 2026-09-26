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
        <div className="dashboard-state">
          <div className="dashboard-state-spinner" />
          <h2>Loading your dashboard</h2>
          <p>Preparing your academy overview...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="dashboard-state dashboard-state-error">
          <span className="dashboard-state-icon">!</span>
          <h1>Dashboard</h1>
          <p role="alert">{error}</p>
        </div>
      </Layout>
    );
  }

  const roleLabel = user?.role?.replaceAll("_", " ");

  return (
    <Layout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <span className="dashboard-eyebrow">Overview</span>
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">
              Welcome back, <strong>{user?.full_name}</strong>. Here&apos;s your academy overview.
            </p>
          </div>

          <div className="dashboard-header-meta">
            <span className="dashboard-role">{roleLabel}</span>
            <span className="dashboard-date">
              {new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric"
              }).format(new Date())}
            </span>
          </div>
        </header>

        <section className="dashboard-section dashboard-section-first">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-kicker">Academy overview</span>
              <h2>Master Data</h2>
            </div>
          </div>

          <div className="dashboard-grid">
            <DashboardCard title="Players" value={summary.totalPlayers} icon="●" color="blue" />
            <DashboardCard title="Centers" value={summary.totalCenters} icon="⌂" color="green" />
            <DashboardCard title="Batches" value={summary.totalBatches} icon="◆" color="orange" />
            <DashboardCard title="Academies" value={summary.totalAcademies} icon="▦" color="purple" />
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-kicker">Daily operations</span>
              <h2>Today&apos;s Attendance</h2>
            </div>
          </div>

          <div className="dashboard-grid dashboard-grid-4">
            <DashboardCard title="Total" value={summary.attendanceTaken} icon="▤" color="sky" />
            <DashboardCard title="Present" value={summary.presentPlayers} icon="✓" color="green" />
            <DashboardCard title="Absent" value={summary.absentPlayers} icon="×" color="red" />
            <DashboardCard title="Present %" value={`${summary.attendancePercentage}%`} icon="↗" color="purple" />
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-kicker">Financial health</span>
              <h2>Financial Summary</h2>
            </div>
          </div>

          <div className="dashboard-grid dashboard-grid-3">
            <DashboardCard
              title="Outstanding Dues"
              value={formatCurrency(summary.outstandingAmount)}
              icon="₹"
              color="red"
            />
            <DashboardCard
              title="Monthly Collections"
              value={formatCurrency(summary.collectionsThisMonth)}
              icon="₹"
              color="green"
            />
            <DashboardCard
              title="Pending Dues"
              value={summary.pendingDues}
              icon="!"
              color="orange"
            />
          </div>
        </section>

        <section className="dashboard-section dashboard-section-last">
          <DashboardCharts
            attendanceTrend={summary.attendanceTrend}
            collectionsTrend={summary.collectionsTrend}
          />
        </section>
      </div>
    </Layout>
  );
}

export default Dashboard;
