import { useState } from "react";
import { Link } from "react-router-dom";
import "./AcademyOwnerDashboard.css";

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");

function KpiCard({ label, value, detail, to, tone = "blue" }) {
  const content = <div className="ao-kpi-card" data-tone={tone}><span>{label}</span><strong>{value}</strong><small>{detail}</small>{to && <b aria-hidden="true">→</b>}</div>;
  return to ? <Link className="ao-kpi-link" to={to} aria-label={`Open ${label}`}>{content}</Link> : content;
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = { x: cx + radius * Math.cos(startAngle), y: cy + radius * Math.sin(startAngle) };
  const end = { x: cx + radius * Math.cos(endAngle), y: cy + radius * Math.sin(endAngle) };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function PlayerDistribution({ centers }) {
  const populated = centers.filter((center) => center.players > 0);
  const colors = ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#db2777", "#64748b"];
  const totalPlayers = populated.reduce((sum, center) => sum + center.players, 0);
  const [selectedCenterId, setSelectedCenterId] = useState(populated[0]?.id || null);
  const selectedCenter = populated.find((center) => center.id === selectedCenterId) || populated[0];
  let angle = -Math.PI / 2;
  const slices = populated.map((center, index) => {
    const portion = totalPlayers ? center.players / totalPlayers : 0;
    const startAngle = angle;
    angle += portion * Math.PI * 2;
    return { ...center, color: colors[index % colors.length], startAngle, endAngle: angle };
  });

  if (!populated.length) {
    return <div className="ao-empty-card"><strong>No player assignments found.</strong><span>Active players are counted at a center when assigned to one of its active batches.</span></div>;
  }

  const groups = selectedCenter?.ageGroups || [];
  const ageGroupTotal = groups.reduce((sum, group) => sum + group.players, 0);
  return <div className="ao-distribution-card ao-distribution-card-compact">
    <div className="ao-donut-column">
      <svg className="ao-donut-chart" viewBox="0 0 200 200" role="group" aria-label="Active player distribution by center">
        {slices.map((slice) => <path key={slice.id} d={describeArc(100, 100, 72, slice.startAngle, slice.endAngle - 0.012)} fill="none" stroke={slice.color} strokeWidth="30" strokeLinecap="round" tabIndex="0" role="button" aria-label={`${slice.name}, ${slice.players} active players. Select center`} aria-pressed={slice.id === selectedCenter?.id} className={slice.id === selectedCenter?.id ? "ao-donut-slice is-selected" : "ao-donut-slice"} onClick={() => setSelectedCenterId(slice.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedCenterId(slice.id); } }} />)}
        <text x="100" y="91" textAnchor="middle" className="ao-donut-center-name">{selectedCenter?.name || "All centers"}</text>
        <text x="100" y="119" textAnchor="middle" className="ao-donut-center-count">{formatNumber(selectedCenter?.players || totalPlayers)}</text>
        <text x="100" y="136" textAnchor="middle" className="ao-donut-center-caption">active players</text>
      </svg>
      <p className="ao-donut-hint">Select a segment to view a center</p>
    </div>
    <div className="ao-age-breakdown">
      <div className="ao-age-heading"><div><span className="ao-kicker">Age profile</span><h3>{selectedCenter?.name}</h3></div><span className="ao-age-total">{formatNumber(selectedCenter?.players)} players</span></div>
      {groups.length ? <div className="ao-age-groups">{groups.map((group, index) => {
        const percentage = ageGroupTotal ? Math.round((group.players / ageGroupTotal) * 100) : 0;
        return <div className="ao-age-row" key={group.name}>
          <div className="ao-age-label"><span>{group.name}</span><strong>{formatNumber(group.players)} <small>({percentage}%)</small></strong></div>
          <div className="ao-age-track"><span style={{ width: `${percentage}%`, background: colors[index % colors.length] }} /></div>
        </div>;
      })}</div> : <div className="ao-age-empty"><strong>No age-group data available</strong><span>Check whether active batches have an age group assigned.</span></div>}
      <Link className="ao-age-link" to={`/players?academyId=${selectedCenter?.academyId || ""}&centerId=${selectedCenter?.id || ""}`}>View center players <span aria-hidden="true">→</span></Link>
    </div>
  </div>;
}

function TodaySessions({ sessions }) {
  if (!sessions.length) return <div className="ao-empty-card ao-empty-sessions"><strong>No sessions scheduled today.</strong><span>Check batch schedules if you expected training sessions to appear.</span></div>;
  return <div className="ao-session-list">{sessions.map((session) => <div className="ao-session-row" key={session.id}>
    <div className="ao-session-time">{session.startTime || "Time TBC"}<span>{session.endTime ? `– ${session.endTime}` : ""}</span></div>
    <div className="ao-session-main"><strong>{session.batchName}</strong><span>{session.centerName}</span></div>
    <span className={`ao-session-status ${session.attendanceRecorded ? "is-recorded" : "is-pending"}`}>{session.attendanceRecorded ? "Recorded" : "Not recorded"}</span>
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
      <div className="ao-batch-chart-track" aria-label={recorded ? `${present} present out of ${denominator} assigned players` : "Attendance not recorded"}><span style={{ width: `${recorded ? percent : 0}%` }} /></div>
      <div className="ao-batch-chart-value">{recorded ? <><strong>{present}/{denominator}</strong><small>{percent}%</small></> : <span className="ao-not-recorded">Not recorded</span>}</div>
    </div>;
  })}</div>;
}

function AcademyOwnerDashboard({ data, onRefresh }) {
  const centers = data?.centers || [];
  const financial = data?.financial || {};
  const sessions = data?.todaySessions || [];
  const attendanceBatches = data?.attendanceByBatch || [];

  return <div className="ao-dashboard">
    <div className="ao-dashboard-top-grid">
      <section className="ao-section ao-player-overview">
        <div className="ao-section-heading"><div><span className="ao-kicker">Player overview</span><h2>Players by center</h2></div></div>
        <PlayerDistribution centers={centers} />
      </section>
      <section className="ao-section ao-today-operations">
        <div className="ao-section-heading"><div><span className="ao-kicker">Today's operations</span><h2>Today's sessions</h2></div><button type="button" className="ao-refresh-button ao-inline-refresh" onClick={onRefresh}>Refresh</button></div>
        <TodaySessions sessions={sessions} />
      </section>
    </div>
    <section className="ao-section">
      <div className="ao-section-heading"><div><span className="ao-kicker">Attendance</span><h2>Attendance by batch</h2></div><span className="ao-helper">Present players / assigned players</span></div>
      <div className="ao-operations-card"><BatchAttendanceChart batches={attendanceBatches} /></div>
    </section>
    <section className="ao-section">
      <div className="ao-section-heading"><div><span className="ao-kicker">Financial snapshot</span><h2>Collections and outstanding</h2></div><span className="ao-helper">Current payment ledger</span></div>
      <div className="ao-financial-workspace">
        <div className="ao-financial-primary">
          <KpiCard label="Total billed" value={formatCurrency(financial.totalBilled)} detail="Current payment due ledger" to="/payment-dues" />
          <KpiCard label="Collected this month" value={formatCurrency(financial.collectionsThisMonth)} detail={`${financial.collectionRate || 0}% of billed dues collected`} to="/payment-collections" tone="green" />
          <KpiCard label="Outstanding" value={formatCurrency(financial.outstandingAmount)} detail={`${formatNumber((financial.pendingDues || 0) + (financial.partialDues || 0))} pending/partial dues`} to="/payment-dues" tone="orange" />
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
