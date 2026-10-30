import { useEffect, useState } from "react";
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

const formatCurrency = (value) =>
  value === null || value === undefined
    ? "—"
    : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const formatNumber = (value) =>
  value === null || value === undefined ? "—" : Number(value).toLocaleString("en-IN");

const formatPercent = (value) =>
  value === null || value === undefined ? "—" : `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;

function MetricCard({ label, value, note, quality = "partial", tone = "default" }) {
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
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const preview = await getAcademyOwnerAnalyticsV2(user, `${month}-01`);
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
  }, [user, month, refreshKey]);

  const monthLabel = new Date(`${month}-01T00:00:00+05:30`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });

  if (loading) {
    return (
      <Layout>
        <div className="owner-analytics-state">
          <div className="dashboard-state-spinner" />
          <h2>Preparing your monthly analytics</h2>
          <p>Calculating attendance and financial metrics for your academy...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="owner-analytics-state owner-analytics-state-error">
          <span className="owner-analytics-error-icon">!</span>
          <h1>Academy Analytics</h1>
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>
            Try again
          </button>
        </div>
      </Layout>
    );
  }

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
            <p>Monthly overview of attendance and academy finances.</p>
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

        <section className="owner-analytics-section">
          <div className="owner-analytics-section-heading">
            <div>
              <span>TRAINING ACTIVITY</span>
              <h2>Attendance</h2>
            </div>
            <p>Recorded attendance marks in the selected month</p>
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
          <div className="owner-analytics-quality-note">
            <strong>How to read this</strong>
            <p>This is the percentage among supported attendance marks recorded in the system. It is not attendance coverage against all expected training sessions.</p>
          </div>
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
        </section>

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

        <footer className="owner-analytics-footer">
          <span>Preview calculation · No snapshots have been published.</span>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>
            Refresh data
          </button>
        </footer>
      </main>
    </Layout>
  );
}

export default AcademyOwnerAnalyticsV2;
