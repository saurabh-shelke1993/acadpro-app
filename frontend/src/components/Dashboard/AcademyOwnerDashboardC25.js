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
            <div className="c25-donut-inner"><span>Assigned to centers</span><strong>{formatCount(memberships)}</strong><small>center memberships</small></div>
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
            <div className="c25-batch-list">{current.batches.map(b => <div key={b.id} className="c25-batch-item"><span>{b.name}</span><b>{formatCount(b.players)}</b></div>)}</div> :
            <Empty title="No active batches" detail="This center has no configured age-group batches." />}
          <Link className="c25-action-link" to={centerPlayersPath(current)}>View center players <span aria-hidden="true">↗</span></Link>
        </div>
      </div>}
  </section>;
}
function Sessions({ data }) {
  const [expanded, setExpanded] = useState(false);
  const sessions = data.sessions;
  const visible = sessions?.slice(0, expanded ? undefined : 4);
  const groups = groupByCenter(visible, s=>s.centerId || s.centerName || "unassigned", s=>s.centerName || "Unassigned center");
  return <section className="c25-panel c25-sessions" aria-label="Today's training sessions">
    <SectionHead eyebrow="Training day" title="Today's sessions" right={<span className="c25-pill">{sessions?.length ?? "—"} scheduled</span>} />
    {sessions === null ? <Empty title="Today's schedule unavailable" detail="Training information was not returned." /> :
      !sessions.length ? <Empty title="No training today" detail="Check batch schedules if sessions were expected." /> :
      <>
        <div className="c25-session-list">{groups.map(g => <div className="c25-session-center" key={g.key}>
          <h3>{g.name}</h3>
          {g.rows.map(s => <div className="c25-session-row" key={s.id}>
            <div><strong>{s.batchName || "Unnamed batch"}</strong><span>{formatTime(s.startTime)}{s.endTime ? " – " + formatTime(s.endTime) : ""}</span></div>
            <Link to={attendancePath(s)} aria-label={"Open attendance for " + s.batchName + " at " + g.name}>Attendance <span aria-hidden="true">↗</span></Link>
          </div>)}
        </div>)}</div>
        {sessions.length > 4 && <button className="c25-expand" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show fewer sessions" : "Show all " + sessions.length + " sessions"} <span aria-hidden="true">{expanded ? "↑" : "↓"}</span>
        </button>}
      </>}
  </section>;
}
function Attendance({ data }) {
  const batches = data.attendanceBatches;
  const summary = recordedMarkSummary(batches);
  const groups = groupByCenter(batches, b=>b.centerName || "Unassigned center", b=>b.centerName || "Unassigned center");
  return <section className="c25-panel c25-attendance" aria-label="Weekly attendance by batch">
    <SectionHead eyebrow="Training consistency" title="Weekly attendance by batch" right={<span className="c25-pill">Last 7 days</span>}/>
    <p className="c25-note">Present marks ÷ recorded present/absent marks. This is not expected-session coverage.</p>
    {batches === null ? <Empty title="Attendance unavailable" detail="No attendance source records were returned." /> :
      summary.rate === null ? <Empty title="No attendance marks" detail="The chart will appear when a coach records attendance." /> :
      <>
        <div className="c25-attendance-summary"><div><strong>{summary.rate}%</strong><span>Recorded-mark attendance</span></div><div><strong>{summary.recordedBatches}/{summary.totalBatches}</strong><span>Batches with marks</span></div><Link className="c25-action-link" to="/attendance">Open attendance ↗</Link></div>
        <div className="c25-attendance-groups">{groups.map(g=><section className="c25-attendance-group" key={g.key}><h3>{g.name}</h3>
          {g.rows.map(b=>{
            const rate = Number(b.totalRecords) > 0 ? Math.round(Number(b.presentRecords || 0) / Number(b.totalRecords) * 100) : null;
            return <div className="c25-attendance-row" key={b.id || b.batchId || b.batchName}>
              <span>{b.batchName}</span><div className="c25-bar" role="img" aria-label={b.batchName + ": " + (rate === null ? "no recorded marks" : rate + "% attendance")}><i style={{width:(rate ?? 0) + "%"}}/></div>
              <b>{rate === null ? "—" : rate + "%"}</b></div>;
          })}
        </section>)}</div>
      </>}
  </section>;
}
function Finances({ data }) {
  const f = data.financial;
  const items=[
    ["Billed this month",f?.totalBilledThisMonth,"Dues scheduled this month","/payment-dues"],
    ["Collected this month",f?.collectionsThisMonth,"Recorded collections","/payment-collections"],
    ["Expenses this month",f?.expensesThisMonth,"Recorded expenses","/expenses"],
    ["Current outstanding",f?.outstandingAmount,"Current unpaid balance","/payment-dues"]
  ];
  return <section className="c25-panel c25-finances" aria-label="Monthly finances">
    <SectionHead eyebrow="Financial snapshot" title="Monthly finances" right={<span className="c25-pill">{new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</span>}/>
    {f === null ? <Empty title="Financial data unavailable" detail="Unavailable amounts are not shown as zero." /> : <>
      <div className="c25-finance-grid">{items.map(([label,value,detail,to])=><Link key={label} className="c25-finance-tile" to={to}><span>{label}</span><strong>{formatMoney(value)}</strong><small>{detail}</small><b aria-hidden="true">↗</b></Link>)}</div>
      <div className="c25-finance-status" aria-label="Payment due statuses">
        <div><span>Pending</span><b>{formatCount(f.pendingDues)}</b></div><div><span>Partial</span><b>{formatCount(f.partialDues)}</b></div>
        <div><span>Paid</span><b>{formatCount(f.paidDues)}</b></div><div><span>Collection rate</span><b>{f.collectionRate == null ? "—" : String(f.collectionRate) + "%"}</b></div>
      </div>
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
  const adapted=useMemo(()=>adaptOwnerData(data),[data]);
  if (!adapted) return <div className="c25-dashboard"><Empty title="Dashboard unavailable" detail="Academy dashboard data was not returned." /></div>;
  return <div className="c25-dashboard">
    <div className="c25-preview-bar"><span>UI-C2.5 · Academy Owner preview only</span><Link to="/dashboard">Return to current dashboard ↗</Link></div>
    <header className="c25-pagehead"><div><span className="c25-eyebrow">Kheltriva · Football operations</span><h1>Academy overview</h1><p>{adapted.academyName} · Your training day at a glance</p></div><span className="c25-tag">FOOTBALL FIRST</span></header>
    <div className="c25-top"><Overview data={adapted}/><Sessions data={adapted}/></div>
    <Attendance data={adapted}/>
    <div className="c25-bottom"><Finances data={adapted}/><Enquiries data={adapted}/></div>
  </div>;
}
