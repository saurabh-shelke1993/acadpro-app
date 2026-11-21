import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  adaptOwnerData, attendancePath, centerPlayersPath, enquiriesPath,
  filterAttendanceByCenter, formatCount, formatMoney, formatTime,
  getCollectionRateLabel, groupAttendanceByCenter, recordedMarkSummary,
} from "./academyOwnerPreviewAdapter";
import "./AcademyOwnerDashboardPreview.css";

// Selected C27/C28/C30 presentation only. No routing, auth, fetching or date policy.
const STACKED_QUERY = "(max-width: 1190px)";
const CENTER_COLORS = ["#087C6E", "#A6C96A", "#CE9B55", "#4F8C86", "#947BA6"];
const label = (value, fallback) => typeof value === "string" && value.trim() ? value : fallback;
const centerKey = (id) => JSON.stringify(id ?? null);

function useStackedLayout(root) {
  const [stacked, setStacked] = useState(() => typeof window !== "undefined"
    && typeof window.matchMedia === "function" && window.matchMedia(STACKED_QUERY).matches);
  const restoreFocus = useRef(null);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(STACKED_QUERY);
    const update = () => {
      restoreFocus.current = root.current?.contains(document.activeElement) ? document.activeElement : null;
      setStacked(media.matches);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [root]);
  useLayoutEffect(() => {
    if (restoreFocus.current?.isConnected) restoreFocus.current.focus({ preventScroll: true });
    restoreFocus.current = null;
  }, [stacked]);
  return stacked;
}

function Panel({ title, kicker, action, children }) {
  const headingId = useId();
  return <section className="op-panel" aria-labelledby={headingId}>
    <header className="op-panel-heading">
      <div><span className="op-kicker">{kicker}</span><h2 id={headingId}>{title}</h2></div>
      {action}
    </header>
    {children}
  </section>;
}

function State({ title, detail }) {
  return <div className="op-state" role="status"><strong>{title}</strong>{detail && <p>{detail}</p>}</div>;
}

function PlayersOverview({ data }) {
  const [selectedId, setSelectedId] = useState(null);
  const centers = data.centers;
  const selected = centers?.find((center) => center.id !== null && center.id === selectedId)
    || centers?.find((center) => center.id !== null);
  let position = 0;
  const segments = data.centerMemberships > 0 ? centers.filter((center) => center.players > 0).map((center) => {
    const start = position;
    position += center.players / data.centerMemberships * 100;
    return `${CENTER_COLORS[centers.indexOf(center) % CENTER_COLORS.length]} ${start}% ${position}%`;
  }) : [];
  const membershipLabel = data.centerMemberships === null ? "Player-center memberships unavailable"
    : `${formatCount(data.centerMemberships)} player-center memberships, not unique players`;
  return <Panel title="Players overview" kicker="Squad intelligence">
    {centers === null ? <State title="Center information unavailable" /> : !centers.length ? <State title="No centers configured" /> :
      <div className="op-overview-body">
        <div className="op-distribution">
          <div className="op-donut" role="img" aria-label={membershipLabel}
            style={{ background: segments.length ? `conic-gradient(${segments.join(",")})` : "#E2EEE5" }}>
            <div className="op-donut-core" aria-hidden="true"><span>Center memberships</span>
              <strong>{formatCount(data.centerMemberships)}</strong><small>Not unique players</small></div>
          </div>
          <div className="op-center-legend" role="group" aria-label="Choose center for batch breakdown">
            {centers.map((center, index) => center.id === null ?
              <div className="op-center-unavailable" key={`unidentified-${index}`}>Center identity unavailable · {formatCount(center.players)} players</div> :
              <button key={center.id} type="button" className="op-center-choice" aria-pressed={selected?.id === center.id}
                aria-label={`Show batch breakdown for ${label(center.name, "Unnamed center")}, center ${index + 1}`}
                onClick={() => setSelectedId(center.id)}>
                <span className="op-center-dot" style={{ background: CENTER_COLORS[index % CENTER_COLORS.length] }} aria-hidden="true" />
                <span>{label(center.name, "Unnamed center")}</span><strong>{formatCount(center.players)}</strong>
              </button>)}
          </div>
        </div>
        <div className="op-batch-profile">
          <div className="op-batch-heading"><div><span className="op-kicker">Selected center</span>
            <h3>{label(selected?.name, "Center unavailable")}</h3></div><span>{formatCount(selected?.players)} players</span></div>
          {!selected || selected.batches === null ? <State title="Batch breakdown unavailable" /> : !selected.batches.length ?
            <State title="No active batches for this center" /> : <ul className="op-batch-list">
              {selected.batches.map((batch, index) => <li key={index}>
                {/* These are label aggregates: index is a display key, never a real batch ID. */}
                <div><span>{label(batch.name, "Batch label unavailable")}</span><strong>{formatCount(batch.players)}</strong></div>
                <div className="op-batch-track" aria-hidden="true"><span style={{ width: selected.players > 0 && batch.players !== null
                  ? `${Math.min(100, 100 * batch.players / selected.players)}%` : "0%" }} /></div>
              </li>)}
            </ul>}
          {selected?.id && selected.academyId && <Link className="op-link" to={centerPlayersPath(selected)}>View center players <span aria-hidden="true">↗</span></Link>}
        </div>
      </div>}
  </Panel>;
}

function groupLabel(group, groups) {
  const name = label(group.centerName, "Unassigned center");
  return groups.filter((item) => item.centerName === group.centerName).length > 1
    ? `${name} — center ${groups.indexOf(group) + 1}` : name;
}

function TodaySessions({ sessions }) {
  const groups = groupAttendanceByCenter(sessions);
  return <Panel title="Today's sessions" kicker="On the pitch"
    action={<Link className="op-link" to={attendancePath()}>Attendance workspace <span aria-hidden="true">↗</span></Link>}>
    {sessions === null ? <State title="Training schedule unavailable" /> : !sessions.length ?
      <State title="No training scheduled today" detail="Check batch schedules if training was expected." /> : <>
        <p className="op-scheduled-count">{formatCount(sessions.length)} scheduled</p>
        {groups.map((group) => <div className="op-session-group" key={centerKey(group.centerId)}>
          <h3>{groupLabel(group, groups)}</h3>
          {[...group.rows].sort((a, b) => String(a?.startTime || "99:99").localeCompare(String(b?.startTime || "99:99")))
            .map((session, index) => <Link key={session?.id ?? index} className="op-session" to={attendancePath(session)}
              aria-label={`Open attendance for ${label(session?.batchName, "batch")} at ${groupLabel(group, groups)}, ${formatTime(session?.startTime)}`}>
              <strong>{label(session?.batchName, "Unnamed batch")}</strong>
              <span>{formatTime(session?.startTime)}{session?.endTime ? ` – ${formatTime(session.endTime)}` : ""}</span>
              <span className="op-mark-state" data-recorded={session?.attendanceRecorded === true ? "yes" : "no"}>
                {session?.attendanceRecorded === true ? "Marks recorded for this batch today"
                  : session?.attendanceRecorded === false ? "No marks recorded for this batch today" : "Batch marks unavailable"}
              </span>
            </Link>)}
        </div>)}
        <p className="op-note">Marks describe the batch and date, not completion of each session or every player's attendance.</p>
      </>}
  </Panel>;
}

function AttendanceRow({ batch, centerName }) {
  const summary = recordedMarkSummary([batch]);
  const name = label(batch?.batchName, "Unnamed batch");
  const available = summary.marked !== null;
  const recorded = available && summary.marked > 0;
  const description = !available ? "counts unavailable" : !recorded ? "no recorded marks"
    : `${summary.rate}% of recorded marks present, ${formatCount(summary.present)} of ${formatCount(summary.marked)}`;
  return <div className="op-attendance-row">
    <span className="op-attendance-name">{name}</span>
    <div className={`op-attendance-strip${recorded ? "" : " op-no-data"}`} role="img" aria-label={`${name}, ${centerName}: ${description}`}>
      {recorded ? Array.from({ length: 10 }, (_, index) => <i key={index} aria-hidden="true"
        style={{ opacity: Math.max(0, Math.min(1, summary.rate / 10 - index)) }} />) : <i aria-hidden="true" />}
    </div>
    <span className="op-attendance-fraction">{recorded ? `${formatCount(summary.present)}/${formatCount(summary.marked)} present`
      : available ? "Not recorded" : "Counts unavailable"}</span>
    <strong>{recorded ? `${summary.rate}%` : available ? "No marks" : "Unavailable"}</strong>
  </div>;
}

function WeeklyAttendance({ rows }) {
  const [selectedId, setSelectedId] = useState(undefined);
  const filterId = useId();
  const allGroups = useMemo(() => groupAttendanceByCenter(rows), [rows]);
  const validSelection = selectedId === undefined || allGroups?.some((group) => group.centerId === selectedId);
  const effectiveId = validSelection ? selectedId : undefined;
  useEffect(() => { if (!validSelection) setSelectedId(undefined); }, [validSelection]);
  const summary = recordedMarkSummary(rows);
  const visible = filterAttendanceByCenter(rows, effectiveId);
  const groups = groupAttendanceByCenter(visible);
  return <Panel title="Weekly attendance" kicker="Training pulse" action={<span className="op-period">Last 7 days</span>}>
    <div className="op-attendance-toolbar">
      <dl aria-label="Academy-wide attendance summary" className="op-attendance-summary">
        <div><dt>Recorded-mark attendance</dt><dd>{summary.rate === null ? "—" : `${summary.rate}%`}</dd></div>
        <div><dt>Batches with marks</dt><dd>{formatCount(summary.recordedBatches)}/{formatCount(summary.totalBatches)}</dd></div>
      </dl>
      <label className="op-center-filter" htmlFor={filterId}>Center
        {/* Typed values keep actual IDs distinct from All and the null bucket. */}
        <select id={filterId} value={effectiveId === undefined ? "" : centerKey(effectiveId)} disabled={!allGroups?.length}
          onChange={(event) => setSelectedId(event.target.value === "" ? undefined : JSON.parse(event.target.value))}>
          <option value="">All centers</option>
          {allGroups?.map((group) => <option key={centerKey(group.centerId)} value={centerKey(group.centerId)}>{groupLabel(group, allGroups)}</option>)}
        </select>
      </label>
    </div>
    {rows === null ? <State title="Attendance unavailable" /> : !rows.length ? <State title="No active batches found" /> : <>
      {summary.marked === null ? <State title="Attendance summary unavailable" /> : summary.marked === 0 &&
        <State title="No recorded attendance marks" detail="No marks does not mean 0% attendance." />}
      <p className="op-filter-result" role="status">Showing {formatCount(visible.length)} of {formatCount(rows.length)} batches</p>
      <div className="op-attendance-groups">{groups.map((group) => <section key={centerKey(group.centerId)} aria-label={`${groupLabel(group, allGroups)} attendance`}>
        <h3 className="op-attendance-center-heading">{groupLabel(group, allGroups)}</h3>
        {group.rows.map((batch, index) => <AttendanceRow key={batch?.id ?? batch?.batchId ?? index} batch={batch} centerName={groupLabel(group, allGroups)} />)}
      </section>)}</div>
    </>}
    <p className="op-note">Percentages use recorded present/absent marks, not scheduled sessions. Center filtering changes listed rows only; the academy summary stays unchanged.</p>
  </Panel>;
}

function FinancialSnapshot({ financial }) {
  const rate = getCollectionRateLabel(financial);
  const tiles = [
    ["Collected this month", financial?.collectionsThisMonth, "/payment-collections", "Recorded collections", "collected"],
    ["Current outstanding", financial?.outstandingAmount, "/payment-dues", "Includes earlier periods", "outstanding"],
    ["Billed this month", financial?.totalBilledThisMonth, "/payment-dues", "Dues scheduled this month", "billed"],
    ["Expenses this month", financial?.expensesThisMonth, "/expenses", "Recorded expenses", "expenses"],
  ];
  return <Panel title="Financial snapshot" kicker="Financial health" action={<span className="op-period">Monthly finances</span>}>
    {financial === null ? <State title="Finances unavailable" detail="Unavailable amounts are not zero." /> : <>
      <div className="op-finance-grid">{tiles.map(([title, value, to, detail, tone]) => <Link className={`op-finance-tile op-${tone}`} to={to} key={title}>
        <span>{title} <span aria-hidden="true">↗</span></span><strong>{formatMoney(value)}</strong><small>{detail}</small>
      </Link>)}</div>
      <dl className="op-finance-status">
        <div><dt>Pending</dt><dd>{formatCount(financial.pendingDues)}</dd></div>
        <div><dt>Partial</dt><dd>{formatCount(financial.partialDues)}</dd></div>
        <div><dt>Paid</dt><dd>{formatCount(financial.paidDues)}</dd></div>
        <div><dt>Collection rate</dt><dd>{rate}</dd></div>
      </dl>
      <p className="op-note">{rate === "N/A" ? "No dues billed this month. Outstanding can include earlier periods."
        : rate === "—" ? "Collection rate unavailable." : "Monthly collection rate = collections this month ÷ dues billed this month."} Due status counts cover all returned periods.</p>
    </>}
  </Panel>;
}

function Enquiries({ enquiries }) {
  const countOrder = (value) => formatCount(value) === "—" ? -1 : Number(value);
  const groups = Array.isArray(enquiries?.groups) ? [...enquiries.groups].sort((a, b) => countOrder(b?.total) - countOrder(a?.total)
    || String(a?.centerName || "").localeCompare(String(b?.centerName || ""))).slice(0, 4) : null;
  return <Panel title="Enquiries" kicker="Academy growth" action={<Link className="op-link" to={enquiriesPath()}>View all <span aria-hidden="true">↗</span></Link>}>
    {enquiries === null ? <State title="Enquiries unavailable" /> : <>
      <div className="op-enquiry-total"><strong>{formatCount(enquiries.total)}</strong><span>Received this month</span></div>
      {groups === null ? <State title="Enquiry breakdown unavailable" /> : !groups.length ?
        <p className="op-note">{countOrder(enquiries.total) === 0 ? "No enquiries received this month." : "No center breakdown available."}</p> :
        <ul className="op-enquiry-list">{groups.map((group, index) => {
          const name = label(group?.centerName, "Unassigned center");
          const content = <><span>{name}</span><strong>{formatCount(group?.total)}</strong></>;
          return <li key={group?.centerId ?? index}>{group?.centerId && group.centerId !== "unassigned-center"
            ? <Link to={enquiriesPath(group)} aria-label={`View enquiries for ${name}`}>{content}</Link>
            : <div>{content}</div>}</li>;
        })}</ul>}
    </>}
  </Panel>;
}

export default function AcademyOwnerDashboardPreview({ data }) {
  const root = useRef(null);
  const stacked = useStackedLayout(root);
  const adapted = useMemo(() => adaptOwnerData(data), [data]);
  const topSections = adapted && [<PlayersOverview key="players" data={adapted} />, <TodaySessions key="sessions" sessions={adapted.sessions} />];
  return <div className="owner-preview" id="main-content" tabIndex={-1} ref={root}>
    <header className="op-header">
      <div><span className="op-eyebrow">Football operations</span><h1>Academy overview</h1>
        <p>{label(adapted?.academyName, "Academy name unavailable")} · Your training day at a glance</p></div>
      {adapted && <nav className="op-totals" aria-label="Academy totals">
        {[ ["Players", "players", "/players"], ["Centers", "centers", "/centers"], ["Batches", "batches", "/batches"] ].map(([title, field, to]) =>
          <Link key={field} to={to}><strong>{formatCount(adapted.totals[field])}</strong><span>{title}</span><span aria-hidden="true">↗</span></Link>)}
      </nav>}
    </header>
    {!adapted ? <State title="Dashboard unavailable" detail="Academy dashboard data was not returned." /> : <>
      <div className="op-top-grid">{stacked ? [topSections[1], topSections[0]] : topSections}</div>
      <WeeklyAttendance rows={adapted.attendanceBatches} />
      <div className="op-bottom-grid"><FinancialSnapshot financial={adapted.financial} /><Enquiries enquiries={adapted.enquiries} /></div>
    </>}
  </div>;
}
