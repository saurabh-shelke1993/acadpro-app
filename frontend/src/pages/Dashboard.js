import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DashboardCard from "../components/Dashboard/DashboardCard";
import DashboardCharts from "../components/DashboardCharts";
import SuperAdminDashboard from "../components/Dashboard/SuperAdminDashboard";
import AcademyOwnerDashboardPreview from "../components/Dashboard/AcademyOwnerDashboardPreview";
import Layout from "../components/Layout";
import { getAcademyOwnerDashboardData, getSuperAdminDashboardData } from "../services/dashboardService";
import "../styles/dashboard.css";
import { getCurrentUser, isAcademyOwner, isSuperAdmin } from "../utils/auth";
import { supabase } from "../supabaseClient";

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
  collectionsThisMonth: 0,
  superAdmin: null,
  academyOwner: null
};

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

const canLoadOwner = (user) => isAcademyOwner(user)
  && typeof user?.academy_id === "string"
  && user.academy_id.trim().length > 0;

function Dashboard({ ownerPreview = false }) {
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [loadedMode, setLoadedMode] = useState(ownerPreview);
  const requestVersion = useRef(0);
  // Once this view loads Owner data, later role changes must not select another service.
  const ownerAccess = useRef(ownerPreview);
  const superAdminView = useRef(false);

  useEffect(() => {
    let active = true;
    // Invalidate synchronously, then revalidate outside the auth callback.
    // Never authorize from session metadata or the Sidebar's local cache.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!active || event === "INITIAL_SESSION") return;
      // Keep the established Super Admin lifecycle unchanged. Listen before the
      // initial lookup so an Owner sign-out during that lookup is still invalidated.
      if (!ownerPreview && superAdminView.current) return;
      requestVersion.current += 1;
      setUser(null);
      setSummary(initialSummary);
      setLoading(true);
      setError("");
      setRefreshToken((value) => value + 1);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [ownerPreview]);

  useEffect(() => {
    let isMounted = true;
    const version = ++requestVersion.current;
    const isCurrent = () => isMounted && version === requestVersion.current;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const profile = await getCurrentUser();
        if (!isCurrent()) return;
        const currentUser = profile ? { ...profile } : profile;

        if (!currentUser) {
          throw new Error("Unable to load the current user.");
        }

        let dashboardSummary;

        if (ownerPreview || ownerAccess.current || isAcademyOwner(currentUser)) {
          ownerAccess.current = true;
          superAdminView.current = false;
          if (!canLoadOwner(currentUser)) {
            throw new Error("Academy Owner dashboard access denied.");
          }
          dashboardSummary = {
            ...initialSummary,
            academyOwner: await getAcademyOwnerDashboardData(currentUser)
          };
        } else if (isSuperAdmin(currentUser)) {
          superAdminView.current = true;
          dashboardSummary = {
            ...initialSummary,
            superAdmin: await getSuperAdminDashboardData(currentUser)
          };
        } else {
          throw new Error("Dashboard access denied.");
        }

        if (!isCurrent()) return;

        setUser(currentUser);
        setSummary(dashboardSummary);
      } catch (loadError) {
        if (!isCurrent()) return;

        console.error("Dashboard load error:", loadError);
        setError("Unable to load dashboard data. Please try again.");
      } finally {
        if (isCurrent()) {
          setLoadedMode(ownerPreview);
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [refreshToken, ownerPreview]);

  const ownerActions = (ownerPreview || ownerAccess.current) && (
    <div className="dashboard-header-meta">
      {ownerPreview && <Link to="/dashboard">Return to dashboard</Link>}
      <button className="dashboard-refresh-button" type="button" disabled={loading}
        onClick={() => {
          requestVersion.current += 1;
          setUser(null);
          setSummary(initialSummary);
          setLoading(true);
          setRefreshToken((value) => value + 1);
        }}>{ownerPreview ? "Refresh preview" : "Refresh dashboard"}</button>
    </div>
  );

  if (loading || loadedMode !== ownerPreview) {
    return (
      <Layout>
        {ownerActions}
        <div className="dashboard-state" role="status">
          <div className="dashboard-state-spinner" />
          <h2>Loading your dashboard</h2>
          <p>Preparing your academy overview...</p>
        </div>
      </Layout>
    );
  }

  if (error || ((ownerPreview || ownerAccess.current) && !canLoadOwner(user))) {
    return (
      <Layout>
        {ownerActions}
        <div className="dashboard-state dashboard-state-error">
          <span className="dashboard-state-icon">!</span>
          <h1>Dashboard</h1>
          <p role="alert">{error || "Unable to load dashboard data. Please try again."}</p>
        </div>
      </Layout>
    );
  }

  const roleLabel = user?.role?.replaceAll("_", " ");

  if (ownerPreview || isAcademyOwner(user)) {
    return (
      <Layout>
        {ownerActions}
        <AcademyOwnerDashboardPreview data={summary.academyOwner} />
      </Layout>
    );
  }

  if (isSuperAdmin(user)) {
    return (
      <Layout>
        <SuperAdminDashboard
          user={user}
          data={summary.superAdmin}
          onRefresh={() => setRefreshToken((value) => value + 1)}
        />
      </Layout>
    );
  }

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
            <button
              type="button"
              className="dashboard-refresh-button"
              onClick={() => setRefreshToken((value) => value + 1)}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
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
            <DashboardCard title="Players" value={summary.totalPlayers} icon="●" color="blue" to="/players" />
            <DashboardCard title="Centers" value={summary.totalCenters} icon="⌂" color="green" to="/centers" />
            <DashboardCard title="Batches" value={summary.totalBatches} icon="◆" color="orange" to="/batches" />
            <DashboardCard
              title="Academies"
              value={summary.totalAcademies}
              icon="▦"
              color="purple"
              to={user?.role === "super_admin" ? "/academy" : undefined}
            />
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
            <DashboardCard title="Recorded" value={summary.attendanceTaken} icon="▤" color="sky" to="/attendance?view=history" />
            <DashboardCard title="Present" value={summary.presentPlayers} icon="✓" color="green" to="/attendance?view=history" />
            <DashboardCard title="Absent" value={summary.absentPlayers} icon="×" color="red" to="/attendance?view=history" />
            <DashboardCard title="Present %" value={summary.attendancePercentage + "%"} icon="↗" color="purple" to="/attendance?view=history" />
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-kicker">Needs attention</span>
              <h2>Today&apos;s Priorities</h2>
            </div>
            <span className="dashboard-section-helper">
              Follow up on outstanding work
            </span>
          </div>

          <div className="dashboard-attention-grid">
            <Link className="dashboard-attention-card" to="/payment-dues">
              <span className="dashboard-attention-icon dashboard-attention-icon-danger">!</span>
              <span className="dashboard-attention-content">
                <strong>Pending Payment Dues</strong>
                <b>{summary.pendingDues}</b>
                <small>Open payment dues to review outstanding items</small>
              </span>
              <span className="dashboard-attention-arrow" aria-hidden="true">→</span>
            </Link>

            <Link className="dashboard-attention-card" to="/payment-dues">
              <span className="dashboard-attention-icon dashboard-attention-icon-danger">₹</span>
              <span className="dashboard-attention-content">
                <strong>Outstanding Amount</strong>
                <b>{formatCurrency(summary.outstandingAmount)}</b>
                <small>Review balances still due from players</small>
              </span>
              <span className="dashboard-attention-arrow" aria-hidden="true">→</span>
            </Link>

            <Link className="dashboard-attention-card" to="/attendance?view=history">
              <span className="dashboard-attention-icon dashboard-attention-icon-info">✓</span>
              <span className="dashboard-attention-content">
                <strong>Attendance Recorded</strong>
                <b>{summary.attendanceTaken}</b>
                <small>
                  {summary.attendanceTaken > 0
                    ? "Today&apos;s attendance has records"
                    : "No attendance has been recorded today"}
                </small>
              </span>
              <span className="dashboard-attention-arrow" aria-hidden="true">→</span>
            </Link>
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
              to="/payment-dues"
            />
            <DashboardCard
              title="Monthly Collections"
              value={formatCurrency(summary.collectionsThisMonth)}
              icon="₹"
              color="green"
              to="/payment-collections"
            />
            <DashboardCard
              title="Pending Dues"
              value={summary.pendingDues}
              icon="!"
              color="orange"
              to="/payment-dues"
            />
          </div>
        </section>

        <section className="dashboard-section dashboard-actions-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-kicker">Shortcuts</span>
              <h2>Quick Actions</h2>
            </div>
            <span className="dashboard-section-helper">Jump directly to common tasks</span>
          </div>

          <div className="dashboard-actions">
            <Link className="dashboard-action" to="/players">
              <span className="dashboard-action-icon">+</span>
              <span>
                <strong>Add / Manage Players</strong>
                <small>Open the player workspace</small>
              </span>
            </Link>

            <Link className="dashboard-action" to={isSuperAdmin(user) ? "/attendance?view=history" : "/attendance?view=mark"}>
              <span className="dashboard-action-icon">✓</span>
              <span>
                <strong>{isSuperAdmin(user) ? "Attendance History" : "Mark Attendance"}</strong>
                <small>{isSuperAdmin(user) ? "Review recorded attendance" : "Record today&apos;s attendance"}</small>
              </span>
            </Link>

            <Link className="dashboard-action" to="/payment-dues">
              <span className="dashboard-action-icon">₹</span>
              <span>
                <strong>Review Payment Dues</strong>
                <small>Review pending and outstanding dues</small>
              </span>
            </Link>

            <Link className="dashboard-action" to="/payment-collections">
              <span className="dashboard-action-icon">↗</span>
              <span>
                <strong>Collect Payment</strong>
                <small>Record a payment and issue a receipt</small>
              </span>
            </Link>
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
