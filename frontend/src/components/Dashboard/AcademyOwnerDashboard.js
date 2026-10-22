import { Link } from "react-router-dom";
import "./AcademyOwnerDashboard.css";

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");

function KpiCard({ label, value, detail, to, tone = "blue" }) {
  const content = <div className="ao-kpi-card" data-tone={tone}><span>{label}</span><strong>{value}</strong><small>{detail}</small>{to && <b aria-hidden="true">→</b>}</div>;
  return to ? <Link className="ao-kpi-link" to={to} aria-label={`Open ${label}`}>{content}</Link> : content;
}

function PlayerDistribution({ centers, totalPlayers }) {
  const populated = centers.filter((center) => center.players > 0);
  const colors = ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#db2777", "#64748b"];
  let cumulative = 0;
  const slices = populated.map((center, index) => {
    const percentage = totalPlayers ? (center.players / totalPlayers) * 100 : 0;
    const slice = { ...center, percentage, color: colors[index % colors.length], offset: cumulative };
    cumulative += percentage;
    return slice;
  });
  return (
    <div className="ao-distribution-card">
      {populated.length ? <>
        <div className="ao-donut" role="img" aria-label={slices.map((s) => `${s.name}: ${s.players} players`).join(", ")} style={{ background: `conic-gradient(${slices.map((s) => `${s.color} ${s.offset}% ${s.offset + s.percentage}%`).join(", ")})` }}>
          <div className="ao-donut-center"><strong>{formatNumber(totalPlayers)}</strong><span>Active players</span></div>
        </div>
        <div className="ao-distribution-legend">{slices.map((center) => <Link key={center.id} to={`/players?academyId=${center.academyId}&centerId=${center.id}`} className="ao-legend-row">
          <span className="ao-legend-dot" style={{ background: center.color }} />
          <span className="ao-legend-name">{center.name}</span><strong>{formatNumber(center.players)}</strong><small>{Math.round(center.percentage)}%</small>
        </Link>)}</div>
      </> : <div className="ao-empty-card"><strong>No player assignments found.</strong><span>Active players are counted at a center when assigned to one of its active batches.</span></div>}
    </div>
  );
}

function TodaySessions({ sessions }) {
  if (!sessions.length) return <div className="ao-empty-card"><strong>No sessions scheduled for today.</strong><span>Check batch schedules if you expected training sessions to appear.</span></div>;
  return <div className="ao-session-list">{sessions.map((session) => <div className="ao-session-row" key={session.id}>
    <div className="ao-session-time">{session.startTime || "Time TBC"}<span>{session.endTime ? `– ${session.endTime}` : ""}</span></div>
    <div className="ao-session-main"><strong>{session.batchName}</strong><span>{session.centerName}</span></div>
    <span className={`ao-session-status ${session.attendanceRecorded ? "is-recorded" : "is-pending"}`}>{session.attendanceRecorded ? "Attendance recorded" : "Not recorded"}</span>
    <Link to={`/attendance?batchId=${session.batchId}`} aria-label={`Open attendance for ${session.batchName}`}>→</Link>
  </div>)}</div>;
}

function BatchAttendanceChart({ batches }) {
  if (!batches.length) return <div className="ao-empty-card"><strong>No active batches found.</strong><span>Active batches will appear here when configured.</span></div>;
  return <div className="ao-batch-chart">{batches.map((batch) => {
    const denominator = batch.expectedPlayers || 0;
    const present = batch.presentPlayers || 0;
    const percent = denominator ? Math.min(100, Math.round((present / denominator) * 100)) : 0;
    const recorded = batch.attendanceRecorded;
    return <div className="ao-batch-chart-row" key={batch.id}>
      <div className="ao-batch-chart-label"><strong>{batch.batchName}</strong><span>{batch.centerName}</span></div>
      <div className="ao-batch-chart-track" aria-label={recorded ? `${present} present out of ${denominator} assigned players` : "Attendance not recorded"}>
        <span style={{ width: `${recorded ? percent : 0}%` }} />
      </div>
      <div className="ao-batch-chart-value">{recorded ? <><strong>{present}/{denominator}</strong><small>{percent}%</small></> : <span className="ao-not-recorded">Not recorded</span>}</div>
    </div>;
  })}</div>;
}

function AcademyOwnerDashboard({ data, onRefresh }) {
  const centers = data?.centers || [];
  const financial = data?.financial || {};
  const sessions = data?.todaySessions || [];
  const attendanceBatches = data?.attendanceByBatch || [];
  const today = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date());

  return <div className="ao-dashboard">
    <header className="ao-dashboard-header ao-dashboard-header-compact">
      <div><h1>Academy Dashboard</h1><p>{data?.academyName || "Your academy"} <span aria-hidden="true">·</span> Academy Owner</p></div>
      <div className="ao-header-actions"><span className="ao-date">{today}</span><button type="button" className="ao-refresh-button" onClick={onRefresh}>Refresh</button></div>
    </header>

    <section className="ao-section ao-section-first">
      <div className="ao-section-heading"><div><span className="ao-kicker">Player overview</span><h2>Players by center</h2></div><span className="ao-helper">Active player assignments</span></div>
      <PlayerDistribution centers={centers} totalPlayers={centers.reduce((sum, center) => sum + (center.players || 0), 0)} />
    </section>

    <section className="ao-section">
      <div className="ao-section-heading"><div><span className="ao-kicker">Today's operations</span><h2>Today's sessions</h2></div><span className="ao-helper">{sessions.length} scheduled session{sessions.length === 1 ? "" : "s"}</span></div>
      <TodaySessions sessions={sessions} />
    </section>

    <section className="ao-section">
      <div className="ao-section-heading"><div><span className="ao-kicker">Attendance</span><h2>Attendance by batch</h2></div><span className="ao-helper">Present players / assigned players</span></div>
      <div className="ao-operations-card"><BatchAttendanceChart batches={attendanceBatches} /></div>
    </section>

    <section className="ao-section">
      <div className="ao-section-heading"><div><span className="ao-kicker">Financial snapshot</span><h2>Collections and outstanding</h2></div><span className="ao-helper">Current payment ledger</span></div>
      <div className="ao-financial-workspace">
        <div className="ao-financial-primary">
          <KpiCard label="Total billed" value={formatCurrency(financial.totalBilled)} detail="Current payment due ledger" to="/payment-dues" />
          <KpiCard label="Collected this month" value={formatCurrency(financial.collectionsThisMonth)} detail={`${financial.collectionRate}% of billed dues collected`} to="/payment-collections" tone="green" />
          <KpiCard label="Outstanding" value={formatCurrency(financial.outstandingAmount)} detail={`${formatNumber(financial.pendingDues + financial.partialDues)} pending/partial dues`} to="/payment-dues" tone="orange" />
        </div>
        <div className="ao-financial-status">
          <div><span>Pending</span><strong>{formatNumber(financial.pendingDues)}</strong></div>
          <div><span>Partial</span><strong>{formatNumber(financial.partialDues)}</strong></div>
          <div><span>Paid</span><strong>{formatNumber(financial.paidDues)}</strong></div>
          <div><span>Collection rate</span><strong>{financial.collectionRate || 0}%</strong></div>
        </div>
      </div>
    </section>
  </div>;
}

export default AcademyOwnerDashboard;
