import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  adaptOwnerData, attendancePath, centerPlayersPath, enquiriesPath,
  formatCount, formatMoney, formatTime, groupByCenter, recordedMarkSummary
} from "./academyOwnerC25Adapter";
import "./AcademyOwnerDashboardC25.css";

/**
 * Isolated UI-C2.5 preview only. The existing Dashboard route/role detection,
 * service data contract, Supabase RLS and navigation are unchanged.
 */
function SectionHead({ eyebrow, title, right }) {
  return <header className="c25-section-head">
    <div><span className="c25-eyebrow">{eyebrow}</span><h2>{title}</h2></div>
    {right && <div className="c25-section-right">{right}</div>}
  </header>;
}
function Empty({ title, detail }) {
  return <div className="c25-empty" role="status"><strong>{title}</strong><p>{detail}</p></div>;
}
function Overview({ data }) {
  const [selectedId, setSelectedId] = useState(null);
  const centers = data.centers;
  const current = centers?.find((c) => c.id === selectedId) || centers?.[0];
  const memberships = (centers || []).reduce((sum,c) => sum + c.players, 0);
  let position = 0;
  const colors = (centers || []).filter(c => c.players > 0).map(c => {
    const start = position;
    position += memberships ? c.players / memberships * 100 : 0;
    return c.color + " " + start + "% " + position + "%";
  });
  return <section className="c25-panel c25-overview" aria-label="Players by center">
    <SectionHead eyebrow="Squad overview" title="Players by center" right={
      <nav className="c25-stats" aria-label="Academy totals">
        <Link to="/players"><strong>{formatCount(data.totals.players)}</strong><span>Players</span></Link>
        <Link to="/centers"><strong>{formatCount(data.totals.centers)}</strong><span>Centers</span></Link>
        <Link to="/batches"><strong>{formatCount(data.totals.batches)}</strong><span>Batches</span></Link>
      </nav>
    } />
    {centers === null ? <Empty title="Center data unavailable" detail="Player distribution could not be loaded." /> :
      !centers.length ? <Empty title="No training centers" detail="Create a center to begin managing your squads." /> :
      <div className="c25-overview-grid">
        <div className="c25-distribution">
          <div className="c25-donut" style={{background: colors.length ? "conic-gradient(" + colors.join(",") + ")" : "#dbe4ef"}}
            role="img" aria-label={"Center-player memberships: " + formatCount(memberships)}>
            <div className="c25-donut-inner"><span>Center assignments</span><strong>{formatCount(memberships)}</strong><small>memberships · not unique players</small></div>
          </div>
          <div className="c25-centers" role="group" aria-label="Choose training center">
            {centers.map(c => <button key={c.id} type="button" aria-pressed={current?.id === c.id}
              className={current?.id === c.id ? "selected" : ""} onClick={() => setSelectedId(c.id)}>
              <i style={{background:c.color}} aria-hidden="true"/><span>{c.name}</span><b>{formatCount(c.players)}</b>
            </button>)}
          </div>
        </div>
        <div className="c25-batch-panel">
          <div className="c25-batch-title"><div><span className="c25-eyebrow">Batch breakdown</span><h3>{current?.name}</h3></div><strong>{formatCount(current?.players)} players</strong></div>
          {current?.batches.length ?
            <div className="c25-batch-list">{current.batches.map(b => <div key={b.id} className={"c25-batch-item" + (b.players === 0 ? " is-empty" : "")}><span>{b.name}</span><b>{formatCount(b.players)} <small>players</small></b></div>)}</div> :
            <Empty title="No active batches" detail="This center has no configured age-group batches." />}
          <Link className="c25-action-link" to={centerPlayersPath(current)}>View center players <span aria-hidden="true">↗</span></Link>
        </div>
      </div>}
  </section>;
}
function Sessions({ data }) {
  const sessions = data.sessions;
  const groups = groupByCenter(sessions, s => s.centerId || s.centerName || "unassigned", s => s.centerName || "Unassigned center");
  const noMarks = sessions ? sessions.filter(s => !s.attendanceRecorded).length : 0;
  return <section className="c25-panel c25-sessions" aria-label="Today's training sessions" id="today-training">
    <SectionHead eyebrow="Training day" title="Today's sessions" right={<span className="c25-pill">{sessions?.length ?? "—"} scheduled</span>}/>
    {sessions === null ? <Empty title="Sessions unavailable" detail="Today's training schedule could not be loaded." /> :
      !sessions.length ? <Empty title="No sessions today" detail="Check batch schedules if training was expected." /> : <>
        <div className="c25-session-overview">
          <strong>{formatCount(noMarks)}</strong> <span>{noMarks === 1 ? "batch without marks" : "batches without marks"} today</span>
        </div>
        <div className="c25-session-list">{groups.map(group => <section className="c25-session-center" key={group.key}>
          <h3>{group.name}</h3>
          {group.rows.map(s => <div className="c25-session-row" key={s.id}>
            <div className="c25-session-detail">
              <strong>{s.batchName || "Unnamed batch"}</strong>
              <span>{formatTime(s.startTime)}{s.endTime ? " – " + formatTime(s.endTime) : ""}</span>
              <span className={"c25-session-status " + (s.attendanceRecorded ? "is-marked" : "is-unmarked")}>{s.attendanceRecorded ? "Marks recorded" : "No marks yet"}</span>
            </div>
            <Link to={attendancePath(s)} aria-label={"Open attendance for " + (s.batchName || "batch") + " at " + group.name}>Attendance <span aria-hidden="true">↗</span></Link>
          </div>)}
        </section>)}</div>
        <p className="c25-footnote">Status means at least one attendance mark exists for the batch today; it does not confirm every player is marked.</p>
      </>}
  </section>;
}
function Attendance({ data }) {
  const batches = data.attendanceBatches;
  const summary = recordedMarkSummary(batches);
  const groups = groupByCenter(batches, b => b.centerName || "Unassigned center", b => b.centerName || "Unassigned center");
  return <section className="c25-panel c25-attendance" aria-label="Weekly attendance by batch">
    <SectionHead eyebrow="Training consistency" title="Weekly attendance by batch" right={<span className="c25-pill">Last 7 days</span>}/>
    {batches === null ? <Empty title="Attendance unavailable" detail="Attendance source information could not be loaded." /> :
      summary.rate === null ? <Empty title="No attendance marks" detail="Attendance appears after coaches record present and absent marks." /> : <>
        <div className="c25-attendance-summary">
          <div className="c25-attendance-primary"><strong>{summary.rate}%</strong><span>Present among recorded marks</span></div>
          <div><strong>{summary.recordedBatches} of {summary.totalBatches}</strong><span>Batches with marks</span></div>
          <Link className="c25-action-link" to="/attendance">Open attendance ↗</Link>
        </div>
        <p className="c25-note">Recorded-mark rate = present ÷ recorded present/absent marks. It is not training-session coverage.</p>
        <div className="c25-attendance-groups">{groups.map(g => {
          const hasMarks = g.rows.filter(r => Number(r.totalRecords) > 0).length;
          return <section className="c25-attendance-group" key={g.key}>
            <div className="c25-attendance-group-head"><h3>{g.name}</h3><span>{hasMarks} of {g.rows.length} batches with marks</span></div>
            {g.rows.map(b => {
              const hasData = Number(b.totalRecords) > 0;
              const rate = hasData ? Math.round(Number(b.presentRecords || 0) / Number(b.totalRecords) * 100) : null;
              return <div className={"c25-attendance-row" + (hasData ? "" : " is-no-data")} key={b.id || b.batchId || b.batchName}>
                <span>{b.batchName || "Unnamed batch"}</span>
                <div className="c25-bar" role="img" aria-label={(b.batchName || "Batch") + ": " + (rate === null ? "no recorded marks" : rate + "% of recorded marks present")}>
                  <i style={{ width: (rate ?? 0) + "%" }}/>
                </div>
                <b>{rate === null ? "No marks" : rate + "%"}</b>
              </div>;
            })}
          </section>;
        })}</div>
      </>}
  </section>;
}
function Finances({ data }) {
  const f = data.financial;
  const items = [
    ["Billed this month", f?.totalBilledThisMonth, "Dues scheduled this month", "/payment-dues"],
    ["Collected this month", f?.collectionsThisMonth, "Recorded collections", "/payment-collections"],
    ["Expenses this month", f?.expensesThisMonth, "Recorded expenses", "/expenses"],
    ["Current outstanding", f?.outstandingAmount, "Current unpaid balance, including earlier periods", "/payment-dues"]
  ];
  const hasBillingDenominator = f !== null && f.totalBilledThisMonth != null && Number(f.totalBilledThisMonth) > 0;
  const collectionRateLabel = hasBillingDenominator && Number.isFinite(Number(f.collectionRate)) ? formatCount(f.collectionRate) + "%" : "N/A";
  return <section className="c25-panel c25-finances" aria-label="Monthly finances">
    <SectionHead eyebrow="Financial snapshot" title="Monthly finances" right={<span className="c25-pill">{new Date().toLocaleDateString("en-IN", {month:"long",year:"numeric"})}</span>}/>
    {f === null ? <Empty title="Financial information unavailable" detail="Unavailable amounts are not displayed as zero." /> : <>
      <div className="c25-finance-grid">{items.map(([label, value, detail, to]) => <Link key={label}
        className={"c25-finance-tile" + (label === "Current outstanding" && Number(value) > 0 ? " is-outstanding" : "")} to={to}>
        <span>{label}</span><strong>{formatMoney(value)}</strong><small>{detail}</small><b aria-hidden="true">↗</b>
      </Link>)}</div>
      <div className="c25-finance-status" aria-label="Payment due status counts and collection rate">
        <div><span>Pending</span><b>{formatCount(f.pendingDues)}</b></div>
        <div><span>Partial</span><b>{formatCount(f.partialDues)}</b></div>
        <div><span>Paid</span><b>{formatCount(f.paidDues)}</b></div>
        <div><span>Monthly collection rate</span><b>{collectionRateLabel}</b></div>
      </div>
      <p className="c25-finance-note">{hasBillingDenominator
        ? "Monthly rate = collections this month ÷ dues billed this month."
        : "Collection rate N/A: no dues were billed this month. Outstanding may include earlier periods."}</p>
    </>}
  </section>;
}
function Enquiries({ data }) {
  const e=data.enquiries;
  const groups=Array.isArray(e?.groups) ? [...e.groups].sort((a,b)=>(Number(b.total)-Number(a.total)) || String(a.centerName).localeCompare(String(b.centerName))).slice(0,4) : [];
  return <section className="c25-panel c25-enquiries" aria-label="Admissions and enquiries">
    <SectionHead eyebrow="Admissions" title="Enquiries" right={<Link className="c25-action-link" to="/enquiries">View all ↗</Link>}/>
    {e === null ? <Empty title="Enquiries unavailable" detail="Admissions information was not returned." /> : <>
      <div className="c25-enquiry-count"><strong>{formatCount(e.total)}</strong><span>received this month</span></div>
      {groups.length ? <div className="c25-enquiry-list">{groups.map(g=><Link key={g.centerId || g.centerName} to={enquiriesPath(g)} aria-label={"View enquiries for " + g.centerName}><span>{g.centerName}</span><b>{formatCount(g.total)} ↗</b></Link>)}</div> :
      <p className="c25-note">No enquiries received this month.</p>}
    </>}
  </section>;
}
export default function AcademyOwnerDashboardC25({ data }) {
  const adapted = useMemo(() => adaptOwnerData(data), [data]);
  if (!adapted) return <div className="c25-dashboard"><Empty title="Dashboard unavailable" detail="Academy dashboard data was not returned." /></div>;
  return <div className="c25-dashboard c26-refined">
    <header className="c25-pagehead">
      <div className="c25-page-identity">
        <span className="c25-eyebrow">Kheltriva · Football operations</span>
        <h1>Academy overview</h1>
        <p>{adapted.academyName} · Your training day at a glance</p>
      </div>
      <div className="c25-preview-actions">
        <span className="c25-preview-badge">UI-C2.6 preview</span>
        <Link to="/dashboard" className="c25-preview-return">← Current dashboard</Link>
      </div>
    </header>
    <div className="c25-top"><Overview data={adapted}/><Sessions data={adapted}/></div>
    <Attendance data={adapted}/>
    <div className="c25-bottom"><Finances data={adapted}/><Enquiries data={adapted}/></div>
  </div>;
}
