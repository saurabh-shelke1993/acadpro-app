import { Link } from "react-router-dom";
import "./SuperAdminDashboard.css";

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN");

const formatChange = (value, suffix = "%") => {
  if (value === null || value === undefined) return "New";
  if (value === 0) return "No change";

  return `${value > 0 ? "+" : ""}${value}${suffix}`;
};

const getChangeTone = (value) => {
  if (value === null || value === undefined || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
};

const getStatus = (academy) => {
  if (!academy.attendanceRecords && !academy.totalBilled) {
    return { label: "No data", tone: "neutral" };
  }

  if (academy.attendanceRecords > 0 && academy.attendanceRate < 70) {
    return { label: "Watch", tone: "warning" };
  }

  if (
    academy.totalBilled > 0 &&
    academy.collectionRate < 75
  ) {
    return { label: "Finance", tone: "warning" };
  }

  return { label: "Healthy", tone: "success" };
};

function MetricCard({ label, value, detail, tone = "blue" }) {
  return (
    <div className="sa-dashboard-metric" data-tone={tone}>
      <span className="sa-dashboard-metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="sa-dashboard-metric-detail">{detail}</span>
    </div>
  );
}

function AcademyHealthRow({ academy }) {
  const status = getStatus(academy);
  const attendanceTone = getChangeTone(academy.attendanceDelta);
  const collectionsTone = getChangeTone(academy.collectionsChange);

  return (
    <Link
      className="sa-academy-row"
      to={`/centers?academyId=${academy.id}`}
      aria-label={`Open ${academy.name} centers`}
    >
      <div className="sa-academy-name">
        <strong>{academy.name}</strong>
        <span>
          {formatNumber(academy.centers)} centers · {formatNumber(academy.batches)} batches
        </span>
      </div>

      <div className="sa-academy-stat">
        <strong>{formatNumber(academy.players)}</strong>
        <span>active players</span>
      </div>

      <div className="sa-academy-stat sa-academy-attendance">
        <div className="sa-progress-track">
          <span style={{ width: `${Math.min(academy.attendanceRate, 100)}%` }} />
        </div>
        <strong>{academy.attendanceRecords ? `${academy.attendanceRate}%` : "—"}</strong>
        <span>
          7d · <em className={`sa-change-${attendanceTone}`}>
            {formatChange(academy.attendanceDelta, "pp")}
          </em>
        </span>
      </div>

      <div className="sa-academy-stat">
        <strong>{academy.collectionsThisMonth ? formatCurrency(academy.collectionsThisMonth) : "₹0"}</strong>
        <span>
          this month · <em className={`sa-change-${collectionsTone}`}>
            {formatChange(academy.collectionsChange)}
          </em>
        </span>
      </div>

      <div className="sa-academy-stat">
        <strong>{academy.outstandingAmount ? formatCurrency(academy.outstandingAmount) : "₹0"}</strong>
        <span>{academy.collectionRate}% collected</span>
      </div>

      <span className={`sa-status-pill sa-status-${status.tone}`}>
        {status.label}
      </span>
    </Link>
  );
}

function ComparisonInsight({ label, academyName, value, detail, tone = "blue" }) {
  return (
    <div className="sa-comparison-insight" data-tone={tone}>
      <span className="sa-comparison-insight-label">{label}</span>
      <strong>{academyName || "—"}</strong>
      <span className="sa-comparison-insight-value">{value}</span>
      <span className="sa-comparison-insight-detail">{detail}</span>
    </div>
  );
}

function SuperAdminDashboard({ user, data, onRefresh }) {
  const academies = data?.academies || [];
  const attentionItems = data?.attentionItems || [];
  const attendanceTrend = data?.attendanceTrend || [];

  return (
    <div className="sa-dashboard-page">
      <header className="sa-dashboard-header">
        <div>
          <span className="sa-dashboard-eyebrow">Super Admin · Command Center</span>
          <h1>Academy Health</h1>
          <p>
            One view of what is happening across all academies. Start with exceptions,
            then compare academy performance.
          </p>
        </div>

        <div className="sa-dashboard-header-actions">
          <span className="sa-dashboard-role">{user?.role?.replaceAll("_", " ")}</span>
          <button type="button" className="sa-dashboard-refresh" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </header>

      <section className="sa-dashboard-section sa-dashboard-snapshot">
        <div className="sa-dashboard-section-heading">
          <div>
            <span className="sa-dashboard-kicker">Organization snapshot</span>
            <h2>Know the whole network at a glance</h2>
          </div>
          <span className="sa-dashboard-period">Attendance · last 7 days</span>
        </div>

        <div className="sa-dashboard-metrics">
          <MetricCard
            label="Academies"
            value={formatNumber(data?.totals?.academies)}
            detail="Active academies"
            tone="blue"
          />
          <MetricCard
            label="Active players"
            value={formatNumber(data?.totals?.players)}
            detail="Across all academies"
            tone="purple"
          />
          <MetricCard
            label="Attendance"
            value={data?.totals?.attendanceRecords ? `${data.totals.attendanceRate}%` : "—"}
            detail={
              data?.totals?.attendanceRecords
                ? `${formatNumber(data.totals.attendanceRecords)} records`
                : "No records in period"
            }
            tone="green"
          />
          <MetricCard
            label="Collections"
            value={formatCurrency(data?.totals?.collectionsThisMonth)}
            detail="Collected this month"
            tone="orange"
          />
        </div>
      </section>

      <section className="sa-dashboard-section">
        <div className="sa-dashboard-section-heading">
          <div>
            <span className="sa-dashboard-kicker">Cross-academy comparison</span>
            <h2>Academy Health</h2>
          </div>
          <span className="sa-dashboard-section-note">
            Compare the metrics that matter, not just raw totals.
          </span>
        </div>

        <div className="sa-comparison-insights">
          <ComparisonInsight
            label="Attendance leader"
            academyName={data?.insights?.attendanceLeader?.academyName}
            value={
              data?.insights?.attendanceLeader
                ? `${data.insights.attendanceLeader.value}%`
                : "—"
            }
            detail={
              data?.insights?.attendanceLeader
                ? `${formatNumber(data.insights.attendanceLeader.records)} attendance records · 7d`
                : "No attendance data"
            }
            tone="green"
          />
          <ComparisonInsight
            label="Collections leader"
            academyName={data?.insights?.collectionsLeader?.academyName}
            value={
              data?.insights?.collectionsLeader
                ? formatCurrency(data.insights.collectionsLeader.value)
                : "₹0"
            }
            detail={
              data?.insights?.collectionsLeader
                ? `${formatChange(data.insights.collectionsLeader.change)} vs previous month`
                : "No collections this month"
            }
            tone="orange"
          />
          <ComparisonInsight
            label="Largest outstanding"
            academyName={data?.insights?.largestOutstanding?.academyName}
            value={
              data?.insights?.largestOutstanding
                ? formatCurrency(data.insights.largestOutstanding.value)
                : "₹0"
            }
            detail={
              data?.insights?.largestOutstanding
                ? `${data.insights.largestOutstanding.collectionRate}% collected`
                : "No outstanding balance"
            }
            tone="red"
          />
        </div>

        <div className="sa-academy-table">
          <div className="sa-academy-table-header">
            <span>Academy</span>
            <span>Players</span>
            <span>Attendance · 7d</span>
            <span>Collections · month</span>
            <span>Outstanding</span>
            <span>Status</span>
          </div>

          {academies.length ? (
            academies.map((academy) => (
              <AcademyHealthRow key={academy.id} academy={academy} />
            ))
          ) : (
            <div className="sa-dashboard-empty">No academy data available.</div>
          )}
        </div>
      </section>

      <section className="sa-dashboard-section sa-dashboard-lower-grid">
        <div className="sa-dashboard-panel">
          <div className="sa-dashboard-panel-heading">
            <div>
              <span className="sa-dashboard-kicker">Needs attention</span>
              <h2>Where to look first</h2>
            </div>
            <span className="sa-dashboard-panel-count">{attentionItems.length}</span>
          </div>

          {attentionItems.length ? (
            <div className="sa-attention-list">
              {attentionItems.slice(0, 5).map((item) => (
                <Link
                  key={`${item.academyId}-${item.type}`}
                  className="sa-attention-item"
                  to={`/centers?academyId=${item.academyId}`}
                >
                  <span className={`sa-attention-icon sa-attention-icon-${item.tone}`}>
                    {item.type === "attendance" ? "!" : "₹"}
                  </span>
                  <span className="sa-attention-content">
                    <strong>{item.academyName}</strong>
                    <span>{item.message}</span>
                  </span>
                  <span className="sa-attention-arrow">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="sa-dashboard-empty sa-dashboard-empty-compact">
              No major exceptions detected from the current dashboard rules.
            </div>
          )}
        </div>

        <div className="sa-dashboard-panel">
          <div className="sa-dashboard-panel-heading">
            <div>
              <span className="sa-dashboard-kicker">Attendance pulse</span>
              <h2>Last 7 days</h2>
            </div>
            <span className="sa-dashboard-panel-summary">
              {data?.totals?.attendanceRate || 0}% overall
            </span>
          </div>

          <div className="sa-attendance-pulse">
            {attendanceTrend.map((day) => (
              <div key={day.date} className="sa-attendance-day">
                <div className="sa-attendance-bar-track">
                  <span style={{ height: `${Math.max(day.attendancePercentage, 4)}%` }} />
                </div>
                <strong>{day.attendanceRecords ? `${day.attendancePercentage}%` : "—"}</strong>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sa-dashboard-footer-note">
        <span>Dashboard rule:</span>
        attendance below 70% or collection rate below 75% is surfaced as an exception.
        Financial and player drill-downs will become richer in the next phases.
      </section>
    </div>
  );
}

export default SuperAdminDashboard;
