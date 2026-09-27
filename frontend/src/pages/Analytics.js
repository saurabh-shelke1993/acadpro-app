import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DashboardCharts from "../components/DashboardCharts";
import { getAnalyticsSummary } from "../services/analyticsService";
import { getCurrentUser } from "../utils/auth";
import "./Analytics.css";

const initialSummary = {
  attendanceTrend: [],
  collectionsTrend: []
};

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

function Analytics() {
  const [summary, setSummary] = useState(initialSummary);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attendanceDays, setAttendanceDays] = useState(7);
  const [collectionsMonths, setCollectionsMonths] = useState(6);

  useEffect(() => {
    let isMounted = true;

    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError("");

        const currentUser = await getCurrentUser();

        if (!currentUser) {
          throw new Error("Unable to load the current user.");
        }

        const analyticsSummary = await getAnalyticsSummary(currentUser, {
          attendanceDays,
          collectionsMonths
        });

        if (!isMounted) return;

        setUser(currentUser);
        setSummary(analyticsSummary);
      } catch (loadError) {
        if (!isMounted) return;

        console.error("Analytics load error:", loadError);
        setError("Unable to load analytics. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [attendanceDays, collectionsMonths]);

  if (loading) {
    return (
      <Layout>
        <div className="analytics-state">
          <div className="dashboard-state-spinner" />
          <h2>Loading analytics</h2>
          <p>Preparing attendance and collections insights...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="analytics-state analytics-state-error">
          <span className="dashboard-state-icon">!</span>
          <h1>Analytics</h1>
          <p role="alert">{error}</p>
        </div>
      </Layout>
    );
  }

  const attendanceTrend = summary.attendanceTrend || [];
  const collectionsTrend = summary.collectionsTrend || [];

  const totalPresent = attendanceTrend.reduce(
    (total, item) => total + Number(item.present || 0),
    0
  );

  const totalAbsent = attendanceTrend.reduce(
    (total, item) => total + Number(item.absent || 0),
    0
  );

  const totalAttendance = totalPresent + totalAbsent;

  const attendanceRate = totalAttendance
    ? Math.round((totalPresent / totalAttendance) * 100)
    : 0;

  const totalCollections = collectionsTrend.reduce(
    (total, item) => total + Number(item.collections || 0),
    0
  );

  const averageMonthlyCollections = collectionsTrend.length
    ? Math.round(totalCollections / collectionsTrend.length)
    : 0;

  return (
    <Layout>
      <div className="analytics-page">
        <header className="analytics-header">
          <div>
            <span className="dashboard-eyebrow">Insights</span>
            <h1 className="dashboard-title">Analytics</h1>
            <p className="dashboard-subtitle">
              Attendance and collections trends for {user?.full_name || "your academy"}.
            </p>
          </div>

          <span className="analytics-scope">
            {user?.role?.replaceAll("_", " ")}
          </span>
        </header>

        <section className="analytics-section analytics-section-first">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-kicker">At a glance</span>
              <h2>Key Insights</h2>
            </div>
          </div>

          <div className="analytics-insights">
            <div className="analytics-insight-card">
              <span>Attendance Rate</span>
              <strong>{totalAttendance ? `${attendanceRate}%` : "—"}</strong>
              <small>Last {attendanceDays} days</small>
            </div>

            <div className="analytics-insight-card">
              <span>Present Records</span>
              <strong>{totalAttendance ? totalPresent : "—"}</strong>
              <small>Last 7 days</small>
            </div>

            <div className="analytics-insight-card">
              <span>Absent Records</span>
              <strong>{totalAttendance ? totalAbsent : "—"}</strong>
              <small>Last 7 days</small>
            </div>

            <div className="analytics-insight-card">
              <span>Total Collections</span>
              <strong>{formatCurrency(totalCollections)}</strong>
              <small>Last {collectionsMonths} months</small>
            </div>

            <div className="analytics-insight-card">
              <span>Average Monthly</span>
              <strong>{formatCurrency(averageMonthlyCollections)}</strong>
              <small>Last 6 months</small>
            </div>
          </div>
        </section>

        <section className="analytics-section analytics-section-last">
          <div className="analytics-trend-header">
            <div>
              <span className="dashboard-section-kicker">Trends</span>
              <h2>Attendance & Collections</h2>
            </div>

            <div className="analytics-period-controls" aria-label="Analytics time periods">
              <label>
                <span>Attendance</span>
                <select
                  value={attendanceDays}
                  onChange={(event) => setAttendanceDays(Number(event.target.value))}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </label>

              <label>
                <span>Collections</span>
                <select
                  value={collectionsMonths}
                  onChange={(event) => setCollectionsMonths(Number(event.target.value))}
                >
                  <option value={3}>Last 3 months</option>
                  <option value={6}>Last 6 months</option>
                  <option value={12}>Last 12 months</option>
                </select>
              </label>
            </div>
          </div>

          <DashboardCharts
            attendanceTrend={attendanceTrend}
            collectionsTrend={collectionsTrend}
            attendancePeriodLabel={`Last ${attendanceDays} days`}
            collectionsPeriodLabel={`Last ${collectionsMonths} months`}
          />
        </section>
      </div>
    </Layout>
  );
}

export default Analytics;
