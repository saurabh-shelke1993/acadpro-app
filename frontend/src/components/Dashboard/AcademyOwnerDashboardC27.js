import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  adaptOwnerData, attendancePath, centerPlayersPath, enquiriesPath,
  formatCount, formatMoney, formatTime, groupByCenter, recordedMarkSummary
} from "./academyOwnerC25Adapter";
import "./AcademyOwnerDashboardC27.css";
import "./AcademyOwnerDashboardC29.css";
import "./AcademyOwnerDashboardC30.css";

/**
 * UI-C2.7 visual candidate. Academy Owner only through the existing ProtectedRoute.
 * Read-only: reuses the existing dashboard service contract and scoped navigation.
 */
const DASHBOARD_PALETTES = [
  {id:"classic",label:"Classic Blue",color:"#245bdc"},
  {id:"pitchside",label:"Pitchside Emerald",color:"#087c6e"},
  {id:"floodlight",label:"Floodlight Indigo",color:"#4f46cf"}
];
const PITCHSIDE_CENTER_COLORS = ["#087C6E","#A6C96A","#CE9B55","#4F8C86","#947BA6"];
const PALETTE_LAB_THEMES = [
{id:"scarlet",name:"Stadium Scarlet",description:"Bold football-club energy",deep:"#1F252C",primary:"#B32137",accent:"#F8A18C",canvas:"#FAF5F5",chartColors:["#B32137","#F28A75","#68717B","#D4A296"]},
{id:"maroon",name:"Heritage Maroon",description:"Prestigious club heritage",deep:"#361D2A",primary:"#7B2849",accent:"#EBC58E",canvas:"#FCF7F7",chartColors:["#7B2849","#B65D7B","#DCAF75","#8D7082"]},
{id:"terracotta",name:"Terracotta & Sand",description:"Warm, distinctive character",deep:"#3C2C26",primary:"#A4472B",accent:"#F3C796",canvas:"#FCF7EF",chartColors:["#A4472B","#D88960","#E4B478","#86786D"]},
{id:"amethyst",name:"Amethyst & Blush",description:"Expressive modern academy",deep:"#2B1D3E",primary:"#6F3D91",accent:"#E7B6D9",canvas:"#FAF6FC",chartColors:["#6F3D91","#AE74BC","#E4A4C5","#8680A1"]},
{id:"onyx",name:"Onyx & Gold",description:"Understated premium luxury",deep:"#242321",primary:"#705007",accent:"#EAC15E",canvas:"#FBF9F1",chartColors:["#866212","#D2AC53","#777169","#BDAA88"]}
];
function ThemeGallery({value,onChange}) {
 return <section className="c29-gallery" aria-label="Five new dashboard color palettes">
  <div className="c29-gallery-heading"><strong>Five new directions</strong><span>Compare complete dashboard treatments with the same academy data</span></div>
  <div className="c29-theme-grid" role="group" aria-label="Select a dashboard design theme">
   {PALETTE_LAB_THEMES.map(t => <button key={t.id} type="button" className={"c29-theme-card" + (value === t.id ? " is-selected" : "")}
    onClick={() => onChange(t.id)} aria-label={"Preview "+t.name} aria-pressed={value === t.id}>
     <span className="c29-theme-swatches" aria-hidden="true"><i style={{background:t.deep}}/><i style={{background:t.primary}}/><i style={{background:t.accent}}/><i style={{background:t.canvas}}/></span>
     <strong>{t.name}</strong><small>{t.description}</small>
   </button>)}
  </div>
 </section>;
}
function PalettePicker({value,onChange}) {
  return <div className="c28-palette-picker" role="group" aria-label="Preview dashboard color palette">
    <span>Try palette</span>
    {DASHBOARD_PALETTES.map(p => <button key={p.id} type="button"
      aria-pressed={value === p.id} aria-label={p.label} title={p.label}
      className={"c28-palette-choice" + (value === p.id ? " is-selected" : "")}
      onClick={() => onChange(p.id)}>
      <i className="c28-palette-swatch" style={{background:p.color}} aria-hidden="true"/>
      <span>{p.label}</span>
    </button>)}
  </div>;
}
function Glyph({ name, size = 18 }) {
  const shapes = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    users: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    centers: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 5V3m8 2V3M8 14h3m3 0h3M8 18h3"/></>,
    batches: <><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/></>,
    arrow: <><path d="M7 17 17 7M8 7h9v9"/></>,
    chevron: <><path d="m9 18 6-6-6-6"/></>,
    check: <><path d="m4 12 5 5L20 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    field: <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 4v16M2 9h4v6H2m20-6h-4v6h4"/><circle cx="12" cy="12" r="3"/></>,
    wallet: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M17 15h1"/></>,
    chart: <><path d="M4 19V5m0 14h17M8 15v-4m5 4V8m5 7V5"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">{shapes[name] || shapes.grid}</svg>;
}
function PanelTitle({ kicker, title, icon, right }) {
  return <div className="c27-panel-head">
    <div className="c27-panel-heading">
      <span className="c27-panel-icon"><Glyph name={icon}/></span>
      <div><span className="c27-kicker">{kicker}</span><h2>{title}</h2></div>
    </div>
    {right ? <div className="c27-panel-head-right">{right}</div> : null}
  </div>;
}
function Empty({ title, detail }) {
  return <div className="c27-empty" role="status"><strong>{title}</strong><span>{detail}</span></div>;
}
function Stat({ label, value, path, icon }) {
  return <Link className="c27-stat" to={path}>
    <span className="c27-stat-icon"><Glyph name={icon} size={17}/></span>
    <span className="c27-stat-text"><strong>{formatCount(value)}</strong><small>{label}</small></span>
    <span className="c27-stat-arrow"><Glyph name="arrow" size={13}/></span>
  </Link>;
}
function Overview({ data, paletteLab = false, palette = "classic", pitchsideSelected = false }) {
  const [selectedCenterId, setSelectedCenterId] = useState(null);
  const centers = data.centers;
  const selected = centers?.find(center => center.id === selectedCenterId) || centers?.[0];
  const memberships = (centers || []).reduce((sum, center) => sum + center.players, 0);
  const chosenColors = pitchsideSelected ? PITCHSIDE_CENTER_COLORS : paletteLab ? PALETTE_LAB_THEMES.find(t => t.id === palette)?.chartColors : null;
  const displayCenters = (centers || []).map((center,i) => ({...center,displayColor:chosenColors?.[i%chosenColors.length] || center.color}));
  let offset = 0;
  const segments = displayCenters.filter(center => center.players > 0).map(center => {
    const start = offset;
    offset += memberships ? (center.players / memberships) * 100 : 0;
    return center.displayColor + " " + start + "% " + offset + "%";
  });
  const ring = segments.length ? "conic-gradient(" + segments.join(",") + ")" : "#dbe4ee";
  return <section className="c27-panel c27-overview" aria-label="Players by center">
    <PanelTitle kicker="SQUAD INTELLIGENCE" title="Players by center" icon="users"
      right={<span className="c27-heading-meta">{formatCount(centers?.length)} centers</span>}/>
    {centers === null ? <Empty title="Center information unavailable" detail="Player assignments could not be loaded."/> :
      !centers.length ? <Empty title="No centers configured" detail="Create a training center to organize your squads."/> :
      <div className="c27-overview-body">
        <div className="c27-distribution">
          <div className="c27-chart-wrap">
            <div className="c27-donut" style={{ background: ring }} role="img"
              aria-label={"Player-center memberships: " + formatCount(memberships)}>
              <div className="c27-donut-core">
                <span>Center memberships</span>
                <strong>{formatCount(memberships)}</strong>
                <small>Assignments, not unique players</small>
              </div>
            </div>
          </div>
          <div className="c27-center-legend" role="group" aria-label="Select center to see batch breakdown">
            {displayCenters.map(center => <button type="button" key={center.id}
              className={"c27-center-option" + (selected?.id === center.id ? " is-current" : "")}
              aria-pressed={selected?.id === center.id} onClick={() => setSelectedCenterId(center.id)}>
              <span className="c27-center-dot" style={{background:center.displayColor}}/>
              <span className="c27-center-name" title={center.name}>{center.name}</span>
              <strong>{formatCount(center.players)}</strong>
              <Glyph name="chevron" size={14}/>
            </button>)}
          </div>
        </div>
        <div className="c27-batches">
          <div className="c27-batch-head">
            <div><span className="c27-kicker">SELECTED CENTER</span><h3>{selected?.name}</h3></div>
            <span className="c27-batch-total">{formatCount(selected?.players)} players</span>
          </div>
          {selected?.batches.length ? <div className="c27-batch-list">{selected.batches.map(batch => {
            const proportion = selected.players ? Math.min(100, 100 * batch.players / selected.players) : 0;
            return <div className="c27-batch-row" key={batch.id}>
              <div className="c27-batch-row-head">
                <span>{batch.name}</span><strong>{formatCount(batch.players)}</strong>
              </div>
              <div className={"c27-batch-track" + (batch.players ? "" : " is-empty")} aria-hidden="true">
                <span style={{width:proportion+"%"}}/>
              </div>
            </div>;
          })}</div> :
          <Empty title="No batches for this center" detail="Active batches will appear here when configured."/>}
          <Link className="c27-view-link" to={centerPlayersPath(selected)}>
            View center players <Glyph name="arrow" size={16}/>
          </Link>
        </div>
      </div>}
  </section>;
}
function Training({ data }) {
  const sessions = data.sessions;
  const recorded = (sessions || []).filter(s => s.attendanceRecorded).length;
  const groups = groupByCenter(sessions, s => s.centerId || s.centerName || "unassigned", s => s.centerName || "Unassigned center");
  return <section className="c27-panel c27-training" aria-label="Today's training sessions">
    <PanelTitle kicker="ON THE PITCH" title="Today's sessions" icon="field"
      right={<span className="c27-count">{formatCount(sessions?.length)} scheduled</span>}/>
    {sessions === null ? <Empty title="Training schedule unavailable" detail="The schedule could not be loaded."/> :
      !sessions.length ? <Empty title="No training scheduled today" detail="Check batch schedules if a session was expected."/> :
      <>
        <div className="c27-training-status">
          <span className="c27-status-indicator" aria-hidden="true"/>
          <strong>{formatCount(recorded)} of {formatCount(sessions.length)}</strong>
          <span>training sessions with marks</span>
        </div>
        <div className="c28-touchline-note">
          <span>{formatCount(sessions.length - recorded)} sessions have no marks recorded yet</span>
          <Link to="/attendance">Attendance workspace <Glyph name="arrow" size={14}/></Link>
        </div>
        <div className="c27-training-groups">
          {groups.map(group => <div className="c27-training-group" key={group.key}>
            <h3>{group.name}</h3>
            {group.rows.map(session => <Link className="c27-session" key={session.id}
              to={attendancePath(session)}
              aria-label={"Open attendance for " + (session.batchName || "batch") + " at " + group.name}>
              <span className="c27-session-main">
                <strong>{session.batchName || "Unnamed batch"}</strong>
                <small><Glyph name="clock" size={12}/>{formatTime(session.startTime)}{session.endTime ? " – " + formatTime(session.endTime) : ""}</small>
              </span>
              <span className={"c27-session-state" + (session.attendanceRecorded ? " is-recorded" : " is-unmarked")}>
                {session.attendanceRecorded ? "Recorded" : "No marks"}
              </span>
              <Glyph name="arrow" size={15}/>
            </Link>)}
          </div>)}
        </div>
        <p className="c27-fineprint">Recorded means at least one attendance mark exists, not that the full batch is complete.</p>
      </>}
  </section>;
}
function Attendance({ data }) {
  const batches = data.attendanceBatches;
  const [selectedCenter, setSelectedCenter] = useState("all");
  const summary = recordedMarkSummary(batches);
  const allGroups = groupByCenter(batches, b => b.centerName || "Unassigned center", b => b.centerName || "Unassigned center");
  const groups = selectedCenter === "all" ? allGroups : allGroups.filter(g => g.key === selectedCenter);
  return <section className="c27-panel c27-attendance" aria-label="Weekly attendance by batch">
    <PanelTitle kicker="TRAINING PULSE" title="Weekly attendance" icon="chart"
      right={<span className="c27-period">LAST 7 DAYS</span>}/>
    {batches === null ? <Empty title="Attendance unavailable" detail="The last-seven-day attendance data could not be loaded."/> :
      summary.rate === null ? <Empty title="No recorded attendance marks" detail="Recorded present and absent marks will appear here after attendance is taken."/> :
      <>
        <div className="c27-attendance-toolbar">
          <div className="c27-attendance-metrics">
            <div><strong>{summary.rate}%</strong><span>Recorded-mark attendance</span></div>
            <div><strong>{formatCount(summary.recordedBatches)}/{formatCount(summary.totalBatches)}</strong><span>Batches with marks</span></div>
          </div>
          <div className="c27-attendance-actions">
            <label htmlFor="c27-attendance-center" className="c27-sr-only">Filter attendance by center</label>
            <select id="c27-attendance-center" value={selectedCenter}
              onChange={event => setSelectedCenter(event.target.value)}
              aria-label="Filter attendance by center">
              <option value="all">All centers</option>
              {allGroups.map(group => <option key={group.key} value={group.key}>{group.name}</option>)}
            </select>
            <Link className="c27-view-link" to="/attendance">Open attendance <Glyph name="arrow" size={15}/></Link>
          </div>
        </div>
        <div className="c28-attendance-context">
          <span><Glyph name="field" size={14}/> Training batch pulse</span>
          <span>{formatCount(summary.totalBatches - summary.recordedBatches)} batches have no marks in the last 7 days</span>
        </div>
        <div className="c27-attendance-matrix">
          {groups.map(group => {
            const marked = group.rows.filter(b => Number(b.totalRecords) > 0).length;
            return <div className="c27-attendance-center" key={group.key}>
              <div className="c27-attendance-center-head">
                <strong>{group.name}</strong>
                <span>{marked}/{group.rows.length} batches with marks</span>
              </div>
              {group.rows.map(batch => {
                const total = Math.max(0,Number(batch.totalRecords || 0));
                const present = Math.max(0,Number(batch.presentRecords || 0));
                const available = total > 0;
                const rate = available ? Math.round(100 * present / total) : null;
                return <div className="c27-attendance-row c28-attendance-row" key={batch.id || batch.batchId || batch.batchName}>
                  <span className="c27-attendance-name">{batch.batchName || "Unnamed batch"}</span>
                  <div className={"c28-attendance-strip" + (available ? "" : " no-data")}
                    role="img" aria-label={(batch.batchName || "Batch") + ": " +
                      (rate === null ? "no recorded marks" : rate + "% of recorded marks present, " + formatCount(present) + " of " + formatCount(total))}>
                    {available ? Array.from({length:10}, (_,i) => <i key={i} className="c28-attendance-segment"
                      style={{opacity:Math.max(0,Math.min(1,rate/10-i))}} aria-hidden="true"/>) :
                      <span className="c28-no-marks-line" aria-hidden="true"/>}
                  </div>
                  <span className="c28-attendance-fraction">{available ? formatCount(present) + "/" + formatCount(total) + " present" : "Not recorded"}</span>
                  <strong className={available ? "" : "no-data"}>{rate === null ? "No marks" : rate+"%"}</strong>
                </div>;
              })}
            </div>;
          })}
        </div>
        <p className="c27-fineprint">Percentages reflect recorded present/absent marks, not scheduled training sessions. “No marks” does not mean 0% attendance. Center filtering changes only the listed batches.</p>
      </>}
  </section>;
}
function Financial({ data }) {
  const f = data.financial;
  const billed = f && Number(f.totalBilledThisMonth);
  const validRate = f && f.totalBilledThisMonth != null && billed > 0 && Number.isFinite(Number(f.collectionRate));
  const rateLabel = validRate ? formatCount(f.collectionRate) + "%" : "N/A";
  const tiles = [
    {label:"Collected this month",value:f?.collectionsThisMonth,to:"/payment-collections",icon:"wallet",detail:"Recorded collections",tone:"collected"},
    {label:"Current outstanding",value:f?.outstandingAmount,to:"/payment-dues",icon:"chart",detail:"Includes earlier periods",tone:"outstanding"},
    {label:"Billed this month",value:f?.totalBilledThisMonth,to:"/payment-dues",icon:"centers",detail:"Dues scheduled this month"},
    {label:"Expenses this month",value:f?.expensesThisMonth,to:"/expenses",icon:"wallet",detail:"Recorded expenses"}
  ];
  return <section className="c27-panel c27-financial" aria-label="Monthly finances">
    <PanelTitle kicker="FINANCIAL HEALTH" title="Monthly finances" icon="wallet"
      right={<span className="c27-period">{new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</span>}/>
    {f === null ? <Empty title="Finances unavailable" detail="Unavailable amounts are not represented as zero."/> :
    <>
      <div className="c27-financial-grid">
        {tiles.map(tile => <Link to={tile.to} key={tile.label} className={"c27-finance-tile " + (tile.tone || "")}>
          <span className="c27-finance-label">{tile.label}<Glyph name="arrow" size={14}/></span>
          <strong>{formatMoney(tile.value)}</strong>
          <small>{tile.detail}</small>
        </Link>)}
      </div>
      <div className="c27-financial-footer">
        <div><span>Pending</span><strong>{formatCount(f.pendingDues)}</strong></div>
        <div><span>Partial</span><strong>{formatCount(f.partialDues)}</strong></div>
        <div><span>Paid</span><strong>{formatCount(f.paidDues)}</strong></div>
        <div><span>Collection rate</span><strong>{rateLabel}</strong></div>
      </div>
      <p className="c27-fineprint">{validRate
        ? "Monthly collection rate uses collections this month ÷ dues billed this month."
        : "Collection rate N/A: no dues billed this month. Outstanding can include earlier periods."}</p>
    </>}
  </section>;
}
function Enquiries({ data }) {
  const enquiries = data.enquiries;
  const groups = Array.isArray(enquiries?.groups)
    ? [...enquiries.groups].sort((a,b) => Number(b.total) - Number(a.total) || String(a.centerName).localeCompare(String(b.centerName))).slice(0,4) : [];
  return <section className="c27-panel c27-enquiries" aria-label="Admissions and enquiries">
    <PanelTitle kicker="ACADEMY GROWTH" title="Enquiries" icon="users"
      right={<Link className="c27-small-link" to="/enquiries">View all <Glyph name="arrow" size={14}/></Link>}/>
    {enquiries === null ? <Empty title="Enquiries unavailable" detail="Admissions information could not be loaded."/> :
      <>
        <div className="c27-enquiry-total">
          <strong>{formatCount(enquiries.total)}</strong>
          <div><span>New enquiries</span><small>Received this month</small></div>
        </div>
        {groups.length ? <div className="c27-enquiry-centers">
          {groups.map(group => <Link key={group.centerId || group.centerName}
            to={enquiriesPath(group)} aria-label={"View enquiries for "+group.centerName}>
            <span>{group.centerName}</span><strong>{formatCount(group.total)} <Glyph name="chevron" size={14}/></strong>
          </Link>)}
        </div> : <p className="c27-fineprint">No enquiries received this month.</p>}
      </>}
  </section>;
}
export default function AcademyOwnerDashboardC27({ data, paletteLab = false, pitchsideSelected = false }) {
  const adapted = useMemo(() => adaptOwnerData(data), [data]);
  const [palette, setPalette] = useState(pitchsideSelected ? "pitchside" : paletteLab ? "scarlet" : "classic");
  if (!adapted) return <div className="c27-dashboard"><Empty title="Dashboard unavailable" detail="The Academy Owner dashboard data was not returned." /></div>;
  return <div className={"c27-dashboard c28-polished" + (paletteLab ? " c29-lab" : "") + (pitchsideSelected ? " c30-pitchside" : "")} data-palette={palette}>
    <div className="c27-preview-line">
      <span className="c27-preview-mark"><i/>{pitchsideSelected ? "UI-C2.10 · PITCHSIDE EMERALD · SELECTED THEME" : paletteLab ? "UI-C2.9 · BRAND EXPLORATION" : "UI-C2.8 · FOOTBALL UI LAB"}</span>
      {!paletteLab && !pitchsideSelected && <PalettePicker value={palette} onChange={setPalette}/>}
      <div className="c28-preview-links">
        {pitchsideSelected ? <Link to="/ui-c2-7-preview">Compare earlier themes</Link> : paletteLab ? <Link to="/ui-c2-7-preview">Existing palettes</Link> : <Link to="/ui-c2-5-preview">Previous preview</Link>}
        <Link to="/dashboard">Current dashboard <Glyph name="arrow" size={13}/></Link>
      </div>
    </div>
    {paletteLab && <ThemeGallery value={palette} onChange={setPalette}/>}
    <header className="c27-header">
      <div className="c27-header-title">
        <div className="c27-label"><Glyph name="field" size={15}/> FOOTBALL OPERATIONS</div>
        <h1>Academy overview</h1>
        <p>{adapted.academyName} <span aria-hidden="true">·</span> Your training day at a glance</p>
      </div>
      <nav className="c27-stats" aria-label="Academy totals">
        <Stat label="Players" value={adapted.totals.players} path="/players" icon="users"/>
        <Stat label="Centers" value={adapted.totals.centers} path="/centers" icon="centers"/>
        <Stat label="Batches" value={adapted.totals.batches} path="/batches" icon="batches"/>
      </nav>
    </header>
    <div className="c27-primary-grid"><Overview data={adapted} paletteLab={paletteLab} palette={palette} pitchsideSelected={pitchsideSelected}/><Training data={adapted}/></div>
    <Attendance data={adapted}/>
    <div className="c27-bottom-grid"><Financial data={adapted}/><Enquiries data={adapted}/></div>
  </div>;
}
