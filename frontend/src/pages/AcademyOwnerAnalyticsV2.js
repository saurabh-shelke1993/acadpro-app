import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Layout from "../components/Layout";
import { getAcademyAttendanceInsights, getAcademyCenterBatchCatalog, getAcademyOwnerAnalyticsV2 } from "../services/analyticsV2Service";
import { getCoachAnalytics, getCoachMonthStats } from "../services/coachAnalyticsService";
import { getAcademyEnquiriesAnalytics } from "../services/enquiriesAnalyticsService";
import "./AcademyOwnerAnalyticsV2.css";

const getCurrentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : new Date().toISOString().slice(0, 7);
};

const getMonthDateRange = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(lastDay).padStart(2, "0")}` };
};

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPresetRange = (months) => {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  if (months === 0) start.setDate(start.getDate() - 6);
  else start.setMonth(start.getMonth() - months);
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
};





const formatCurrency = (value) =>
  value === null || value === undefined
    ? "—"
    : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const formatNumber = (value) =>
  value === null || value === undefined ? "—" : Number(value).toLocaleString("en-IN");

const formatPercent = (value) =>
  value === null || value === undefined ? "—" : `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;

function MetricCard({ label, value, note, quality = "unavailable", tone = "default" }) {
  return (
    <article className={`owner-analytics-metric owner-analytics-metric-${tone}`}>
      <div className="owner-analytics-metric-top">
        <span>{label}</span>
        <span className={`owner-analytics-quality owner-analytics-quality-${quality}`}>
          {quality}
        </span>
      </div>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

function MetricBreakdown({ title, description, firstLabel, firstValue, secondLabel, secondValue, firstTone = "blue", secondTone = "muted", formatter = formatNumber }) {
  const hasFirst = typeof firstValue === "number" && Number.isFinite(firstValue) && firstValue >= 0;
  const hasSecond = typeof secondValue === "number" && Number.isFinite(secondValue) && secondValue >= 0;
  if (!hasFirst || !hasSecond) return null;

  const total = firstValue + secondValue;
  const firstShare = total > 0 ? (firstValue / total) * 100 : 0;
  const secondShare = total > 0 ? (secondValue / total) * 100 : 0;

  return (
    <section className="owner-analytics-breakdown" aria-label={title}>
      <div className="owner-analytics-breakdown-heading">
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <span>{total > 0 ? `${Math.round(firstShare)}% / ${Math.round(secondShare)}%` : "No recorded activity"}</span>
      </div>
      <div
        className="owner-analytics-breakdown-track"
        role="img"
        aria-label={`${firstLabel}: ${formatter(firstValue)}; ${secondLabel}: ${formatter(secondValue)}`}
      >
        <span className={`owner-analytics-breakdown-fill owner-analytics-breakdown-fill-${firstTone}`} style={{ width: `${firstShare}%` }} />
        <span className={`owner-analytics-breakdown-fill owner-analytics-breakdown-fill-${secondTone}`} style={{ width: `${secondShare}%` }} />
      </div>
      <div className="owner-analytics-breakdown-legend">
        <div>
          <span className={`owner-analytics-breakdown-dot owner-analytics-breakdown-dot-${firstTone}`} />
          <span>{firstLabel}</span>
          <strong>{formatter(firstValue)}</strong>
        </div>
        <div>
          <span className={`owner-analytics-breakdown-dot owner-analytics-breakdown-dot-${secondTone}`} />
          <span>{secondLabel}</span>
          <strong>{formatter(secondValue)}</strong>
        </div>
      </div>
    </section>
  );
}

function MetricNotes({ metric }) {
  if (!metric?.notes?.length) return null;
  return (
    <ul className="owner-analytics-notes">
      {metric.notes.map((note, index) => <li key={index}>{note}</li>)}
    </ul>
  );
}

function AcademyOwnerAnalyticsV2({ user }) {
  const [month] = useState(getCurrentMonth);
  const [attendancePreset, setAttendancePreset] = useState("1m");
  const [attendanceRange, setAttendanceRange] = useState(() => getPresetRange(1));

  const [result, setResult] = useState(null);
  const [attendanceCatalog, setAttendanceCatalog] = useState([]);
  const [insights, setInsights] = useState({ records: [], players: [] });
  const [insightsError, setInsightsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("attendance");
  const [playerPage, setPlayerPage] = useState(1);
  const [coachData, setCoachData] = useState(null);
  const [coachError, setCoachError] = useState("");
  const [coachMonth, setCoachMonth] = useState(getCurrentMonth);
  const [expandedCoach, setExpandedCoach] = useState(null);
  const [enquiryMonth, setEnquiryMonth] = useState(getCurrentMonth);
  const [enquiryWindow, setEnquiryWindow] = useState("6");
  const [enquiryCenter, setEnquiryCenter] = useState("all");
  const [enquiryData, setEnquiryData] = useState(null);
  const [enquiryLoading, setEnquiryLoading] = useState(false);
  const [enquiryError, setEnquiryError] = useState("");

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      try {
        const catalog = await getAcademyCenterBatchCatalog(user);
        if (active) setAttendanceCatalog(catalog.centers || []);
      } catch (catalogError) {
        console.error("Academy Owner Analytics attendance catalogue load failed:", catalogError);
        if (active) setAttendanceCatalog([]);
      }
    };
    loadCatalog();
    return () => { active = false; };
  }, [user, refreshKey]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const preview = await getAcademyOwnerAnalyticsV2(user, `${month}-01`, attendanceRange, null);
        if (active) setResult(preview);
      } catch (loadError) {
        if (active) {
          console.error("Academy Owner Analytics V2 load failed:", loadError);
          setError(loadError.message || "Unable to load monthly analytics.");
          setResult(null);
          // Keep the independently loaded structural catalogue visible even if
          // the period analytics endpoint fails. The chart can still render
          // every center and batch with zero recorded marks.
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [user, month, attendanceRange, refreshKey]);

  useEffect(() => {
    let active = true;
    if (!attendanceCatalog.length) {
      setInsights({ records: [], players: [] });
      return () => { active = false; };
    }
    getAcademyAttendanceInsights(user, attendanceCatalog, attendanceRange)
      .then(data => { if (active) { setInsights(data); setInsightsError(""); } })
      .catch(err => { if (active) { setInsightsError(err.message || "Attendance insights unavailable."); setInsights({ records: [], players: [] }); } });
    return () => { active = false; };
  }, [user, attendanceCatalog, attendanceRange, refreshKey]);

  useEffect(() => {
    if (activeTab !== "coaches" || !user?.academy_id) return undefined;
    let active = true;
    setCoachError("");
    getCoachAnalytics(user.academy_id).then(data => {
      if (active) setCoachData(data);
    }).catch(err => {
      if (active) { setCoachData(null); setCoachError(err.message || "Unable to load coach assignments."); }
    });
    return () => { active = false; };
  }, [activeTab, user?.academy_id, refreshKey]);

  useEffect(() => {
    if (activeTab !== "enquiries" || !user?.academy_id) return undefined;
    let active = true;
    const [year, monthNumber] = enquiryMonth.split("-").map(Number);
    if (!year || !monthNumber) return undefined;
    const startDate = new Date(Date.UTC(year, monthNumber - Number(enquiryWindow) + 1, 1));
    const startMonth = startDate.toISOString().slice(0, 7);
    setEnquiryLoading(true);
    setEnquiryError("");
    getAcademyEnquiriesAnalytics(user, { startMonth, endMonth: enquiryMonth })
      .then(data => { if (active) setEnquiryData(data); })
      .catch(err => { if (active) { setEnquiryData(null); setEnquiryError(err.message || "Unable to load enquiries."); } })
      .finally(() => { if (active) setEnquiryLoading(false); });
    return () => { active = false; };
  }, [activeTab, user, enquiryMonth, enquiryWindow, refreshKey]);

  const supportedRecords = insights.records.filter(record => record.status === "present" || record.status === "absent");
  const playerTotals = new Map();
  supportedRecords.forEach(record => {
    if (!record.player_id) return;
    const id = String(record.player_id);
    const row = playerTotals.get(id) || { id, present: 0, absent: 0 };
    row[record.status] += 1;
    playerTotals.set(id, row);
  });
  const playerNames = new Map(insights.players.map(player => [String(player.id), player.full_name || "Unnamed player"]));
  const leastAttendance = [...playerTotals.values()]
    .filter(row => row.present + row.absent >= 3 && playerNames.has(row.id))
    .map(row => ({ ...row, name: playerNames.get(row.id), total: row.present + row.absent, rate: Math.round(100 * row.present / (row.present + row.absent)) }))
    .sort((a, b) => a.rate - b.rate || b.total - a.total || a.name.localeCompare(b.name))
    ;
  const playerPageCount = Math.max(1, Math.ceil(leastAttendance.length / 5));
  const visiblePlayers = leastAttendance.slice((playerPage - 1) * 5, playerPage * 5);
  const dailyTotals = new Map();
  supportedRecords.forEach(record => {
    const date = record.attendance_date;
    const row = dailyTotals.get(date) || { date, present: 0, absent: 0 };
    row[record.status] += 1;
    dailyTotals.set(date, row);
  });
  const trendRows = [...dailyTotals.values()].sort((a, b) => a.date.localeCompare(b.date))
    .map(row => ({ ...row, rate: Math.round(100 * row.present / (row.present + row.absent)) }));
  const attendance = result?.attendance || {};
  const finance = result?.finance || {};

  return (
    <Layout>
      <main className="owner-analytics-page">
        <nav className="owner-analytics-tabs" role="group" aria-label="Analytics sections">
          {[
            { id: "attendance", label: "Attendance" },
            { id: "finance", label: "Finance" },
            { id: "coaches", label: "Coaches" },
            { id: "enquiries", label: "Enquiries" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "attendance" && (
          <label className="owner-analytics-attendance-filter owner-analytics-attendance-filter-inline">
            <span>Attendance</span>
            <select value={attendancePreset} onChange={(event) => {
              const preset = event.target.value;
              const months = preset === "1w" ? 0 : preset === "1m" ? 1 : preset === "3m" ? 3 : 5;
              setAttendancePreset(preset);
              setAttendanceRange(getPresetRange(months));
            }}>
              <option value="1w">Last 1 week</option>
              <option value="1m">Last 1 month</option>
              <option value="3m">Last 3 months</option>
              <option value="5m">Last 5 months</option>
            </select>
          </label>
        )}

        {(loading || error) && (
          <section
            className={`owner-analytics-service-status ${error ? "owner-analytics-service-status-error" : "owner-analytics-service-status-loading"}`}
            aria-live="polite"
          >
            <div className="owner-analytics-service-status-icon" aria-hidden="true">
              {loading ? <span className="owner-analytics-inline-spinner" /> : "!"}
            </div>
            <div className="owner-analytics-service-status-copy">
              <strong>
                {loading ? "Loading monthly analytics" : "Analytics data is not available yet"}
              </strong>
              <p>
                {loading
                  ? "Your attendance and financial metrics are being prepared."
                  : error}
              </p>
            </div>
            {error && (
              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                Try again
              </button>
            )}
          </section>
        )}

        {activeTab === "attendance" && (
        <section className="owner-analytics-section">
          <section className="owner-analytics-batch-chart">
            <div className="owner-analytics-batch-chart-heading">
              <div><strong>Center &amp; batch attendance</strong><p>All academy centers and batches are shown, including those with no recorded marks in this period</p></div>
            </div>
            {attendanceCatalog.length ? (() => {
              const recordedByBatch = new Map(
                (attendance.batchBreakdown?.value || []).map(item => [
                  String(item.batchId ?? item.batch_id ?? item.id), item
                ])
              );
              const chartRows = attendanceCatalog.flatMap(center =>
                (center.batches || []).map(batch => {
                  const recorded = recordedByBatch.get(String(batch.batchId));
                  return {
                    ...batch,
                    centerName: center.centerName,
                    present: Number(recorded?.present ?? recorded?.presentMarks ?? 0),
                    absent: Number(recorded?.absent ?? recorded?.absentMarks ?? 0)
                  };
                })
              );
              const centerGroups = attendanceCatalog.map(center => ({
                centerId: center.centerId,
                centerName: center.centerName,
                count: (center.batches || []).length
              }));
              return chartRows.length ? (
                <div className="owner-analytics-unified-chart">
                  <div className="owner-analytics-unified-scroll">
                    <div className="owner-analytics-unified-inner" style={{ minWidth: `${Math.max(680, chartRows.length * 110)}px` }}>
                      <div className="owner-analytics-center-band" aria-label="Center groups">
                        {centerGroups.filter(group => group.count > 0).map(group => (
                          <div key={group.centerId} className="owner-analytics-center-band-item" style={{ flex: group.count }}>
                            {group.centerName} <span>({group.count} batches)</span>
                          </div>
                        ))}
                      </div>
                      <div className="owner-analytics-unified-canvas">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartRows} margin={{ top: 14, right: 12, left: 0, bottom: 12 }} barGap={3} barCategoryGap="22%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="batchName" interval={0} tick={{ fill: "#475569", fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
                            <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                            <Tooltip formatter={(value, name) => [value, name]} labelFormatter={(_, payload) => payload?.[0]?.payload ? `${payload[0].payload.centerName} · ${payload[0].payload.batchName}` : ""} />
                            <Legend verticalAlign="bottom" />
                            <Bar dataKey="present" name="Present" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={28} />
                            <Bar dataKey="absent" name="Absent" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  <p className="owner-analytics-unified-caption">{attendanceCatalog.length} centers · {chartRows.length} batches · Present and absent marks for the selected period. Batches without marks remain at zero.</p>
                </div>
              ) : <p className="owner-analytics-chart-empty">Centers are available, but no batches were returned. Check batch catalogue access.</p>;
            })() : (
              <p className="owner-analytics-chart-empty">No centers or batches are available for this academy.</p>
            )}
          </section>
        </section>
        )}

        {activeTab === "attendance" && (
          <section className="owner-analytics-insights-stack">
            <section className="owner-analytics-batch-chart">
              <div className="owner-analytics-batch-chart-heading">
                <div><strong>Player Insights · Lowest recorded attendance</strong><p>Players ranked by lowest present rate; 5 per page, at least 3 recorded marks in the selected period</p></div>
              </div>
              {insightsError ? <p role="alert">{insightsError}</p> : leastAttendance.length ? (
                <div className="owner-analytics-player-table">
                  <div className="owner-analytics-player-row owner-analytics-player-header"><span>Player</span><span>Attendance</span><span>Records</span></div>
                  {visiblePlayers.map(player => (
                    <div className="owner-analytics-player-row" key={player.id}>
                      <div><strong>{player.name}</strong><small>{player.present} present · {player.absent} absent</small></div>
                      <div className="owner-analytics-player-rate"><div className="owner-analytics-player-track"><span style={{ width: `${player.rate}%` }} /></div><strong>{player.rate}%</strong></div>
                      <strong>{player.total}</strong>
                    </div>
                  ))}
                  <div className="owner-analytics-player-pagination"><span>Page {playerPage} of {playerPageCount} · {leastAttendance.length} players</span><div><button type="button" disabled={playerPage <= 1} onClick={() => setPlayerPage(page => Math.max(1, page - 1))}>Previous</button><button type="button" disabled={playerPage >= playerPageCount} onClick={() => setPlayerPage(page => Math.min(playerPageCount, page + 1))}>Next</button></div></div>
                </div>
              ) : <p className="owner-analytics-chart-empty">No players with at least 3 supported attendance records in this period.</p>}
            </section>
            <section className="owner-analytics-batch-chart">
              <div className="owner-analytics-batch-chart-heading">
                <div><strong>Attendance Trend</strong><p>Daily present and absent marks, with recorded-mark percentage on days with attendance</p></div>
              </div>
              {insightsError ? <p role="alert">{insightsError}</p> : trendRows.length ? (
                <div className="owner-analytics-trend-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendRows} margin={{ top: 12, right: 15, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={date => date.slice(5)} tick={{ fontSize: 11 }} minTickGap={22} />
                      <YAxis yAxisId="marks" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="marks" dataKey="present" name="Present" fill="#16a34a" maxBarSize={18} />
                      <Bar yAxisId="marks" dataKey="absent" name="Absent" fill="#f59e0b" maxBarSize={18} />
                      <Line yAxisId="rate" type="monotone" dataKey="rate" name="Present %" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="owner-analytics-chart-empty">No supported attendance marks in this period.</p>}
              <p className="owner-analytics-unified-caption">Only dates with recorded present/absent marks are plotted. This is not expected-session coverage.</p>
            </section>
          </section>
        )}

        {activeTab === "coaches" && (
          <section className="owner-analytics-section">
            <div className="owner-analytics-section-heading">
              <div><span>ACADEMY OPERATIONS</span><h2>Coach assignments & sessions</h2></div>
              <label>Reporting month <input type="month" value={coachMonth} onChange={event => setCoachMonth(event.target.value)} /></label>
            </div>
            <p className="owner-analytics-coach-disclaimer">Scheduled sessions are calculated from active batch schedules and effective-dated coach assignments. Completed sessions cannot be verified from the current records.</p>
            {coachError ? <p role="alert">{coachError}</p> : !coachData ? <p>Loading coach assignments…</p> : (
              <>
                <div className="owner-analytics-coach-summary">
                  <div><strong>{coachData.length}</strong><span>Active coaches</span></div>
                  <div><strong>{coachData.filter(c => c.assignments.length).length}</strong><span>With session assignments</span></div>
                  <div><strong>{coachData.filter(c => !c.assignments.length).length}</strong><span>Without session assignments</span></div>
                </div>
                <div className="owner-analytics-coach-list">
                  {coachData.map(coach => {
                    const stats = getCoachMonthStats(coach.assignments, coachMonth);
                    const open = expandedCoach === coach.id;
                    const centers = new Set(coach.assignments.map(a => a.centerId)).size;
                    const batches = new Set(coach.assignments.map(a => a.batchId)).size;
                    return <article key={coach.id} className="owner-analytics-coach-row">
                      <button type="button" className="owner-analytics-coach-toggle" onClick={() => setExpandedCoach(open ? null : coach.id)} aria-expanded={open}>
                        <span><strong>{coach.name}</strong><small>{coach.assignments.length ? `${centers} centers · ${batches} batches` : "No active session assignments"}</small></span>
                        <span><strong>{stats.weekly}</strong><small>Sessions / week</small></span>
                        <span><strong>{stats.monthly}</strong><small>Scheduled in month</small></span>
                        <span><strong>—</strong><small>Completed · unverified</small></span>
                        <span aria-hidden="true">{open ? "−" : "+"}</span>
                      </button>
                      {open && <div className="owner-analytics-coach-details">
                        {coach.assignments.length ? coach.assignments.map(a => <div key={a.id}>
                          <strong>{a.centerName} · {a.batchName}</strong>
                          <span>{a.dayName} · {a.startTime?.slice(0,5) || "Time not set"}–{a.endTime?.slice(0,5) || "Time not set"} · {getCoachMonthStats([a], coachMonth).monthly} scheduled this month</span>
                        </div>) : <p>No active session assignments. Review Coach Batch Mapping; legacy batch-only mappings are not counted as verified session allocations.</p>}
                      </div>}
                    </article>;
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "enquiries" && (
          <section className="owner-analytics-section owner-analytics-enquiries">
            <div className="owner-analytics-section-heading">
              <div><span>ACADEMY GROWTH</span><h2>Enquiries & conversion</h2></div>
              <div className="owner-analytics-enquiry-filters">
                <label>Through month <input type="month" value={enquiryMonth} onChange={event => setEnquiryMonth(event.target.value)} /></label>
                <label>Period <select value={enquiryWindow} onChange={event => setEnquiryWindow(event.target.value)}><option value="3">Last 3 months</option><option value="6">Last 6 months</option><option value="12">Last 12 months</option><option value="24">Last 24 months</option><option value="60">Last 60 months</option></select></label>
                <label>Center <select value={enquiryCenter} onChange={event => setEnquiryCenter(event.target.value)}><option value="all">All centers</option>{(enquiryData?.months?.[0]?.centers || []).map(center => <option key={center.centerId} value={center.centerId}>{center.centerName}</option>)}<option value="unassigned">Unassigned</option><option value="unknown">Unknown center</option></select></label>
              </div>
            </div>
            <p className="owner-analytics-enquiry-note">Conversion is attributed to the month the enquiry was created, even when the player converted later. Conversion counts reflect the current recorded state.</p>
            {enquiryLoading ? <p role="status">Loading enquiry analytics…</p> : enquiryError ? <div role="alert" className="owner-analytics-quality-note"><strong>Unable to load enquiry analytics</strong><p>{enquiryError}</p><button type="button" onClick={() => setRefreshKey(value => value + 1)}>Retry</button></div> : enquiryData ? (() => {
              const rows = enquiryData.months.map(monthRow => {
                const selected = enquiryCenter === "all" ? monthRow
                  : enquiryCenter === "unassigned" ? monthRow.unassigned
                  : enquiryCenter === "unknown" ? monthRow.unknownCenter
                  : monthRow.centers.find(center => center.centerId === enquiryCenter);
                return { month: monthRow.month, received: selected?.received || 0, converted: selected?.converted || 0, rate: selected?.conversionRate ?? null };
              });
              const received = rows.reduce((sum, row) => sum + row.received, 0);
              const converted = rows.reduce((sum, row) => sum + row.converted, 0);
              const rate = received ? 100 * converted / received : null;
              const centerTotals = (enquiryData.months[0]?.centers || []).map(center => {
                const centerRows = enquiryData.months.map(monthRow => monthRow.centers.find(item => item.centerId === center.centerId));
                const count = centerRows.reduce((sum, item) => sum + (item?.received || 0), 0);
                const wins = centerRows.reduce((sum, item) => sum + (item?.converted || 0), 0);
                return { ...center, received: count, converted: wins, conversionRate: count ? 100 * wins / count : null };
              });
              return <>
                <div className="owner-analytics-enquiry-kpis">
                  <article><span>Enquiries received</span><strong>{formatNumber(received)}</strong></article>
                  <article><span>Converted to players</span><strong>{formatNumber(converted)}</strong></article>
                  <article><span>Cohort conversion rate</span><strong>{formatPercent(rate)}</strong></article>
                </div>
                <section className="owner-analytics-batch-chart">
                  <div className="owner-analytics-batch-chart-heading"><strong>Monthly enquiry trend</strong><p>Enquiries received versus converted from each creation-month cohort</p></div>
                  <div className="owner-analytics-enquiry-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rows} margin={{ top: 12, right: 14, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} minTickGap={16} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip /><Legend />
                        <Bar dataKey="received" name="Received" fill="#1d4ed8" maxBarSize={24} radius={[3,3,0,0]} />
                        <Bar dataKey="converted" name="Converted" fill="#16a34a" maxBarSize={24} radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <section className="owner-analytics-batch-chart">
                  <div className="owner-analytics-batch-chart-heading"><strong>Center-wise conversion</strong><p>All centers are included, even with zero enquiries. Center assignment reflects the current enquiry record.</p></div>
                  <div className="owner-analytics-enquiry-table-wrap"><table className="owner-analytics-enquiry-table"><thead><tr><th>Center</th><th>Received</th><th>Converted</th><th>Rate</th></tr></thead><tbody>{centerTotals.map(center => <tr key={center.centerId}><th scope="row">{center.centerName}</th><td>{center.received}</td><td>{center.converted}</td><td>{formatPercent(center.conversionRate)}</td></tr>)}</tbody></table></div>
                </section>
                <p className="owner-analytics-enquiry-note">A dash means the cohort has no enquiries; it is not a 0% conversion rate. Data is read-only and scoped to this academy.</p>
              </>;
            })() : <p className="owner-analytics-chart-empty">No enquiry analytics loaded.</p>}
          </section>
        )}

        {activeTab === "finance" && (
        <section className="owner-analytics-section">
          <div className="owner-analytics-section-heading">
            <div>
              <span>ACADEMY FINANCIALS</span>
              <h2>Finance</h2>
            </div>
            <p>Recorded collections and current ledger diagnostics</p>
          </div>
          <div className="owner-analytics-grid owner-analytics-grid-two">
            <MetricCard
              label="Recorded collections"
              value={formatCurrency(finance.grossRecordedCollections?.value)}
              note="Payment entries by payment date"
              quality={finance.grossRecordedCollections?.quality}
              tone="positive"
            />
            <MetricCard
              label="Signed adjustments"
              value={formatCurrency(finance.signedAdjustments?.value)}
              note="Adjustments recorded in the month"
              quality={finance.signedAdjustments?.quality}
            />
            <MetricCard
              label="Recorded expenses"
              value={formatCurrency(finance.recordedExpenses?.value)}
              note="Academy expenses by expense date"
              quality={finance.recordedExpenses?.quality}
              tone="warning"
            />
            <MetricCard
              label="Net recorded movement"
              value={formatCurrency(finance.netRecordedCashMovement?.value)}
              note="Collections less recorded expenses; not profit"
              quality={finance.netRecordedCashMovement?.quality}
              tone="primary"
            />
          </div>
          <MetricBreakdown
            title="Collections vs expenses"
            description="Recorded gross collections and expenses for the selected month"
            firstLabel="Collections"
            firstValue={finance.grossRecordedCollections?.value}
            secondLabel="Expenses"
            secondValue={finance.recordedExpenses?.value}
            firstTone="blue"
            secondTone="orange"
            formatter={formatCurrency}
          />
          <div className="owner-analytics-grid owner-analytics-grid-two owner-analytics-grid-secondary">
            <MetricCard
              label="Current outstanding"
              value={formatCurrency(finance.currentLedgerOutstanding?.value)}
              note="Current due ledger balance, not month-end historical balance"
              quality={finance.currentLedgerOutstanding?.quality}
            />
            <MetricCard
              label="Historical outstanding"
              value={formatCurrency(finance.historicalOutstanding?.value)}
              note="Requires month-end snapshots"
              quality={finance.historicalOutstanding?.quality}
            />
          </div>
          <div className="owner-analytics-quality-note">
            <strong>Finance data limitations</strong>
            <p>Historical outstanding is not available yet. Current outstanding reflects today's due ledger and must not be interpreted as the selected month's closing balance.</p>
          </div>
          <div className="owner-analytics-detail">
            <h3>Data quality details</h3>
            <div>
              <span>Collection cohort rate</span>
              <strong>{formatPercent(finance.cohortCollectionRatePercent?.value)}</strong>
              <small>{finance.cohortCollectionRatePercent?.quality || "unavailable"}</small>
            </div>
            <MetricNotes metric={finance.currentDueLedgerReconciliation} />
            <MetricNotes metric={finance.cohortCollectionRatePercent} />
          </div>
        </section>
        )}

      </main>
    </Layout>
  );
}

export default AcademyOwnerAnalyticsV2;
