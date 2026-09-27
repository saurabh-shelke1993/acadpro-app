import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DashboardCharts from "../components/DashboardCharts";
import { getAnalyticsSummary } from "../services/analyticsService";
import { getAccessibleAcademies } from "../utils/dataScope";
import { isSuperAdmin } from "../utils/roles";
import { getCurrentUser } from "../utils/auth";
import "./Analytics.css";

const initialSummary = {
  attendanceTrend: [],
  attendanceInsights: [],
  collectionsTrend: [],
  financialHealth: {
    totalBilled: 0,
    totalPaid: 0,
    outstandingAmount: 0,
    collectionRate: 0,
    pendingDues: 0,
    partialDues: 0,
    paidDues: 0
  }
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
  const [academies, setAcademies] = useState([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState("");
  const [userReady, setUserReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadContext = async () => {
      try {
        setError("");

        const currentUser = await getCurrentUser();

        if (!currentUser) {
          throw new Error("Unable to load the current user.");
        }

        let accessibleAcademies = [];

        if (isSuperAdmin(currentUser)) {
          accessibleAcademies = await getAccessibleAcademies(currentUser);
        }

        if (!isMounted) return;

        setUser(currentUser);
        setAcademies(accessibleAcademies);
        setUserReady(true);
      } catch (loadError) {
        if (!isMounted) return;

        console.error("Analytics context load error:", loadError);
        setError("Unable to load analytics. Please try again.");
        setLoading(false);
      }
    };

    loadContext();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!userReady || !user) return;

    let isMounted = true;

    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError("");

        const analyticsSummary = await getAnalyticsSummary(user, {
          attendanceDays,
          collectionsMonths,
          selectedAcademyId
        });

        if (!isMounted) return;

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
  }, [
    userReady,
    user,
    attendanceDays,
    collectionsMonths,
    selectedAcademyId,
    refreshKey
  ]);

  if (loading) {
    return (
      <Layout>
        <div className="analytics-state">
          <div className="dashboard-state-spinner" />
          <h2>Loading analytics</h2>
          <p>Preparing attendance, financial and player insights...</p>
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
          <button
            type="button"
            className="analytics-retry-button"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      </Layout>
    );
  }

  const attendanceTrend = summary.attendanceTrend || [];
  const attendanceInsights = summary.attendanceInsights || [];
  const collectionsTrend = summary.collectionsTrend || [];
  const financialHealth = summary.financialHealth || initialSummary.financialHealth;

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

  const totalDues =
    financialHealth.pendingDues +
    financialHealth.partialDues +
    financialHealth.paidDues;

  const paidShare = financialHealth.totalBilled
    ? Math.min(
        (financialHealth.totalPaid / financialHealth.totalBilled) * 100,
        100
      )
    : 0;

  const outstandingShare = financialHealth.totalBilled
    ? Math.min(
        (financialHealth.outstandingAmount / financialHealth.totalBilled) * 100,
        100
      )
    : 0;

  const statusTotal = totalDues || 1;

  const attendanceDaysTracked = attendanceTrend.filter(
    (item) => Number(item.present || 0) + Number(item.absent || 0) > 0
  ).length;

  const attendanceConsistentDays = attendanceTrend.filter((item) => {
    const present = Number(item.present || 0);
    const absent = Number(item.absent || 0);
    const total = present + absent;

    return total > 0 && Math.round((present / total) * 100) >= 75;
  }).length;

  const attendanceInconsistentDays = Math.max(
    attendanceDaysTracked - attendanceConsistentDays,
    0
  );

  const presentShare = totalAttendance
    ? Math.min((totalPresent / totalAttendance) * 100, 100)
    : 0;
  const absentShare = totalAttendance
    ? Math.min((totalAbsent / totalAttendance) * 100, 100)
    : 0;
  const attendanceConsistencyTotal = attendanceDaysTracked || 1;

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
              <small>Last {attendanceDays} days</small>
            </div>

            <div className="analytics-insight-card">
              <span>Absent Records</span>
              <strong>{totalAttendance ? totalAbsent : "—"}</strong>
              <small>Last {attendanceDays} days</small>
            </div>

            <div className="analytics-insight-card">
              <span>Total Collections</span>
              <strong>{formatCurrency(totalCollections)}</strong>
              <small>Last {collectionsMonths} months</small>
            </div>

            <div className="analytics-insight-card">
              <span>Average Monthly</span>
              <strong>{formatCurrency(averageMonthlyCollections)}</strong>
              <small>Last {collectionsMonths} months</small>
            </div>
          </div>
        </section>

        <section className="analytics-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-kicker">Attendance distribution</span>
              <h2>Attendance Mix & Consistency</h2>
            </div>
            <span className="dashboard-section-helper">
              Last {attendanceDays} days
            </span>
          </div>

          <div className="attendance-visual-grid">
            <div className="attendance-visual-card">
              <div className="attendance-visual-header">
                <div>
                  <strong>Present vs Absent</strong>
                  <small>Share of attendance records</small>
                </div>
                <span>{attendanceRate}% present</span>
              </div>

              <div className="attendance-progress">
                <div
                  className="attendance-progress-present"
                  style={{ width: `${presentShare}%` }}
                />
                <div
                  className="attendance-progress-absent"
                  style={{ width: `${absentShare}%` }}
                />
              </div>

              <div className="attendance-legend">
                <div>
                  <span className="attendance-legend-dot attendance-legend-dot-present" />
                  <span>Present</span>
                  <strong>{totalPresent}</strong>
                </div>
                <div>
                  <span className="attendance-legend-dot attendance-legend-dot-absent" />
                  <span>Absent</span>
                  <strong>{totalAbsent}</strong>
                </div>
              </div>
            </div>

            <div className="attendance-visual-card">
              <div className="attendance-visual-header">
                <div>
                  <strong>Daily Attendance Consistency</strong>
                  <small>Days at or above 75% attendance</small>
                </div>
                <span>
                  {attendanceConsistentDays}/{attendanceDaysTracked} tracked
                </span>
              </div>

              <div className="attendance-consistency-bars">
                <div className="attendance-consistency-row">
                  <div className="attendance-consistency-label">
                    <span>At or above 75%</span>
                    <strong>{attendanceConsistentDays}</strong>
                  </div>
                  <div className="attendance-consistency-track">
                    <div
                      className="attendance-consistency-fill attendance-consistency-fill-consistent"
                      style={{
                        width: `${(attendanceConsistentDays / attendanceConsistencyTotal) * 100}%`
                      }}
                    />
                  </div>
                </div>

                <div className="attendance-consistency-row">
                  <div className="attendance-consistency-label">
                    <span>Below 75%</span>
                    <strong>{attendanceInconsistentDays}</strong>
                  </div>
                  <div className="attendance-consistency-track">
                    <div
                      className="attendance-consistency-fill attendance-consistency-fill-below"
                      style={{
                        width: `${(attendanceInconsistentDays / attendanceConsistencyTotal) * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              <p className="attendance-consistency-note">
                Only days with at least one attendance record are counted.
              </p>
            </div>
          </div>
        </section>

        <section className="analytics-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-kicker">Player insights</span>
              <h2>Attendance Attention</h2>
            </div>
            <span className="dashboard-section-helper">
              Lowest attendance · Last {attendanceDays} days
            </span>
          </div>

          {attendanceInsights.length === 0 ? (
            <div className="analytics-empty-card">
              <strong>No player-level attendance insight yet</strong>
              <span>
                Players need at least 3 attendance records in the selected period
                to appear here.
              </span>
            </div>
          ) : (
            <div className="attendance-insights-card">
              <div className="attendance-insights-header">
                <span>Player</span>
                <span>Attendance</span>
                <span>Records</span>
              </div>

              <div className="attendance-insights-list">
                {attendanceInsights.map((player) => (
                  <div className="attendance-insight-row" key={player.playerId}>
                    <div className="attendance-insight-player">
                      <strong>{player.playerName}</strong>
                      <small>
                        {player.present} present · {player.absent} absent
                      </small>
                    </div>

                    <div className="attendance-insight-rate">
                      <div className="attendance-insight-track">
                        <div
                          className="attendance-insight-fill"
                          style={{ width: `${player.attendanceRate}%` }}
                        />
                      </div>
                      <strong>{player.attendanceRate}%</strong>
                    </div>

                    <span className="attendance-insight-records">
                      {player.total}
                    </span>
                  </div>
                ))}
              </div>

              <p className="attendance-insights-note">
                Shows up to 5 players with the lowest attendance rate. Players
                with fewer than 3 records are excluded to avoid noisy results.
              </p>
            </div>
          )}
        </section>

        <section className="analytics-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-kicker">Financial health</span>
              <h2>Payment Due Overview</h2>
            </div>
            <span className="dashboard-section-helper">
              Current due ledger snapshot
            </span>
          </div>

          <div className="financial-health-grid">
            <div className="financial-health-card">
              <span>Total Billed</span>
              <strong>{formatCurrency(financialHealth.totalBilled)}</strong>
              <small>Across current payment dues</small>
            </div>

            <div className="financial-health-card">
              <span>Total Paid</span>
              <strong>{formatCurrency(financialHealth.totalPaid)}</strong>
              <small>Paid against current dues</small>
            </div>

            <div className="financial-health-card financial-health-card-attention">
              <span>Outstanding</span>
              <strong>{formatCurrency(financialHealth.outstandingAmount)}</strong>
              <small>Remaining amount across dues</small>
            </div>

            <div className="financial-health-card">
              <span>Collection Rate</span>
              <strong>{financialHealth.collectionRate}%</strong>
              <small>Paid ÷ billed</small>
            </div>
          </div>

          <div className="financial-status-grid">
            <div className="financial-status-card">
              <div>
                <span>Pending</span>
                <strong>{financialHealth.pendingDues}</strong>
              </div>
              <small>Fully unpaid dues</small>
            </div>

            <div className="financial-status-card">
              <div>
                <span>Partial</span>
                <strong>{financialHealth.partialDues}</strong>
              </div>
              <small>Dues with a remaining balance</small>
            </div>

            <div className="financial-status-card">
              <div>
                <span>Paid</span>
                <strong>{financialHealth.paidDues}</strong>
              </div>
              <small>Fully settled dues</small>
            </div>
          </div>
        </section>

        <section className="analytics-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-kicker">Financial distribution</span>
              <h2>Collection & Due Status</h2>
            </div>
            <span className="dashboard-section-helper">
              Current due ledger
            </span>
          </div>

          <div className="financial-visual-grid">
            <div className="financial-visual-card">
              <div className="financial-visual-header">
                <div>
                  <strong>Paid vs Outstanding</strong>
                  <small>Share of billed amount</small>
                </div>
                <span>{financialHealth.collectionRate}% collected</span>
              </div>

              <div className="financial-progress">
                <div
                  className="financial-progress-paid"
                  style={{ width: `${paidShare}%` }}
                />
                <div
                  className="financial-progress-outstanding"
                  style={{ width: `${outstandingShare}%` }}
                />
              </div>

              <div className="financial-legend">
                <div>
                  <span className="financial-legend-dot financial-legend-dot-paid" />
                  <span>Paid</span>
                  <strong>{formatCurrency(financialHealth.totalPaid)}</strong>
                </div>
                <div>
                  <span className="financial-legend-dot financial-legend-dot-outstanding" />
                  <span>Outstanding</span>
                  <strong>{formatCurrency(financialHealth.outstandingAmount)}</strong>
                </div>
              </div>
            </div>

            <div className="financial-visual-card">
              <div className="financial-visual-header">
                <div>
                  <strong>Due Status Distribution</strong>
                  <small>Current dues by status</small>
                </div>
                <span>{totalDues} total dues</span>
              </div>

              <div className="financial-status-bars">
                <div className="financial-status-bar-row">
                  <div className="financial-status-bar-label">
                    <span>Pending</span>
                    <strong>{financialHealth.pendingDues}</strong>
                  </div>
                  <div className="financial-status-track">
                    <div
                      className="financial-status-fill financial-status-fill-pending"
                      style={{
                        width: `${(financialHealth.pendingDues / statusTotal) * 100}%`
                      }}
                    />
                  </div>
                </div>

                <div className="financial-status-bar-row">
                  <div className="financial-status-bar-label">
                    <span>Partial</span>
                    <strong>{financialHealth.partialDues}</strong>
                  </div>
                  <div className="financial-status-track">
                    <div
                      className="financial-status-fill financial-status-fill-partial"
                      style={{
                        width: `${(financialHealth.partialDues / statusTotal) * 100}%`
                      }}
                    />
                  </div>
                </div>

                <div className="financial-status-bar-row">
                  <div className="financial-status-bar-label">
                    <span>Paid</span>
                    <strong>{financialHealth.paidDues}</strong>
                  </div>
                  <div className="financial-status-track">
                    <div
                      className="financial-status-fill financial-status-fill-paid"
                      style={{
                        width: `${(financialHealth.paidDues / statusTotal) * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="analytics-section analytics-section-last">
          <div className="analytics-trend-header">
            <div>
              <span className="dashboard-section-kicker">Trends</span>
              <h2>Attendance & Collections</h2>
              {isSuperAdmin(user) && (
                <p className="analytics-filter-summary">
                  {selectedAcademyId
                    ? `Showing selected academy`
                    : "Showing all accessible academies"}
                </p>
              )}
            </div>

            <div className="analytics-period-controls" aria-label="Analytics filters">
              {isSuperAdmin(user) && (
                <label>
                  <span>Academy</span>
                  <select
                    value={selectedAcademyId}
                    onChange={(event) => setSelectedAcademyId(event.target.value)}
                  >
                    <option value="">All academies</option>
                    {academies.map((academy) => (
                      <option key={academy.id} value={academy.id}>
                        {academy.academy_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
