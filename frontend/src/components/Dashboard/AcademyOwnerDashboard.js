import { Link } from "react-router-dom";
import "./AcademyOwnerDashboard.css";

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN");

function KpiCard({ label, value, detail, to, tone = "blue" }) {
  const content = (
    <div className="ao-kpi-card" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {to && <b aria-hidden="true">→</b>}
    </div>
  );

  return to ? (
    <Link className="ao-kpi-link" to={to} aria-label={`Open ${label}`}>
      {content}
    </Link>
  ) : content;
}

function CenterPerformance({ centers }) {
  if (!centers.length) {
    return (
      <div className="ao-empty-card">
        <strong>No active centers found.</strong>
        <span>Add or activate a center to see operational performance here.</span>
      </div>
    );
  }

  return (
    <div className="ao-center-table-wrap">
      <div className="ao-center-table">
        <div className="ao-center-header">
          <span>Center</span>
          <span>Players</span>
          <span>Batches</span>
          <span>Attendance · 7d</span>
          <span>Today</span>
        </div>

        {centers.map((center) => (
          <Link
            key={center.id}
            className="ao-center-row"
            to={`/batches?academyId=${center.academyId}&centerId=${center.id}`}
            aria-label={`Open batches for ${center.name}`}
          >
            <div>
              <strong>{center.name}</strong>
              <small>
                {center.attendanceRecords
                  ? `${center.attendanceRecords} attendance records`
                  : "No attendance records in last 7 days"}
              </small>
            </div>

            <strong>{formatNumber(center.players)}</strong>
            <strong>{formatNumber(center.batches)}</strong>

            <div className="ao-center-rate">
              <strong>
                {center.attendanceRecords ? `${center.attendanceRate}%` : "—"}
              </strong>
              <div className="ao-rate-track">
                <span style={{ width: `${center.attendanceRate}%` }} />
              </div>
            </div>

            <span
              className={`ao-center-today ${center.attendanceCoverage === 100
                ? "ao-center-today-complete"
                : "ao-center-today-pending"}`}
            >
              {center.recordedBatches}/{center.batches}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AcademyOwnerDashboard({ data }) {
  const centers = data?.centers || [];
  const totals = data?.totals || {};
  const attendance = data?.attendance || {};
  const financial = data?.financial || {};

  return (
    <div className="ao-dashboard">
      <section className="ao-section ao-section-first">
        <div className="ao-section-heading">
          <div>
            <span className="ao-kicker">Academy snapshot</span>
            <h2>{data?.academyName || "Your academy"}</h2>
          </div>
          <span className="ao-helper">Current operational scope</span>
        </div>

        <div className="ao-kpi-grid">
          <KpiCard
            label="Active players"
            value={formatNumber(totals.players)}
            detail="Currently active"
            to="/players"
          />
          <KpiCard
            label="Active centers"
            value={formatNumber(totals.centers)}
            detail="Currently active"
            to="/centers"
            tone="green"
          />
          <KpiCard
            label="Active batches"
            value={formatNumber(totals.batches)}
            detail="Across all centers"
            to="/batches"
            tone="orange"
          />
          <KpiCard
            label="Attendance today"
            value={attendance.attendanceRate ? `${attendance.attendanceRate}%` : "—"}
            detail={`${attendance.recordedBatches}/${attendance.totalBatches} batches recorded`}
            to="/attendance"
            tone="purple"
          />
        </div>
      </section>

      <section className="ao-section">
        <div className="ao-section-heading">
          <div>
            <span className="ao-kicker">Today's operations</span>
            <h2>Attendance coverage</h2>
          </div>
          <span className="ao-helper">
            {attendance.recordedBatches}/{attendance.totalBatches} active batches recorded
          </span>
        </div>

        <div className="ao-operations-card">
          <div className="ao-operations-summary">
            <div>
              <strong>
                {attendance.coveragePercentage || 0}%
              </strong>
              <span>attendance coverage</span>
            </div>
            <div>
              <strong>{formatNumber(attendance.presentPlayers)}</strong>
              <span>present today</span>
            </div>
            <div>
              <strong>{formatNumber(attendance.absentPlayers)}</strong>
              <span>absent today</span>
            </div>
          </div>

          <div className="ao-coverage-track">
            <span style={{ width: `${attendance.coveragePercentage || 0}%` }} />
          </div>

          <div className="ao-coverage-note">
            {attendance.totalBatches === 0
              ? "No active batches are available."
              : attendance.recordedBatches === attendance.totalBatches
                ? "All active batches have recorded attendance today."
                : `${attendance.totalBatches - attendance.recordedBatches} active batch${attendance.totalBatches - attendance.recordedBatches === 1 ? "" : "es"} still need attendance.`}
          </div>
        </div>
      </section>

      <section className="ao-section">
        <div className="ao-section-heading">
          <div>
            <span className="ao-kicker">Center performance</span>
            <h2>Centers at a glance</h2>
          </div>
          <span className="ao-helper">Select a center to continue to batches</span>
        </div>

        <CenterPerformance centers={centers} />
      </section>

      <section className="ao-section">
        <div className="ao-section-heading">
          <div>
            <span className="ao-kicker">Financial snapshot</span>
            <h2>Collections and outstanding</h2>
          </div>
          <span className="ao-helper">Current payment ledger</span>
        </div>

        <div className="ao-financial-workspace">
          <div className="ao-financial-primary">
            <KpiCard
              label="Total billed"
              value={formatCurrency(financial.totalBilled)}
              detail="Current payment due ledger"
              to="/payment-dues"
            />
            <KpiCard
              label="Collected this month"
              value={formatCurrency(financial.collectionsThisMonth)}
              detail={`${financial.collectionRate}% of billed dues collected`}
              to="/payment-collections"
              tone="green"
            />
            <KpiCard
              label="Outstanding"
              value={formatCurrency(financial.outstandingAmount)}
              detail={`${formatNumber(financial.pendingDues)} pending/partial dues`}
              to="/payment-dues"
              tone="orange"
            />
          </div>

          <div className="ao-financial-status">
            <div>
              <span>Pending</span>
              <strong>{formatNumber(financial.pendingDues)}</strong>
            </div>
            <div>
              <span>Partial</span>
              <strong>{formatNumber(financial.partialDues)}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>{formatNumber(financial.paidDues)}</strong>
            </div>
            <div>
              <span>Collection rate</span>
              <strong>{financial.collectionRate}%</strong>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

export default AcademyOwnerDashboard;
