import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import DashboardCharts from "../components/DashboardCharts";
import { getAnalyticsSummary } from "../services/analyticsService";
import { getSuperAdminDashboardData } from "../services/dashboardService";
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

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN");

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "academies", label: "Academies", superAdminOnly: true },
  { id: "attendance", label: "Attendance" },
  { id: "finance", label: "Finance" }
];

function SectionHeading({ kicker, title, helper }) {
  return (
    <div className="analytics-section-heading">
      <div>
        <span className="dashboard-section-kicker">{kicker}</span>
        <h2>{title}</h2>
      </div>
      {helper && <span className="dashboard-section-helper">{helper}</span>}
    </div>
  );
}

function InsightCard({ label, value, detail, tone = "blue" }) {
  return (
    <div className="analytics-insight-card" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function AttendanceMix({ attendanceTrend, attendanceDays }) {
  const totalPresent = attendanceTrend.reduce(
    (total, item) => total + Number(item.present || 0),
    0
  );
  const totalAbsent = attendanceTrend.reduce(
    (total, item) => total + Number(item.absent || 0),
    0
  );
  const total = totalPresent + totalAbsent;
  const attendanceRate = total ? Math.round((totalPresent / total) * 100) : 0;
  const presentShare = total ? Math.min((totalPresent / total) * 100, 100) : 0;
  const absentShare = total ? Math.min((totalAbsent / total) * 100, 100) : 0;

  const trackedDays = attendanceTrend.filter(
    (item) => Number(item.present || 0) + Number(item.absent || 0) > 0
  ).length;

  const consistentDays = attendanceTrend.filter((item) => {
    const present = Number(item.present || 0);
    const absent = Number(item.absent || 0);
    const dailyTotal = present + absent;
    return dailyTotal > 0 && Math.round((present / dailyTotal) * 100) >= 75;
  }).length;

  const inconsistentDays = Math.max(trackedDays - consistentDays, 0);
  const consistencyTotal = trackedDays || 1;

  return (
    <div className="attendance-visual-grid">
      <div className="attendance-visual-card">
        <div className="attendance-visual-header">
          <div>
            <strong>Present vs Absent</strong>
            <small>Share of attendance records</small>
          </div>
          <span>{total ? `${attendanceRate}% present` : "No data"}</span>
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
            <strong>{formatNumber(totalPresent)}</strong>
          </div>
          <div>
            <span className="attendance-legend-dot attendance-legend-dot-absent" />
            <span>Absent</span>
            <strong>{formatNumber(totalAbsent)}</strong>
          </div>
        </div>
      </div>

      <div className="attendance-visual-card">
        <div className="attendance-visual-header">
          <div>
            <strong>Daily Attendance Consistency</strong>
            <small>Days at or above 75% attendance</small>
          </div>
          <span>{consistentDays}/{trackedDays} tracked</span>
        </div>

        <div className="attendance-consistency-bars">
          <div className="attendance-consistency-row">
            <div className="attendance-consistency-label">
              <span>At or above 75%</span>
              <strong>{consistentDays}</strong>
            </div>
            <div className="attendance-consistency-track">
              <div
                className="attendance-consistency-fill attendance-consistency-fill-consistent"
                style={{ width: `${(consistentDays / consistencyTotal) * 100}%` }}
              />
            </div>
          </div>

          <div className="attendance-consistency-row">
            <div className="attendance-consistency-label">
              <span>Below 75%</span>
              <strong>{inconsistentDays}</strong>
            </div>
            <div className="attendance-consistency-track">
              <div
                className="attendance-consistency-fill attendance-consistency-fill-below"
                style={{ width: `${(inconsistentDays / consistencyTotal) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <p className="attendance-consistency-note">
          {trackedDays
            ? `${trackedDays} of ${attendanceDays} days have attendance records.`
            : "No attendance records in the selected period."}
        </p>
      </div>
    </div>
  );
}

function AttendanceAttention({ attendanceInsights, attendanceDays }) {
  if (!attendanceInsights.length) {
    return (
      <div className="analytics-empty-card">
        <strong>No player-level attendance insight yet</strong>
        <span>
          Players need at least 3 attendance records in the selected period to appear here.
        </span>
      </div>
    );
  }

  return (
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
              <small>{player.present} present · {player.absent} absent</small>
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

            <span className="attendance-insight-records">{player.total}</span>
          </div>
        ))}
      </div>

      <p className="attendance-insights-note">
        Lowest attendance among players with at least 3 records · last {attendanceDays} days.
      </p>
    </div>
  );
}

function FinancialOverview({ financialHealth }) {
  const totalDues =
    financialHealth.pendingDues +
    financialHealth.partialDues +
    financialHealth.paidDues;

  const paidShare = financialHealth.totalBilled
    ? Math.min((financialHealth.totalPaid / financialHealth.totalBilled) * 100, 100)
    : 0;

  const outstandingShare = financialHealth.totalBilled
    ? Math.min((financialHealth.outstandingAmount / financialHealth.totalBilled) * 100, 100)
    : 0;

  const statusTotal = totalDues || 1;

  return (
    <>
      <div className="financial-health-grid">
        <InsightCard
          label="Total billed"
          value={formatCurrency(financialHealth.totalBilled)}
          detail="Current payment due ledger"
        />
        <InsightCard
          label="Total paid"
          value={formatCurrency(financialHealth.totalPaid)}
          detail="Paid against current dues"
          tone="green"
        />
        <InsightCard
          label="Outstanding"
          value={formatCurrency(financialHealth.outstandingAmount)}
          detail="Remaining balance"
          tone="orange"
        />
        <InsightCard
          label="Collection rate"
          value={`${financialHealth.collectionRate}%`}
          detail="Paid ÷ billed"
          tone="blue"
        />
      </div>

      <div className="financial-status-grid">
        <div className="financial-status-card">
          <div><span>Pending</span><strong>{financialHealth.pendingDues}</strong></div>
          <small>Fully unpaid dues</small>
        </div>
        <div className="financial-status-card">
          <div><span>Partial</span><strong>{financialHealth.partialDues}</strong></div>
          <small>Dues with a remaining balance</small>
        </div>
        <div className="financial-status-card">
          <div><span>Paid</span><strong>{financialHealth.paidDues}</strong></div>
          <small>Fully settled dues</small>
        </div>
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
            <div className="financial-progress-paid" style={{ width: `${paidShare}%` }} />
            <div className="financial-progress-outstanding" style={{ width: `${outstandingShare}%` }} />
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
            {[
              ["Pending", financialHealth.pendingDues, "pending"],
              ["Partial", financialHealth.partialDues, "partial"],
              ["Paid", financialHealth.paidDues, "paid"]
            ].map(([label, value, tone]) => (
              <div className="financial-status-bar-row" key={label}>
                <div className="financial-status-bar-label">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
                <div className="financial-status-track">
                  <div
                    className={`financial-status-fill financial-status-fill-${tone}`}
                    style={{ width: `${(value / statusTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function AcademyComparison({ academies }) {
  if (!academies.length) {
    return <div className="analytics-empty-card"><strong>No academy data available.</strong></div>;
  }

  return (
    <div className="analytics-academy-table-wrap">
      <div className="analytics-academy-table">
        <div className="analytics-academy-header">
          <span>Academy</span>
          <span>Players</span>
          <span>Attendance · 7d</span>
          <span>Collections · month</span>
          <span>Outstanding</span>
          <span>Rate</span>
        </div>

        {academies.map((academy) => (
          <div className="analytics-academy-row" key={academy.id}>
            <div>
              <strong>{academy.name}</strong>
              <small>{academy.centers} centers · {academy.batches} batches</small>
            </div>
            <strong>{formatNumber(academy.players)}</strong>
            <div className="analytics-academy-rate">
              <strong>{academy.attendanceRecords ? `${academy.attendanceRate}%` : "—"}</strong>
              <small>
                {academy.attendanceDelta === null
                  ? "No prior data"
                  : `${academy.attendanceDelta > 0 ? "+" : ""}${academy.attendanceDelta}pp vs prior 7d`}
              </small>
            </div>
            <div>
              <strong>{formatCurrency(academy.collectionsThisMonth)}</strong>
              <small>
                {academy.collectionsChange === 0
                  ? "No change"
                  : `${academy.collectionsChange > 0 ? "+" : ""}${academy.collectionsChange}% vs prior month`}
              </small>
            </div>
            <div>
              <strong>{formatCurrency(academy.outstandingAmount)}</strong>
              <small>{academy.collectionRate}% collected</small>
            </div>
            <span className={`analytics-academy-status analytics-academy-status-${academy.attendanceRecords && academy.attendanceRate < 70 ? "watch" : academy.totalBilled > 0 && academy.collectionRate < 75 ? "finance" : "healthy"}`}>
              {academy.attendanceRecords && academy.attendanceRate < 70
                ? "Watch"
                : academy.totalBilled > 0 && academy.collectionRate < 75
                  ? "Finance"
                  : academy.attendanceRecords || academy.totalBilled
                    ? "Healthy"
                    : "No data"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Analytics() {
  const [summary, setSummary] = useState(initialSummary);
  const [academyComparison, setAcademyComparison] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [error, setError] = useState("");
  const [attendanceDays, setAttendanceDays] = useState(30);
  const [collectionsMonths, setCollectionsMonths] = useState(6);
  const [academies, setAcademies] = useState([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [userReady, setUserReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadContext = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) throw new Error("Unable to load the current user.");

        const accessibleAcademies = isSuperAdmin(currentUser)
          ? await getAccessibleAcademies(currentUser)
          : [];

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
    return () => { isMounted = false; };
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

        if (isMounted) setSummary(analyticsSummary);
      } catch (loadError) {
        if (isMounted) {
          console.error("Analytics load error:", loadError);
          setError("Unable to load analytics. Please try again.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAnalytics();
    return () => { isMounted = false; };
  }, [userReady, user, attendanceDays, collectionsMonths, selectedAcademyId, refreshKey]);

  useEffect(() => {
    if (!userReady || !user || !isSuperAdmin(user)) return;

    let isMounted = true;
    const loadComparison = async () => {
      try {
        setComparisonLoading(true);
        const data = await getSuperAdminDashboardData();
        if (isMounted) setAcademyComparison(data);
      } catch (loadError) {
        if (isMounted) {
          console.error("Academy analytics load error:", loadError);
          setAcademyComparison(null);
        }
      } finally {
        if (isMounted) setComparisonLoading(false);
      }
    };

    loadComparison();
    return () => { isMounted = false; };
  }, [userReady, user, refreshKey]);

  useEffect(() => {
    if (!isSuperAdmin(user) && activeTab === "academies") {
      setActiveTab("overview");
    }
  }, [user, activeTab]);

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => !tab.superAdminOnly || isSuperAdmin(user)),
    [user]
  );

  const selectedAcademyName = selectedAcademyId
    ? academies.find((academy) => academy.id === selectedAcademyId)?.academy_name
    : "";

  if (loading) {
    return (
      <Layout>
        <div className="analytics-state">
          <div className="dashboard-state-spinner" />
          <h2>Loading analytics</h2>
          <p>Preparing historical attendance and financial intelligence...</p>
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
          <button type="button" className="analytics-retry-button" onClick={() => setRefreshKey((value) => value + 1)}>
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

  const totalPresent = attendanceTrend.reduce((total, item) => total + Number(item.present || 0), 0);
  const totalAbsent = attendanceTrend.reduce((total, item) => total + Number(item.absent || 0), 0);
  const totalAttendance = totalPresent + totalAbsent;
  const attendanceRate = totalAttendance ? Math.round((totalPresent / totalAttendance) * 100) : 0;
  const totalCollections = collectionsTrend.reduce((total, item) => total + Number(item.collections || 0), 0);
  const averageMonthlyCollections = collectionsTrend.length
    ? Math.round(totalCollections / collectionsTrend.length)
    : 0;

  const selectedAcademies = selectedAcademyId
    ? (academyComparison?.academies || []).filter((academy) => academy.id === selectedAcademyId)
    : (academyComparison?.academies || []);

  return (
    <Layout>
      <div className="analytics-page">
        <header className="analytics-header">
          <div>
            <span className="dashboard-eyebrow">Historical intelligence</span>
            <h1 className="dashboard-title">Analytics</h1>
            <p className="dashboard-subtitle">
              Understand how academy performance is changing over time.
              {selectedAcademyName ? ` · ${selectedAcademyName}` : " · All accessible academies"}
            </p>
          </div>

          <div className="analytics-header-actions">
            <span className="analytics-scope">{user?.role?.replaceAll("_", " ")}</span>
            <button type="button" className="analytics-refresh-button" onClick={() => setRefreshKey((value) => value + 1)}>
              Refresh
            </button>
          </div>
        </header>

        <section className="analytics-toolbar">
          <div className="analytics-tabs" role="tablist" aria-label="Analytics sections">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`analytics-tab ${activeTab === tab.id ? "analytics-tab-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="analytics-global-filters">
            {isSuperAdmin(user) && (
              <label>
                <span>Academy</span>
                <select value={selectedAcademyId} onChange={(event) => setSelectedAcademyId(event.target.value)}>
                  <option value="">All academies</option>
                  {academies.map((academy) => (
                    <option key={academy.id} value={academy.id}>{academy.academy_name}</option>
                  ))}
                </select>
              </label>
            )}

            <label>
              <span>Attendance</span>
              <select value={attendanceDays} onChange={(event) => setAttendanceDays(Number(event.target.value))}>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>

            <label>
              <span>Collections</span>
              <select value={collectionsMonths} onChange={(event) => setCollectionsMonths(Number(event.target.value))}>
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
            </label>
          </div>
        </section>

        {activeTab === "overview" && (
          <>
            <section className="analytics-section analytics-section-first">
              <SectionHeading kicker="Network pulse" title="Key Insights" helper={`Attendance · last ${attendanceDays} days`} />
              <div className="analytics-insights">
                <InsightCard label="Attendance rate" value={totalAttendance ? `${attendanceRate}%` : "—"} detail={`Last ${attendanceDays} days`} />
                <InsightCard label="Present records" value={formatNumber(totalPresent)} detail="Attendance volume" tone="green" />
                <InsightCard label="Absent records" value={formatNumber(totalAbsent)} detail="Attendance volume" tone="orange" />
                <InsightCard label="Collections" value={formatCurrency(totalCollections)} detail={`Last ${collectionsMonths} months`} tone="green" />
                <InsightCard label="Avg monthly collections" value={formatCurrency(averageMonthlyCollections)} detail="Historical average" />
              </div>
            </section>

            {isSuperAdmin(user) && (
              <section className="analytics-section">
                <SectionHeading kicker="Academy comparison" title="Where performance is changing" helper="Current dashboard comparison baseline" />
                <AcademyComparison academies={selectedAcademies.slice(0, 6)} />
              </section>
            )}

            <section className="analytics-section">
              <SectionHeading kicker="Trends" title="Attendance & Collections" helper="Use the tabs for deeper analysis" />
              <DashboardCharts
                attendanceTrend={attendanceTrend}
                collectionsTrend={collectionsTrend}
                attendancePeriodLabel={`Last ${attendanceDays} days`}
                collectionsPeriodLabel={`Last ${collectionsMonths} months`}
              />
            </section>
          </>
        )}

        {activeTab === "academies" && isSuperAdmin(user) && (
          <section className="analytics-section analytics-section-first">
            <SectionHeading
              kicker="Academy intelligence"
              title="Academy comparison"
              helper={comparisonLoading ? "Refreshing comparison data..." : `${selectedAcademies.length} academies in view`}
            />
            {academyComparison?.insights && (
              <div className="analytics-comparison-cards">
                <InsightCard
                  label="Attendance leader"
                  value={academyComparison.insights.attendanceLeader?.academyName || "—"}
                  detail={academyComparison.insights.attendanceLeader ? `${academyComparison.insights.attendanceLeader.value}% attendance · 7d` : "No attendance data"}
                  tone="green"
                />
                <InsightCard
                  label="Collections leader"
                  value={academyComparison.insights.collectionsLeader?.academyName || "—"}
                  detail={academyComparison.insights.collectionsLeader ? formatCurrency(academyComparison.insights.collectionsLeader.value) + " this month" : "No collections this month"}
                  tone="blue"
                />
                <InsightCard
                  label="Largest outstanding"
                  value={academyComparison.insights.largestOutstanding?.academyName || "—"}
                  detail={academyComparison.insights.largestOutstanding ? formatCurrency(academyComparison.insights.largestOutstanding.value) + " outstanding" : "No outstanding balance"}
                  tone="orange"
                />
              </div>
            )}
            <AcademyComparison academies={selectedAcademies} />
          </section>
        )}

        {activeTab === "attendance" && (
          <>
            <section className="analytics-section analytics-section-first">
              <SectionHeading kicker="Attendance" title="Attendance Mix & Consistency" helper={`Last ${attendanceDays} days`} />
              <AttendanceMix attendanceTrend={attendanceTrend} attendanceDays={attendanceDays} />
            </section>

            <section className="analytics-section">
              <SectionHeading kicker="Player insights" title="Attendance Attention" helper={`Lowest attendance · last ${attendanceDays} days`} />
              <AttendanceAttention attendanceInsights={attendanceInsights} attendanceDays={attendanceDays} />
            </section>

            <section className="analytics-section analytics-section-last">
              <SectionHeading kicker="Trend" title="Attendance trend" helper="Daily attendance percentage" />
              <DashboardCharts
                attendanceTrend={attendanceTrend}
                collectionsTrend={[]}
                attendancePeriodLabel={`Last ${attendanceDays} days`}
                collectionsPeriodLabel=""
              />
            </section>
          </>
        )}

        {activeTab === "finance" && (
          <>
            <section className="analytics-section analytics-section-first">
              <SectionHeading kicker="Finance" title="Financial health" helper="Current due ledger" />
              <FinancialOverview financialHealth={financialHealth} />
            </section>

            <section className="analytics-section analytics-section-last">
              <SectionHeading kicker="Trend" title="Collections trend" helper={`Last ${collectionsMonths} months`} />
              <DashboardCharts
                attendanceTrend={[]}
                collectionsTrend={collectionsTrend}
                attendancePeriodLabel=""
                collectionsPeriodLabel={`Last ${collectionsMonths} months`}
              />
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

export default Analytics;
