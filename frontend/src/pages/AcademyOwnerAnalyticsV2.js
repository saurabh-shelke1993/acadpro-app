import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { getAcademyOwnerAnalyticsV2 } from "../services/analyticsV2Service";
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

const getPreviousPeriodRange = (range) => {
  const start = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  const days = Math.round((end - start) / 86400000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
  return {
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10)
  };
};

const getPreviousMonthRange = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
  const previousMonth = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
  return getMonthDateRange(previousMonth);
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
  const [month, setMonth] = useState(getCurrentMonth);
  const [attendanceRange, setAttendanceRange] = useState(() => getMonthDateRange(getCurrentMonth()));
  const [comparisonRange, setComparisonRange] = useState(() => getPreviousMonthRange(getCurrentMonth()));
  const [comparisonManuallySet, setComparisonManuallySet] = useState(false);
  const effectiveComparisonRange = useMemo(
    () => comparisonManuallySet ? comparisonRange : getPreviousPeriodRange(attendanceRange),
    [comparisonManuallySet, comparisonRange, attendanceRange]
  );
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("attendance");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const preview = await getAcademyOwnerAnalyticsV2(user, `${month}-01`, attendanceRange, effectiveComparisonRange);
        if (active) setResult(preview);
      } catch (loadError) {
        if (active) {
          console.error("Academy Owner Analytics V2 load failed:", loadError);
          setError(loadError.message || "Unable to load monthly analytics.");
          setResult(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [user, month, attendanceRange, effectiveComparisonRange, refreshKey]);

  const monthLabel = new Date(`${month}-01T00:00:00+05:30`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });

  const attendance = result?.attendance || {};
  const finance = result?.finance || {};
  const period = result?.period;

  return (
    <Layout>
      <main className="owner-analytics-page">
        <header className="owner-analytics-header">
          <div>
            <span className="owner-analytics-kicker">ACADEMY PERFORMANCE</span>
            <h1>Analytics</h1>
            <p>Attendance date-range comparison and monthly academy financials.</p>
          </div>
          <label className="owner-analytics-month-picker">
            <span>Reporting month</span>
            <input
              type="month"
              value={month}
              max={getCurrentMonth()}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
        </header>

        <section className="owner-analytics-period">
          <div>
            <strong>{monthLabel}</strong>
            <span>{period?.start || `${month}-01`} · Asia/Kolkata reporting period</span>
          </div>
          <span className="owner-analytics-preview-label">PREVIEW · NOT PUBLISHED</span>
        </section>

        <nav className="owner-analytics-tabs" role="group" aria-label="Analytics sections">
          {[
            { id: "attendance", label: "Attendance" },
            { id: "finance", label: "Finance" }
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
          <div className="owner-analytics-section-heading">
            <div>
              <span>TRAINING ACTIVITY</span>
              <h2>Attendance</h2>
            </div>
            <p>Actual stored attendance marks within your selected date range</p>
          </div>
          <div className="owner-analytics-date-range-controls">
            <label>
              <span>Primary range · From</span>
              <input type="date" required value={attendanceRange.startDate} max={attendanceRange.endDate} onChange={(event) => setAttendanceRange((range) => ({ ...range, startDate: event.target.value }))} />
            </label>
            <label>
              <span>To</span>
              <input type="date" required value={attendanceRange.endDate} min={attendanceRange.startDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setAttendanceRange((range) => ({ ...range, endDate: event.target.value }))} />
            </label>
            <label>
              <span>Compare · From</span>
              <input type="date" required value={effectiveComparisonRange.startDate} max={effectiveComparisonRange.endDate} onChange={(event) => { setComparisonManuallySet(true); setComparisonRange({ ...effectiveComparisonRange, startDate: event.target.value }); }} />
            </label>
            <label>
              <span>To</span>
              <input type="date" required value={effectiveComparisonRange.endDate} min={effectiveComparisonRange.startDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => { setComparisonManuallySet(true); setComparisonRange({ ...effectiveComparisonRange, endDate: event.target.value }); }} />
            </label>
          </div>
          <div className="owner-analytics-range-caption">
            Primary: {attendanceRange.startDate} to {attendanceRange.endDate} · Comparison: {effectiveComparisonRange.startDate} to {effectiveComparisonRange.endDate}
            {comparisonManuallySet ? " · Custom comparison" : " · Automatically matched previous period"}
            {comparisonManuallySet && <button type="button" className="owner-analytics-reset-comparison" onClick={() => setComparisonManuallySet(false)}>Use previous period</button>}
          </div>
          <div className="owner-analytics-grid owner-analytics-grid-three">
            <MetricCard
              label="Present marks"
              value={formatNumber(attendance.presentMarks?.value)}
              note="Supported present records"
              quality={attendance.presentMarks?.quality}
              tone="positive"
            />
            <MetricCard
              label="Absent marks"
              value={formatNumber(attendance.absentMarks?.value)}
              note="Supported absent records"
              quality={attendance.absentMarks?.quality}
              tone="warning"
            />
            <MetricCard
              label="Recorded-mark rate"
              value={formatPercent(attendance.attendanceRatePercent?.value)}
              note="Present ÷ (present + absent)"
              quality={attendance.attendanceRatePercent?.quality}
              tone="primary"
            />
          </div>
          <MetricBreakdown
            title="Attendance mix"
            description="Share of supported marks recorded in the primary date range"
            firstLabel="Present"
            firstValue={attendance.presentMarks?.value}
            secondLabel="Absent"
            secondValue={attendance.absentMarks?.value}
            firstTone="green"
            secondTone="orange"
          />
          <div className="owner-analytics-quality-note">
            <strong>How to read this</strong>
            <p>This is the percentage among supported attendance marks recorded in the system. It is not attendance coverage against all expected training sessions.</p>
          </div>
          {attendance.comparison && (
            <section className="owner-analytics-comparison">
              <div className="owner-analytics-section-heading">
                <div><span>HISTORICAL COMPARISON</span><h3>Selected range vs comparison range</h3></div>
                <p>Ranges are compared as selected; lengths may differ.</p>
              </div>
              <div className="owner-analytics-grid owner-analytics-grid-three">
                <MetricCard label="Present marks · comparison" value={formatNumber(attendance.comparison.presentMarks?.value)} quality={attendance.comparison.presentMarks?.quality} />
                <MetricCard label="Absent marks · comparison" value={formatNumber(attendance.comparison.absentMarks?.value)} quality={attendance.comparison.absentMarks?.quality} />
                <MetricCard label="Recorded-mark rate · comparison" value={formatPercent(attendance.comparison.attendanceRatePercent?.value)} quality={attendance.comparison.attendanceRatePercent?.quality} />
              </div>
              <div className="owner-analytics-range-caption">
                Unsupported statuses: {formatNumber(attendance.comparison.ignoredStatusCount?.value)} · Missing schedule references: {formatNumber(attendance.comparison.missingScheduleIdCount?.value)}
              </div>
            </section>
          )}
          <div className="owner-analytics-diagnostics">
            <div>
              <span>Unsupported status records</span>
              <strong>{formatNumber(attendance.ignoredStatusCount?.value)}</strong>
              <small>{attendance.ignoredStatusCount?.quality || "unavailable"}</small>
            </div>
            <div>
              <span>Missing schedule references</span>
              <strong>{formatNumber(attendance.missingScheduleIdCount?.value)}</strong>
              <small>{attendance.missingScheduleIdCount?.quality || "unavailable"}</small>
            </div>
          </div>
          {attendance.unsupportedStatusBreakdown?.value && (
            <div className="owner-analytics-detail">
              <h3>Unsupported status breakdown</h3>
              {Object.entries(attendance.unsupportedStatusBreakdown.value).map(([status, count]) => (
                <div key={status}><span>{status}</span><strong>{formatNumber(count)}</strong></div>
              ))}
            </div>
          )}
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

        <footer className="owner-analytics-footer">
          <span>Preview calculation · No snapshots have been published.</span>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh data"}
          </button>
        </footer>
      </main>
    </Layout>
  );
}

export default AcademyOwnerAnalyticsV2;
