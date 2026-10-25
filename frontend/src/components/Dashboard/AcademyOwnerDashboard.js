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

function PlayerDistribution({ centers, academyPlayerTotal }) {
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
        {slices.map((slice) => <path key={slice.id} d={describeArc(100, 100, 72, slice.startAngle, slice.endAngle - 0.035)} fill="none" stroke={slice.color} strokeWidth="28" strokeLinecap="butt" tabIndex="0" role="button" aria-label={`${slice.name}, ${slice.players} active players. Select center`} aria-pressed={slice.id === selectedCenter?.id} className={slice.id === selectedCenter?.id ? "ao-donut-slice is-selected" : "ao-donut-slice"} onClick={() => setSelectedCenterId(slice.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedCenterId(slice.id); } }} />)}
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
  const groups = batches.reduce((result, batch) => {
    const name = batch.centerName || "Unassigned center";
    let group = result.find((item) => item.centerName === name);
    if (!group) { group = { centerName: name, batches: [] }; result.push(group); }
    group.batches.push(batch);
    return result;
  }, []);
  const chartBatches = groups.flatMap((group) => group.batches);
  const batchesWithData = chartBatches.filter((batch) => (batch.totalRecords || 0) > 0);
  const presentTotal = chartBatches.reduce((sum, batch) => sum + (batch.presentRecords || 0), 0);
  const markedTotal = chartBatches.reduce((sum, batch) => sum + (batch.totalRecords || 0), 0);
  const academyRate = markedTotal ? Math.round((presentTotal / markedTotal) * 100) : null;
  const groupGaps = Math.max(0, groups.length - 1) * 10;
  const chartWidth = chartBatches.length <= 15 ? 1400 : Math.max(1400, chartBatches.length * 76 + 58 + groupGaps);
  const step = (chartWidth - 58 - groupGaps) / chartBatches.length;
  const chartHeight = 282;
  const plot = { left: 42, right: chartWidth - 18, top: 24, bottom: 168 };
  const plotHeight = plot.bottom - plot.top;
  let offset = plot.left;
  const layouts = groups.map((group, index) => {
    const layout = { ...group, x: offset, width: group.batches.length * step };
    offset += layout.width + (index < groups.length - 1 ? 10 : 0);
    return layout;
  });
  const barWidth = Math.min(30, step * 0.54);
  return <div className="ao-column-attendance">
    <div className="ao-weekly-summary">
      <div className="ao-weekly-summary-primary"><span>Weekly attendance</span><strong>{academyRate === null ? "—" : `${academyRate}%`}</strong></div>
      <div className="ao-weekly-summary-detail"><strong>{batchesWithData.length} of {chartBatches.length}</strong><span>batches with attendance recorded</span></div>
      <span className="ao-weekly-period">Last 7 days</span>
    </div>
    <div className="ao-column-chart-scroll">
      <svg className={`ao-column-chart-svg ${chartBatches.length > 15 ? "is-dense" : ""}`} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: `${chartWidth}px` }} role="img" aria-label="Weekly attendance column chart grouped by center, with percentage on the vertical axis.">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = plot.bottom - tick / 100 * plotHeight;
          return <g key={tick}><line x1={plot.left} y1={y} x2={plot.right} y2={y} className="ao-column-gridline" /><text x={plot.left - 8} y={y + 4} textAnchor="end" className="ao-column-y-tick">{tick}%</text></g>;
        })}
        {layouts.map((group, index) => <g key={group.centerName}>
          {index > 0 && <line x1={group.x - 5} y1={plot.top - 4} x2={group.x - 5} y2={chartHeight - 36} className="ao-column-group-divider" />}
          <text x={group.x + group.width / 2} y={chartHeight - 17} textAnchor="middle" className="ao-column-group-label"><title>{group.centerName}</title>{group.centerName.length > 26 ? `${group.centerName.slice(0, 25)}…` : group.centerName}</text>
        </g>)}
        {layouts.flatMap((group) => group.batches.map((batch, index) => {
          const recorded = (batch.totalRecords || 0) > 0;
          const percent = recorded ? Math.max(0, Math.min(100, batch.attendanceRate || 0)) : 0;
          const x = group.x + index * step + (step - barWidth) / 2;
          const barHeight = percent / 100 * plotHeight;
          const label = String(batch.batchName || "Batch");
          const max = step < 80 ? 11 : 18;
          const short = label.length > max ? `${label.slice(0, max - 1)}…` : label;
          return <g key={batch.id}>
            {recorded && <><rect x={x} y={plot.bottom - barHeight} width={barWidth} height={Math.max(2, barHeight)} rx="3" className="ao-column-bar"><title>{`${label} · ${group.centerName}: ${percent}% attendance`}</title></rect><text x={x + barWidth / 2} y={Math.max(plot.top + 12, plot.bottom - barHeight - 6)} textAnchor="middle" className="ao-column-value">{percent}%</text></>}
            {!recorded && <text x={x + barWidth / 2} y={plot.bottom - 7} textAnchor="middle" className="ao-column-no-data">—</text>}
            <text x={x + barWidth / 2} y={plot.bottom + 20} textAnchor="middle" className="ao-column-x-label"><title>{label}</title>{short}</text>
          </g>;
        }))}
      </svg>
    </div>
    {academyRate === null && <p className="ao-weekly-note">No attendance has been recorded in the last 7 days. Columns will appear when coaches mark players present or absent.</p>}
    <p className="ao-weekly-note">Weekly rate = present marks ÷ (present + absent marks). Only recorded marks from the last 7 days are included. A dash indicates no data.</p>
  </div>;
}

function AcademyOwnerDashboard({ data, onRefresh }) {
  const centers = data?.centers || [];
  const financial = data?.financial || {};
  const sessions = data?.todaySessions || [];
  const attendanceBatches = data?.attendanceByBatch || [];

  return <div className="ao-dashboard">
    <div className="ao-dashboard-top-grid">
      <section className="ao-section ao-player-overview">
        <div className="ao-section-heading ao-player-overview-heading">
          <div><span className="ao-kicker">Player overview</span><h2>Players by center</h2></div>
          <div className="ao-academy-totals" aria-label="Academy totals"><div className="ao-academy-total"><span>Players</span><strong>{formatNumber(data?.totals?.players || 0)}</strong></div><div className="ao-academy-total"><span>Centers</span><strong>{formatNumber(data?.totals?.centers || 0)}</strong></div><div className="ao-academy-total"><span>Batches</span><strong>{formatNumber(data?.totals?.batches || 0)}</strong></div></div>
        </div>
        <PlayerDistribution centers={centers} academyPlayerTotal={data?.totals?.players || 0} />
      </section>
      <section className="ao-section ao-today-operations">
        <div className="ao-section-heading"><div><span className="ao-kicker">Today's operations</span><h2>Today's sessions</h2></div><button type="button" className="ao-refresh-button ao-inline-refresh" onClick={onRefresh}>Refresh</button></div>
        <TodaySessions sessions={sessions} />
      </section>
    </div>
    <section className="ao-section">
      <div className="ao-section-heading"><div><span className="ao-kicker">Attendance</span><h2>Weekly attendance by batch</h2></div><span className="ao-helper">Present marks ÷ all recorded marks · Last 7 days</span></div>
      <div className="ao-operations-card"><BatchAttendanceChart batches={attendanceBatches} /></div>
    </section>
    <section className="ao-section ao-bottom-workspace">
      <div className="ao-financial-panel">
        <div className="ao-section-heading"><div><span className="ao-kicker">Financial snapshot</span><h2>Monthly finances</h2></div><span className="ao-helper">{new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span></div>
        <div className="ao-financial-workspace">
          <div className="ao-financial-primary ao-financial-monthly">
            <KpiCard label="Billed this month" value={formatCurrency(financial.totalBilledThisMonth)} detail="Dues scheduled this month" to="/payment-dues" />
            <KpiCard label="Collected this month" value={formatCurrency(financial.collectionsThisMonth)} detail={`${financial.collectionRate || 0}% of this month's billed dues`} to="/payment-collections" tone="green" />
            <KpiCard label="Expenses this month" value={formatCurrency(financial.expensesThisMonth)} detail="Recorded actual expenses" to="/expenses" tone="orange" />
            <KpiCard label="Outstanding dues" value={formatCurrency(financial.outstandingAmount)} detail={`${formatNumber((financial.pendingDues || 0) + (financial.partialDues || 0))} pending or partial dues`} to="/payment-dues" tone="orange" />
          </div>
          <div className="ao-financial-status ao-financial-status-compact">
            <div><span>Pending</span><strong>{formatNumber(financial.pendingDues)}</strong></div>
            <div><span>Partial</span><strong>{formatNumber(financial.partialDues)}</strong></div>
            <div><span>Paid</span><strong>{formatNumber(financial.paidDues)}</strong></div>
            <div><span>Collection rate</span><strong>{financial.collectionRate || 0}%</strong></div>
          </div>
        </div>
      </div>
      <aside className="ao-enquiry-panel">
        <div className="ao-section-heading ao-enquiry-heading"><div><span className="ao-kicker">Admissions</span><h2>Enquiries</h2></div><Link className="ao-enquiry-view-all" to="/enquiries">View all →</Link></div>
        <div className="ao-enquiry-summary"><strong>{formatNumber(data?.enquirySummary?.total || 0)}</strong><span>received this month</span></div>
        <div className="ao-enquiry-groups">
          {(data?.enquirySummary?.groups || []).length ? [...data.enquirySummary.groups]
            .sort((a, b) => b.total - a.total || a.centerName.localeCompare(b.centerName))
            .slice(0, 4)
            .map((group) => (
              <div className="ao-enquiry-center" key={group.centerId}>
                <div className="ao-enquiry-center-heading">
                  <strong title={group.centerName}>{group.centerName}</strong>
                  <Link
                    className="ao-enquiry-count-link"
                    to={`/enquiries?centerId=${encodeURIComponent(group.centerId || "")}`}
                    aria-label={`View ${group.total} enquiries for ${group.centerName}`}
                    title={`View enquiries for ${group.centerName}`}
                  >
                    {formatNumber(group.total)}
                  </Link>
                </div>
              </div>
            )) : <div className="ao-enquiry-empty"><strong>No enquiries this month</strong><span>New enquiries will appear here, grouped by center.</span></div>}
        </div>
      </aside>
    </section>
  </div>;
}

export default AcademyOwnerDashboard;
